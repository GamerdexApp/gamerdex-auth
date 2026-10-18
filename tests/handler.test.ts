import { createAuthHandler } from '@/handler';
import { GITHUB_APP } from '@gamerdexapp/gamerdex-sync';

const ORIGIN = 'https://tracker.test';

const setup = (answer: () => Response | Promise<Response> = () => ok()) => {
  const calls: { url: string; body: Record<string, string> }[] = [];
  const fetchStub = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) as Record<string, string> });
    return answer();
  }) as unknown as typeof fetch;
  const handler = createAuthHandler({
    clientSecret: 'secret-1',
    allowedOrigins: [ORIGIN],
    fetch: fetchStub,
  });
  return { handler, calls };
};

const ok = () =>
  new Response(
    JSON.stringify({
      access_token: 'at',
      expires_in: 28800,
      refresh_token: 'rt',
      refresh_token_expires_in: 15552000,
      token_type: 'bearer',
    }),
  );

const post = (path: string, body: unknown, origin: string | null = ORIGIN, method = 'POST') =>
  new Request(`https://auth.test/${path}`, {
    method,
    headers: origin ? { Origin: origin, 'Content-Type': 'application/json' } : {},
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

describe('createAuthHandler()', () => {
  it('swaps a code for tokens with the client id and secret', async () => {
    const { handler, calls } = setup();
    const response = await handler(post('token', { code: 'c1', redirectUri: 'https://x.test/cb' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accessToken: 'at',
      expiresIn: 28800,
      refreshToken: 'rt',
      refreshExpiresIn: 15552000,
    });
    expect(calls).toEqual([
      {
        url: 'https://github.com/login/oauth/access_token',
        body: {
          client_id: GITHUB_APP.clientId,
          client_secret: 'secret-1',
          code: 'c1',
          redirect_uri: 'https://x.test/cb',
        },
      },
    ]);
  });

  it('swaps a refresh token for new tokens', async () => {
    const { handler, calls } = setup();
    const response = await handler(post('v1/refresh', { refreshToken: 'rt0' }));
    expect(response.status).toBe(200);
    expect(calls[0].body).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rt0' });
  });

  it('never puts the secret or GitHub fields in the answer, and allows no caching', async () => {
    const { handler } = setup();
    const response = await handler(post('token', { code: 'c', redirectUri: 'r' }));
    expect(JSON.stringify(await response.clone().json())).not.toContain('secret-1');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('refuses an origin that is not allowed or missing, without calling GitHub', async () => {
    const { handler, calls } = setup();
    const other = await handler(post('token', {}, 'https://evil.test'));
    expect(other.status).toBe(403);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await handler(post('token', {}, null))).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it('answers the preflight request', async () => {
    const { handler } = setup();
    const response = await handler(post('token', null, ORIGIN, 'OPTIONS'));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('refuses other methods', async () => {
    const { handler } = setup();
    const response = await handler(
      new Request('https://auth.test/token', { method: 'GET', headers: { Origin: ORIGIN } }),
    );
    expect(response.status).toBe(405);
  });

  it('refuses a body that is not JSON or not an object', async () => {
    const { handler } = setup();
    expect((await handler(post('token', '{oops'))).status).toBe(400);
    expect((await handler(post('token', '[1]'))).status).toBe(400);
  });

  it('refuses missing fields and unknown routes', async () => {
    const { handler, calls } = setup();
    expect((await handler(post('token', { code: 'c' }))).status).toBe(400);
    expect((await handler(post('refresh', { code: 'c' }))).status).toBe(400);
    expect((await handler(post('other', { code: 'c', redirectUri: 'r' }))).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it('reports a rejected code, a rejected answer shape and an unreachable GitHub', async () => {
    const rejected = setup(() => new Response(JSON.stringify({ error: 'bad_verification_code' })));
    const first = await rejected.handler(post('token', { code: 'c', redirectUri: 'r' }));
    expect(first.status).toBe(400);
    expect(await first.json()).toEqual({ error: 'rejected' });

    const unexpiring = setup(() => new Response(JSON.stringify({ access_token: 'at' })));
    const second = await unexpiring.handler(post('token', { code: 'c', redirectUri: 'r' }));
    expect(second.status).toBe(400);
    expect(await second.json()).toEqual({ error: 'rejected' });

    const odd = setup(() => new Response('[]'));
    expect((await odd.handler(post('token', { code: 'c', redirectUri: 'r' }))).status).toBe(400);

    const down = setup(() => {
      throw new TypeError('fetch failed');
    });
    const last = await down.handler(post('refresh', { refreshToken: 'x' }));
    expect(last.status).toBe(502);
    expect(await last.json()).toEqual({ error: 'unreachable' });
  });

  it('uses the global fetch when none is given', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(ok());
    const handler = createAuthHandler({ clientSecret: 's', allowedOrigins: [ORIGIN] });
    expect((await handler(post('token', { code: 'c', redirectUri: 'r' }))).status).toBe(200);
    spy.mockRestore();
  });
});
