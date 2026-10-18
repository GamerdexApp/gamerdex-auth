import { createDropboxRoute } from '@/dropboxRoute';

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
