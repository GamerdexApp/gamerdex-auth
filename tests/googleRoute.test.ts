import { createGoogleRoute } from '@/googleRoute';
import { CLIENT_IDS } from '@gamerdexapp/gamerdex-sync';

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

describe('createGoogleRoute(): client ID', () => {
  const sentClientId = async (env: Record<string, string>) => {
    let sent: string | null = null;
    const spy = (async (_url: string, init: RequestInit) => {
      sent = new URLSearchParams(String(init.body)).get('client_id');
      return google(_url, init);
    }) as unknown as typeof fetch;
    const handle = createGoogleRoute(
      { GOOGLE_CLIENT_SECRET: 's', ALLOWED_ORIGINS: ORIGIN, ...env },
      spy,
    );
    expect((await handle(request())).status).toBe(200);
    return sent;
  };

  it('uses the client ID of the sync package when none is set', async () => {
    expect(await sentClientId({})).toBe(CLIENT_IDS.google);
  });

  it('uses the client ID of the environment instead of the default', async () => {
    expect(await sentClientId({ GOOGLE_CLIENT_ID: 'other-id' })).toBe('other-id');
  });
});
