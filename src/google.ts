import { GOOGLE_DRIVE_SCOPE, parseTokenResponse } from '@gamerdexapp/gamerdex-sync';
import { grantedScopes, grantForm, postTokenForm } from './oauthForm';
import { createTokenHandler, ExchangeRequest, ExchangeResult } from './tokenHandler';

export interface GoogleHandlerOptions {
  clientId: string;
  clientSecret: string;
  /** The origins of the apps that may call the function, such as `https://tracker.example.com`. */
  allowedOrigins: string[];
  fetch?: typeof fetch;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Google refresh tokens have no lifetime in the answer. They end when they are unused for six
 * months, and every refresh uses them. The apps count 180 days from the last refresh.
 */
export const GOOGLE_REFRESH_LIFETIME_SECONDS = 15_552_000;

const googleExchange =
  (options: GoogleHandlerOptions) =>
  async (request: ExchangeRequest): Promise<ExchangeResult> => {
    const answer = await postTokenForm(
      TOKEN_URL,
      { client_id: options.clientId, client_secret: options.clientSecret, ...grantForm(request) },
      options.fetch ?? ((...args) => globalThis.fetch(...args)),
    );
    if (answer.kind !== 'answer') return answer;
    const { body } = answer;

    const refreshToken = request.kind === 'refresh' ? request.refreshToken : body.refresh_token;
    if (request.kind === 'code') {
      if (typeof refreshToken !== 'string') return { kind: 'rejected', reason: 'no_refresh_token' };
      if (!grantedScopes(body).includes(GOOGLE_DRIVE_SCOPE)) {
        return { kind: 'rejected', reason: 'missing_scope' };
      }
    }
    const tokens = parseTokenResponse({
      accessToken: body.access_token,
      expiresIn: body.expires_in,
      refreshToken,
      refreshExpiresIn: GOOGLE_REFRESH_LIFETIME_SECONDS,
    });
    return tokens ? { kind: 'tokens', tokens } : { kind: 'rejected', reason: 'invalid' };
  };

/**
 * Builds the handler of the Google routes. It sends the code and the refresh token to Google as a
 * form, answers with the same token shape as the GitHub routes, and refuses a sign in that gave no
 * refresh token or did not grant the Drive file scope.
 */
export const createGoogleHandler = (options: GoogleHandlerOptions) =>
  createTokenHandler({
    allowedOrigins: options.allowedOrigins,
    provider: { name: 'Google', exchange: googleExchange(options) },
  });
