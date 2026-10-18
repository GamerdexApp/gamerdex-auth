import { createGoogleHandler, GOOGLE_REFRESH_LIFETIME_SECONDS } from '@/google';
import { GOOGLE_DRIVE_SCOPE } from '@gamerdexapp/gamerdex-sync';

const ORIGIN = 'https://tracker.test';
const SECRET = 'google-secret-1';

interface Call {
  url: string;
  headers: Record<string, string>;
  form: Record<string, string>;
}

const googleAnswer = (extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      access_token: 'at-g',
      expires_in: 3599,
      refresh_token: 'rt-g',
      scope: `openid ${GOOGLE_DRIVE_SCOPE}`,
      token_type: 'Bearer',
      id_token: 'must-not-leak',
      ...extra,
    }),
  );

const setup = (answer: () => Response | Promise<Response> = () => googleAnswer()) => {
  const calls: Call[] = [];
  const fetchStub = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      form: Object.fromEntries(new URLSearchParams(String(init.body))),
    });
    return answer();
  }) as unknown as typeof fetch;
  const handler = createGoogleHandler({
    clientId: 'client-1.apps.googleusercontent.com',
    clientSecret: SECRET,
    allowedOrigins: [ORIGIN],
    fetch: fetchStub,
  });
  return { handler, calls };
};

const post = (path: string, body: unknown, origin: string | null = ORIGIN) =>
  new Request(`https://auth.test/api/google/${path}`, {
    method: 'POST',
    headers: origin ? { Origin: origin, 'Content-Type': 'application/json' } : {},
    body: JSON.stringify(body),
  });

const code = { code: 'c1', redirectUri: 'https://tracker.test/sync/callback' };

describe('createGoogleHandler(): sign in code', () => {
  it('sends the code to Google as a form with the client id and secret', async () => {
    const { handler, calls } = setup();
    const response = await handler(post('token', code));
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      {
        url: 'https://oauth2.googleapis.com/token',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        form: {
          client_id: 'client-1.apps.googleusercontent.com',
          client_secret: SECRET,
          grant_type: 'authorization_code',
          code: 'c1',
          redirect_uri: 'https://tracker.test/sync/callback',
        },
      },
    ]);
  });

  it('answers with the shared token shape and nothing else from Google', async () => {
    const { handler } = setup();
    const response = await handler(post('token', code));
    expect(await response.json()).toEqual({
      accessToken: 'at-g',
      expiresIn: 3599,
      refreshToken: 'rt-g',
      refreshExpiresIn: GOOGLE_REFRESH_LIFETIME_SECONDS,
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses a sign in that gave no refresh token', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { handler } = setup(() => googleAnswer({ refresh_token: undefined }));
    const response = await handler(post('token', code));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'rejected', reason: 'no_refresh_token' });
    expect(log).toHaveBeenCalledWith('Google rejected the token request: no_refresh_token');
    log.mockRestore();
  });

  it('refuses a sign in that did not grant the Drive file scope', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const scope of ['openid email', undefined, 5]) {
      const { handler } = setup(() => googleAnswer({ scope }));
      const response = await handler(post('token', code));
      expect(await response.json()).toEqual({ error: 'rejected', reason: 'missing_scope' });
    }
    log.mockRestore();
  });
});

describe('createGoogleHandler(): refresh token', () => {
  const refreshAnswer = () =>
    new Response(
      JSON.stringify({ access_token: 'at-new', expires_in: 3599, token_type: 'Bearer' }),
    );

  it('sends the refresh token as a form', async () => {
    const { handler, calls } = setup(refreshAnswer);
    await handler(post('refresh', { refreshToken: 'rt-old' }));
    expect(calls[0].form).toEqual({
      client_id: 'client-1.apps.googleusercontent.com',
      client_secret: SECRET,
      grant_type: 'refresh_token',
      refresh_token: 'rt-old',
    });
  });

  it('keeps the same refresh token and gives it a new lifetime', async () => {
    const { handler } = setup(refreshAnswer);
    const response = await handler(post('refresh', { refreshToken: 'rt-old' }));
    expect(await response.json()).toEqual({
      accessToken: 'at-new',
      expiresIn: 3599,
      refreshToken: 'rt-old',
      refreshExpiresIn: GOOGLE_REFRESH_LIFETIME_SECONDS,
    });
  });
});

describe('createGoogleHandler(): failures', () => {
  it('reports the reason when Google rejects the request, without the secret', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { handler } = setup(
      () =>
        new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Bad' }), {
          status: 400,
        }),
    );
    const response = await handler(post('refresh', { refreshToken: 'dead' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'rejected', reason: 'invalid_grant' });
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
    log.mockRestore();
  });

  it('rejects an answer that is not whole', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const bodies = [
      '[]',
      JSON.stringify({}),
      JSON.stringify({ access_token: 'a', expires_in: 'soon' }),
    ];
    for (const raw of bodies) {
      const { handler } = setup(() => new Response(raw));
      const response = await handler(post('refresh', { refreshToken: 'x' }));
      expect(await response.json()).toEqual({ error: 'rejected', reason: 'invalid' });
    }
    log.mockRestore();
  });

  it('answers 502 when Google cannot be reached', async () => {
    const { handler } = setup(() => {
      throw new TypeError('fetch failed');
    });
    const response = await handler(post('token', code));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'unreachable' });
  });

  it('keeps the origin, method and body rules of the shared handler', async () => {
    const { handler, calls } = setup();
    expect((await handler(post('token', code, 'https://evil.test'))).status).toBe(403);
    expect((await handler(post('token', { code: 'c' }))).status).toBe(400);
    expect((await handler(post('other', code))).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it('uses the global fetch when none is given', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(googleAnswer());
    const handler = createGoogleHandler({
      clientId: 'c',
      clientSecret: 's',
      allowedOrigins: [ORIGIN],
    });
    expect((await handler(post('token', code))).status).toBe(200);
    spy.mockRestore();
  });
});
