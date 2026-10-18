import type { TokenResponse } from '@gamerdexapp/gamerdex-sync';

export type ExchangeRequest =
  { kind: 'code'; code: string; redirectUri: string } | { kind: 'refresh'; refreshToken: string };

export type ExchangeResult =
  | { kind: 'tokens'; tokens: TokenResponse }
  | { kind: 'rejected'; reason: string }
  | { kind: 'unreachable' };

/** Talks to one sign in provider. It is the only code that sends the client secret. */
export interface TokenProvider {
  /** The name of the provider, for the logs. */
  name: string;
  exchange(request: ExchangeRequest): Promise<ExchangeResult>;
}

export interface TokenHandlerOptions {
  /** The origins of the apps that may call the function, such as `https://tracker.example.com`. */
  allowedOrigins: string[];
  provider: TokenProvider;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
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
 * Builds the function that swaps a sign in code or a refresh token for tokens. It answers
 * `POST /token` with `{ code, redirectUri }` and `POST /refresh` with `{ refreshToken }`, only to
 * the allowed origins, and it keeps nothing.
 */
export const createTokenHandler = ({ allowedOrigins, provider }: TokenHandlerOptions) => {
  const exchange = async (request: ExchangeRequest, origin: string): Promise<Response> => {
    const result = await provider.exchange(request);
    if (result.kind === 'tokens') return reply(200, result.tokens, origin);
    if (result.kind === 'unreachable') return reply(502, { error: 'unreachable' }, origin);
    console.error(`${provider.name} rejected the token request: ${result.reason}`);
    return reply(400, { error: 'rejected', reason: result.reason }, origin);
  };

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    if (origin === null || !allowedOrigins.includes(origin)) return reply(403, null, null);
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
      return exchange({ kind: 'code', code: input.code, redirectUri: input.redirectUri }, origin);
    }
    if (route === 'refresh' && typeof input.refreshToken === 'string') {
      return exchange({ kind: 'refresh', refreshToken: input.refreshToken }, origin);
    }
    return reply(route === 'token' || route === 'refresh' ? 400 : 404, { error: 'body' }, origin);
  };
};
