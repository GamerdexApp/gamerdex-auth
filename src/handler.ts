import { GITHUB_APP, parseTokenResponse } from '@gamerdexapp/gamerdex-sync';

export interface AuthHandlerOptions {
  clientSecret: string;
  /** The origins of the apps that may call the function, such as `https://tracker.example.com`. */
  allowedOrigins: string[];
  fetch?: typeof fetch;
}

const TOKEN_URL = 'https://github.com/login/oauth/access_token';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const reply = (status: number, body: unknown, origin: string | null): Response =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(origin
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            Vary: 'Origin',
          }
        : {}),
    },
  });

/**
 * Builds the function that swaps a sign-in code or a refresh token for tokens. It is the only place
 * that holds the client secret. It answers `POST /token` with `{ code, redirectUri }` and
 * `POST /refresh` with `{ refreshToken }`, only to the allowed origins, and it keeps nothing.
 */
export const createAuthHandler = (options: AuthHandlerOptions) => {
  const send = options.fetch ?? ((...args) => globalThis.fetch(...args));

  const exchange = async (params: Record<string, string>, origin: string): Promise<Response> => {
    let body: unknown;
    try {
      const response = await send(TOKEN_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GITHUB_APP.clientId,
          client_secret: options.clientSecret,
          ...params,
        }),
      });
      body = await response.json();
    } catch {
      return reply(502, { error: 'unreachable' }, origin);
    }
    const tokens = parseTokenResponse(
      isRecord(body)
        ? {
            accessToken: body.access_token,
            expiresIn: body.expires_in,
            refreshToken: body.refresh_token,
            refreshExpiresIn: body.refresh_token_expires_in,
          }
        : null,
    );
    return tokens ? reply(200, tokens, origin) : reply(400, { error: 'rejected' }, origin);
  };

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    if (origin === null || !options.allowedOrigins.includes(origin)) return reply(403, null, null);
    if (request.method === 'OPTIONS') return reply(204, null, origin);
    if (request.method !== 'POST') return reply(405, { error: 'method' }, origin);

    const route = new URL(request.url).pathname.split('/').pop();
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return reply(400, { error: 'body' }, origin);
    }
    if (!isRecord(input)) return reply(400, { error: 'body' }, origin);

    if (
      route === 'token' &&
      typeof input.code === 'string' &&
      typeof input.redirectUri === 'string'
    ) {
      return exchange({ code: input.code, redirect_uri: input.redirectUri }, origin);
    }
    if (route === 'refresh' && typeof input.refreshToken === 'string') {
      return exchange({ grant_type: 'refresh_token', refresh_token: input.refreshToken }, origin);
    }
    return reply(route === 'token' || route === 'refresh' ? 400 : 404, { error: 'body' }, origin);
  };
};
