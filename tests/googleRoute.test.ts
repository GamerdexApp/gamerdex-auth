import { createGoogleRoute } from '@/googleRoute';

const ORIGIN = 'https://tracker.test';
const request = (origin = ORIGIN) =>
  new Request('https://auth.test/api/google/token', {
    method: 'POST',
    headers: { Origin: origin },
    body: JSON.stringify({ code: 'c', redirectUri: 'https://tracker.test/sync/callback' }),
  });

const google = (async () =>
  new Response(
    JSON.stringify({
      access_token: 'at',
      expires_in: 3599,
      refresh_token: 'rt',
      scope: 'https://www.googleapis.com/auth/drive.file',
    }),
  )) as unknown as typeof fetch;

describe('createGoogleRoute()', () => {
  it('answers an allowed origin with tokens', async () => {
    const handle = createGoogleRoute(
      {
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 's',
        ALLOWED_ORIGINS: `http://localhost:3000, ${ORIGIN}`,
      },
      google,
    );
    const response = await handle(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
  });

  it('refuses an origin that is not in the list', async () => {
    const handle = createGoogleRoute(
      { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', ALLOWED_ORIGINS: ORIGIN },
      google,
    );
    expect((await handle(request('https://evil.test'))).status).toBe(403);
  });

  it('answers 500 when the client id, the secret or the origins are missing', async () => {
    const full = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', ALLOWED_ORIGINS: ORIGIN };
    const broken = [
      {},
      { ...full, GOOGLE_CLIENT_ID: '' },
      { ...full, GOOGLE_CLIENT_SECRET: undefined },
      { ...full, ALLOWED_ORIGINS: ' , ' },
    ];
    for (const env of broken) {
      const response = await createGoogleRoute(env, google)(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'misconfigured' });
    }
  });
});
