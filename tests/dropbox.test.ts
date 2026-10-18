import { createDropboxHandler, DROPBOX_REFRESH_LIFETIME_SECONDS } from '@/dropbox';

const ORIGIN = 'https://tracker.test';
const SECRET = 'dropbox-secret-1';
const SCOPES = 'files.content.read files.content.write';

interface Call {
  url: string;
  headers: Record<string, string>;
  form: Record<string, string>;
}

const dropboxAnswer = (extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      access_token: 'at-d',
      expires_in: 14400,
      refresh_token: 'rt-d',
      scope: SCOPES,
      token_type: 'bearer',
      uid: 'must-not-leak',
      account_id: 'dbid:must-not-leak',
      ...extra,
    }),
  );

const setup = (answer: () => Response | Promise<Response> = () => dropboxAnswer()) => {
  const calls: Call[] = [];
  const fetchStub = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      form: Object.fromEntries(new URLSearchParams(String(init.body))),
    });
    return answer();
  }) as unknown as typeof fetch;
  const handler = createDropboxHandler({
    clientId: 'app-key-1',
    clientSecret: SECRET,
    allowedOrigins: [ORIGIN],
    fetch: fetchStub,
  });
  return { handler, calls };
};

const post = (path: string, body: unknown, origin: string | null = ORIGIN) =>
  new Request(`https://auth.test/api/dropbox/${path}`, {
    method: 'POST',
    headers: origin ? { Origin: origin, 'Content-Type': 'application/json' } : {},
    body: JSON.stringify(body),
  });

const code = { code: 'c1', redirectUri: 'https://tracker.test/sync/callback' };

describe('createDropboxHandler(): sign in code', () => {
  it('sends the code to Dropbox as a form with the app key and secret', async () => {
    const { handler, calls } = setup();
    const response = await handler(post('token', code));
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      {
        url: 'https://api.dropbox.com/oauth2/token',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        form: {
          client_id: 'app-key-1',
          client_secret: SECRET,
          grant_type: 'authorization_code',
          code: 'c1',
          redirect_uri: 'https://tracker.test/sync/callback',
        },
      },
    ]);
  });

  it('answers with the shared token shape and nothing else from Dropbox', async () => {
    const { handler } = setup();
    const response = await handler(post('token', code));
    expect(await response.json()).toEqual({
      accessToken: 'at-d',
      expiresIn: 14400,
      refreshToken: 'rt-d',
      refreshExpiresIn: DROPBOX_REFRESH_LIFETIME_SECONDS,
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses a sign in that gave no refresh token', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { handler } = setup(() => dropboxAnswer({ refresh_token: undefined }));
    const response = await handler(post('token', code));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'rejected', reason: 'no_refresh_token' });
    expect(log).toHaveBeenCalledWith('Dropbox rejected the token request: no_refresh_token');
    log.mockRestore();
  });

  it('refuses a sign in that did not grant both file scopes', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const scope of [
      'files.content.read',
      'files.content.write account_info.read',
      undefined,
      5,
    ]) {
      const { handler } = setup(() => dropboxAnswer({ scope }));
      const response = await handler(post('token', code));
      expect(await response.json()).toEqual({ error: 'rejected', reason: 'missing_scope' });
    }
    log.mockRestore();
  });

  it('accepts more scopes than the two file scopes', async () => {
    const { handler } = setup(() => dropboxAnswer({ scope: `${SCOPES} account_info.read` }));
    expect((await handler(post('token', code))).status).toBe(200);
  });
});

describe('createDropboxHandler(): refresh token', () => {
  const refreshAnswer = () =>
    new Response(
      JSON.stringify({ access_token: 'at-new', expires_in: 14400, token_type: 'bearer' }),
    );

  it('sends the refresh token as a form', async () => {
    const { handler, calls } = setup(refreshAnswer);
    await handler(post('refresh', { refreshToken: 'rt-old' }));
    expect(calls[0].form).toEqual({
      client_id: 'app-key-1',
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
      expiresIn: 14400,
      refreshToken: 'rt-old',
      refreshExpiresIn: DROPBOX_REFRESH_LIFETIME_SECONDS,
    });
  });
});

describe('createDropboxHandler(): failures', () => {
  it('reports the reason when Dropbox rejects the request, without the secret', async () => {
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
    for (const raw of ['[]', '{}', JSON.stringify({ access_token: 'a', expires_in: 'soon' })]) {
      const { handler } = setup(() => new Response(raw));
      const response = await handler(post('refresh', { refreshToken: 'x' }));
      expect(await response.json()).toEqual({ error: 'rejected', reason: 'invalid' });
    }
    log.mockRestore();
  });

  it('answers 502 when Dropbox cannot be reached', async () => {
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
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(dropboxAnswer());
    const handler = createDropboxHandler({
      clientId: 'c',
      clientSecret: 's',
      allowedOrigins: [ORIGIN],
    });
    expect((await handler(post('token', code))).status).toBe(200);
    spy.mockRestore();
  });
});
