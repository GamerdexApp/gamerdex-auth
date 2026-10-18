import { createGoogleHandler } from '@/google';
import { createAuthHandler } from '@/handler';
import { createTokenSource, type StoredTokens } from '@gamerdexapp/gamerdex-sync';

const ORIGIN = 'https://tracker.test';

const github = (async () =>
  new Response(
    JSON.stringify({
      access_token: 'at-1',
      expires_in: 28800,
      refresh_token: 'rt-1',
      refresh_token_expires_in: 15552000,
    }),
  )) as unknown as typeof fetch;

const handler = createAuthHandler({ clientSecret: 's', allowedOrigins: [ORIGIN], fetch: github });

const toHandler = (async (url: string, init: RequestInit) =>
  handler(
    new Request(url, { ...init, headers: { ...(init.headers as object), Origin: ORIGIN } }),
  )) as unknown as typeof fetch;

describe('the token source of gamerdex-sync against this handler', () => {
  it('signs in and renews with the answers of the handler', async () => {
    let stored: StoredTokens | null = null;
    let now = 1_000;
    const source = createTokenSource({
      endpoint: 'https://auth.test/api/github',
      load: () => stored,
      save: (tokens) => {
        stored = tokens;
      },
      now: () => now,
      fetch: toHandler,
    });

    const tokens = await source.signIn('code-1', 'https://tracker.test/sync/callback');
    expect(tokens).toEqual({
      accessToken: 'at-1',
      accessExpiresAt: 1_000 + 28_800_000,
      refreshToken: 'rt-1',
      refreshExpiresAt: 1_000 + 15_552_000_000,
    });
    expect(await source.getToken()).toBe('at-1');

    now += 28_800_000;
    expect(await source.getToken()).toBe('at-1');
    expect(stored).toMatchObject({ accessExpiresAt: now + 28_800_000 });
  });

  it('is refused for an origin that is not allowed', async () => {
    const source = createTokenSource({
      endpoint: 'https://auth.test/api/github',
      load: () => null,
      save: () => undefined,
      now: () => 0,
      fetch: (async (url: string, init: RequestInit) =>
        handler(
          new Request(url, { ...init, headers: { Origin: 'https://evil.test' } }),
        )) as unknown as typeof fetch,
    });
    await expect(source.signIn('c', 'r')).rejects.toMatchObject({ kind: 'auth' });
  });
});

describe('the token source of gamerdex-sync against the Google handler', () => {
  const googleFetch = (async (_url: string, init: RequestInit) => {
    const form = new URLSearchParams(String(init.body));
    const body =
      form.get('grant_type') === 'authorization_code'
        ? {
            access_token: 'at-g1',
            expires_in: 3599,
            refresh_token: 'rt-g',
            scope: 'https://www.googleapis.com/auth/drive.file',
          }
        : { access_token: 'at-g2', expires_in: 3599 };
    return new Response(JSON.stringify(body));
  }) as unknown as typeof fetch;

  const handler = createGoogleHandler({
    clientId: 'id',
    clientSecret: 's',
    allowedOrigins: [ORIGIN],
    fetch: googleFetch,
  });

  const toHandler = (async (url: string, init: RequestInit) =>
    handler(
      new Request(url, { ...init, headers: { ...(init.headers as object), Origin: ORIGIN } }),
    )) as unknown as typeof fetch;

  it('signs in and renews, keeping the refresh token that Google sent once', async () => {
    let stored: StoredTokens | null = null;
    let now = 1_000;
    const source = createTokenSource({
      endpoint: 'https://auth.test/api/google',
      load: () => stored,
      save: (tokens) => {
        stored = tokens;
      },
      now: () => now,
      fetch: toHandler,
    });

    await source.signIn('code-1', 'https://tracker.test/sync/callback');
    expect(await source.getToken()).toBe('at-g1');

    now += 3_540_000;
    expect(await source.getToken()).toBe('at-g2');
    expect(stored).toMatchObject({ refreshToken: 'rt-g', accessExpiresAt: now + 3_599_000 });
  });
});
