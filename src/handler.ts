import { GITHUB_APP, parseTokenResponse } from '@gamerdexapp/gamerdex-sync';
import { createTokenHandler, ExchangeRequest, ExchangeResult, isRecord } from './tokenHandler';

export interface AuthHandlerOptions {
  clientSecret: string;
  /** The origins of the apps that may call the function, such as `https://tracker.example.com`. */
  allowedOrigins: string[];
  fetch?: typeof fetch;
}

const TOKEN_URL = 'https://github.com/login/oauth/access_token';

const githubExchange =
  (options: AuthHandlerOptions) =>
  async (request: ExchangeRequest): Promise<ExchangeResult> => {
    const send = options.fetch ?? ((...args) => globalThis.fetch(...args));
    const params =
      request.kind === 'code'
        ? { code: request.code, redirect_uri: request.redirectUri }
        : { grant_type: 'refresh_token', refresh_token: request.refreshToken };
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
      return { kind: 'unreachable' };
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
    if (tokens) return { kind: 'tokens', tokens };
    const reason = isRecord(body) && typeof body.error === 'string' ? body.error : 'invalid';
    return { kind: 'rejected', reason };
  };

/** Builds the handler of the GitHub routes. It is the only place that holds the GitHub secret. */
export const createAuthHandler = (options: AuthHandlerOptions) =>
  createTokenHandler({
    allowedOrigins: options.allowedOrigins,
    provider: { name: 'GitHub', exchange: githubExchange(options) },
  });
