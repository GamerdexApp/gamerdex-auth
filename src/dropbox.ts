import { DROPBOX_SCOPES, parseTokenResponse } from '@gamerdexapp/gamerdex-sync';
import { grantedScopes, grantForm, postTokenForm } from './oauthForm';
import { createTokenHandler, ExchangeRequest, ExchangeResult } from './tokenHandler';

export interface DropboxHandlerOptions {
  /** The app key of the Dropbox app. */
  clientId: string;
  /** The app secret of the Dropbox app. */
  clientSecret: string;
  /** The origins of the apps that may call the function, such as `https://tracker.example.com`. */
  allowedOrigins: string[];
  fetch?: typeof fetch;
}

const TOKEN_URL = 'https://api.dropbox.com/oauth2/token';

/**
 * A Dropbox refresh token does not expire until the player removes the access, and the refresh
 * answer carries no new one. The apps count 180 days from the last refresh, as they do for Google.
 */
export const DROPBOX_REFRESH_LIFETIME_SECONDS = 15_552_000;

const dropboxExchange =
  (options: DropboxHandlerOptions) =>
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
      const granted = grantedScopes(body);
      if (!DROPBOX_SCOPES.every((scope) => granted.includes(scope))) {
        return { kind: 'rejected', reason: 'missing_scope' };
      }
    }
    const tokens = parseTokenResponse({
      accessToken: body.access_token,
      expiresIn: body.expires_in,
      refreshToken,
      refreshExpiresIn: DROPBOX_REFRESH_LIFETIME_SECONDS,
    });
    return tokens ? { kind: 'tokens', tokens } : { kind: 'rejected', reason: 'invalid' };
  };

/**
 * Builds the handler of the Dropbox routes. It sends the code and the refresh token to Dropbox as
 * a form, answers with the same token shape as the other routes, and refuses a sign in that gave no
 * refresh token or did not grant both file scopes.
 */
export const createDropboxHandler = (options: DropboxHandlerOptions) =>
  createTokenHandler({
    allowedOrigins: options.allowedOrigins,
    provider: { name: 'Dropbox', exchange: dropboxExchange(options) },
  });
