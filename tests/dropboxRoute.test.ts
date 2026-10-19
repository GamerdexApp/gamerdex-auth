import { createDropboxRoute } from '@/dropboxRoute';
import { CLIENT_IDS } from '@gamerdexapp/gamerdex-sync';

const ORIGIN = 'https://tracker.test';
const request = (origin = ORIGIN) =>
  new Request('https://auth.test/api/dropbox/token', {
    method: 'POST',
    headers: { Origin: origin },
    body: JSON.stringify({ code: 'c', redirectUri: 'https://tracker.test/sync/callback' }),
  });

const provider = (async () =>
  new Response(
    JSON.stringify({
      access_token: 'at',
      expires_in: 3599,
      refresh_token: 'rt',
      scope: 'files.content.read files.content.write Files.ReadWrite.AppFolder',
    }),
  )) as unknown as typeof fetch;

describe('createDropboxRoute()', () => {
  it('answers an allowed origin with tokens', async () => {
    const handle = createDropboxRoute(
      {
        DROPBOX_CLIENT_ID: 'id',
        DROPBOX_CLIENT_SECRET: 's',
        ALLOWED_ORIGINS: `http://localhost:3000, ${ORIGIN}`,
      },
      provider,
    );
    const response = await handle(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
  });

  it('refuses an origin that is not in the list', async () => {
    const handle = createDropboxRoute(
      { DROPBOX_CLIENT_ID: 'id', DROPBOX_CLIENT_SECRET: 's', ALLOWED_ORIGINS: ORIGIN },
      provider,
    );
    expect((await handle(request('https://evil.test'))).status).toBe(403);
  });

  it('answers 500 when the client id, the secret or the origins are missing', async () => {
    const full = { DROPBOX_CLIENT_ID: 'id', DROPBOX_CLIENT_SECRET: 's', ALLOWED_ORIGINS: ORIGIN };
    const broken = [
      {},
      { ...full, DROPBOX_CLIENT_ID: '' },
      { ...full, DROPBOX_CLIENT_SECRET: undefined },
      { ...full, ALLOWED_ORIGINS: ' , ' },
    ];
    for (const env of broken) {
      const response = await createDropboxRoute(env, provider)(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'misconfigured' });
    }
  });
});

describe('createDropboxRoute(): client ID', () => {
  const sentClientId = async (env: Record<string, string>) => {
    let sent: string | null = null;
    const spy = (async (_url: string, init: RequestInit) => {
      sent = new URLSearchParams(String(init.body)).get('client_id');
      return provider(_url, init);
    }) as unknown as typeof fetch;
    const handle = createDropboxRoute(
      { DROPBOX_CLIENT_SECRET: 's', ALLOWED_ORIGINS: ORIGIN, ...env },
      spy,
    );
    expect((await handle(request())).status).toBe(200);
    return sent;
  };

  it('uses the client ID of the sync package when none is set', async () => {
    expect(await sentClientId({})).toBe(CLIENT_IDS.dropbox);
  });

  it('uses the client ID of the environment instead of the default', async () => {
    expect(await sentClientId({ DROPBOX_CLIENT_ID: 'other-id' })).toBe('other-id');
  });
});
