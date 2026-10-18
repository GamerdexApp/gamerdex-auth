import { createMicrosoftHandler, MICROSOFT_REFRESH_LIFETIME_SECONDS } from '@/microsoft';

const ORIGIN = 'https://tracker.test';
const SECRET = 'microsoft-secret-1';

interface Call {
  url: string;
  headers: Record<string, string>;
  form: Record<string, string>;
}

const microsoftAnswer = (extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      access_token: 'at-m',
      expires_in: 3599,
      refresh_token: 'rt-m',
      scope: 'Files.ReadWrite.AppFolder',
      token_type: 'Bearer',
      id_token: 'must-not-leak',
      ...extra,
    }),
  );

const setup = (answer: () => Response | Promise<Response> = () => microsoftAnswer()) => {
  const calls: Call[] = [];
  const fetchStub = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      form: Object.fromEntries(new URLSearchParams(String(init.body))),
    });
    return answer();
  }) as unknown as typeof fetch;
  const handler = createMicrosoftHandler({
    clientId: 'app-id-1',
    clientSecret: SECRET,
    allowedOrigins: [ORIGIN],
    fetch: fetchStub,
  });
  return { handler, calls };
};

const post = (path: string, body: unknown, origin: string | null = ORIGIN) =>
  new Request(`https://auth.test/api/microsoft/${path}`, {
    method: 'POST',
    headers: origin ? { Origin: origin, 'Content-Type': 'application/json' } : {},
    body: JSON.stringify(body),
  });

const code = { code: 'c1', redirectUri: 'https://tracker.test/sync/callback' };

describe('createMicrosoftHandler(): sign in code', () => {
  it('sends the code to the consumer endpoint as a form with the id, secret and scope', async () => {
    const { handler, calls } = setup();
    const response = await handler(post('token', code));
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      {
        url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        form: {
          client_id: 'app-id-1',
          client_secret: SECRET,
          scope: 'Files.ReadWrite.AppFolder offline_access',
          grant_type: 'authorization_code',
          code: 'c1',
          redirect_uri: 'https://tracker.test/sync/callback',
        },
      },
    ]);
  });

  it('answers with the shared token shape and nothing else from Microsoft', async () => {
    const { handler } = setup();
    const response = await handler(post('token', code));
    expect(await response.json()).toEqual({
      accessToken: 'at-m',
      expiresIn: 3599,
      refreshToken: 'rt-m',
      refreshExpiresIn: MICROSOFT_REFRESH_LIFETIME_SECONDS,
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses a sign in that gave no refresh token', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { handler } = setup(() => microsoftAnswer({ refresh_token: undefined }));
    const response = await handler(post('token', code));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'rejected', reason: 'no_refresh_token' });
    expect(log).toHaveBeenCalledWith('Microsoft rejected the token request: no_refresh_token');
    log.mockRestore();
  });

  it('refuses a sign in that did not grant the app folder scope', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const scope of ['User.Read', 'Files.ReadWrite', undefined, 5]) {
      const { handler } = setup(() => microsoftAnswer({ scope }));
      const response = await handler(post('token', code));
      expect(await response.json()).toEqual({ error: 'rejected', reason: 'missing_scope' });
    }
    log.mockRestore();
  });

  it.each([
    'Files.ReadWrite.AppFolder',
    'files.readwrite.appfolder User.Read',
    'https://graph.microsoft.com/Files.ReadWrite.AppFolder',
  ])('accepts the app folder scope written as %s', async (scope) => {
    const { handler } = setup(() => microsoftAnswer({ scope }));
    expect((await handler(post('token', code))).status).toBe(200);
  });
});

describe('createMicrosoftHandler(): refresh token', () => {
  const rotated = () =>
    new Response(
      JSON.stringify({ access_token: 'at-new', expires_in: 3599, refresh_token: 'rt-new' }),
    );

  it('sends the refresh token as a form with the scope', async () => {
    const { handler, calls } = setup(rotated);
    await handler(post('refresh', { refreshToken: 'rt-old' }));
    expect(calls[0].form).toEqual({
      client_id: 'app-id-1',
      client_secret: SECRET,
      scope: 'Files.ReadWrite.AppFolder offline_access',
      grant_type: 'refresh_token',
      refresh_token: 'rt-old',
    });
  });

  it('returns the new refresh token that Microsoft sent, with a new lifetime', async () => {
    const { handler } = setup(rotated);
    const response = await handler(post('refresh', { refreshToken: 'rt-old' }));
    expect(await response.json()).toEqual({
      accessToken: 'at-new',
      expiresIn: 3599,
      refreshToken: 'rt-new',
      refreshExpiresIn: MICROSOFT_REFRESH_LIFETIME_SECONDS,
    });
  });

  it('keeps the old refresh token when Microsoft sent no new one', async () => {
    const { handler } = setup(
      () => new Response(JSON.stringify({ access_token: 'at-new', expires_in: 3599 })),
    );
    const response = await handler(post('refresh', { refreshToken: 'rt-old' }));
    expect(await response.json()).toMatchObject({ refreshToken: 'rt-old' });
  });
});

describe('createMicrosoftHandler(): failures', () => {
  it('reports the reason when Microsoft rejects the request, without the secret', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { handler } = setup(
      () =>
        new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'AADSTS70000' }), {
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

  it('answers 502 when Microsoft cannot be reached', async () => {
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
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(microsoftAnswer());
    const handler = createMicrosoftHandler({
      clientId: 'c',
      clientSecret: 's',
      allowedOrigins: [ORIGIN],
    });
    expect((await handler(post('token', code))).status).toBe(200);
    spy.mockRestore();
  });
});
