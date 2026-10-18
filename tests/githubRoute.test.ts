import { createGitHubRoute } from '@/githubRoute';

const ORIGIN = 'https://tracker.test';
const request = (origin = ORIGIN) =>
  new Request('https://auth.test/api/github/token', {
    method: 'POST',
    headers: { Origin: origin },
    body: JSON.stringify({ code: 'c', redirectUri: 'https://tracker.test/sync/callback' }),
  });

const github = (async () =>
  new Response(
    JSON.stringify({
      access_token: 'at',
      expires_in: 28800,
      refresh_token: 'rt',
      refresh_token_expires_in: 15552000,
    }),
  )) as unknown as typeof fetch;

describe('createGitHubRoute()', () => {
  it('answers an allowed origin with tokens', async () => {
    const handle = createGitHubRoute(
      { GITHUB_CLIENT_SECRET: 's', ALLOWED_ORIGINS: `http://localhost:3000, ${ORIGIN}` },
      github,
    );
    const response = await handle(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
  });

  it('refuses an origin that is not in the list', async () => {
    const handle = createGitHubRoute(
      { GITHUB_CLIENT_SECRET: 's', ALLOWED_ORIGINS: ORIGIN },
      github,
    );
    expect((await handle(request('https://evil.test'))).status).toBe(403);
  });

  it('answers 500 and calls nothing when the secret or the origins are missing', async () => {
    for (const env of [
      {},
      { GITHUB_CLIENT_SECRET: 's' },
      { GITHUB_CLIENT_SECRET: 's', ALLOWED_ORIGINS: ' , ' },
      { ALLOWED_ORIGINS: ORIGIN },
    ]) {
      const response = await createGitHubRoute(env, github)(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'misconfigured' });
    }
  });
});
