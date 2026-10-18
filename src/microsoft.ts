import {
  ONEDRIVE_FILE_SCOPE,
  ONEDRIVE_SCOPES,
  parseTokenResponse,
} from '@gamerdexapp/gamerdex-sync';
import { grantedScopes, grantForm, postTokenForm } from './oauthForm';
import { createTokenHandler, ExchangeRequest, ExchangeResult } from './tokenHandler';

export interface MicrosoftHandlerOptions {
  /** The application (client) ID of the Microsoft app registration. */
  clientId: string;
  /** A client secret of that app registration. */
  clientSecret: string;
  /** The origins of the apps that may call the function, such as `https://tracker.example.com`. */
  allowedOrigins: string[];
  fetch?: typeof fetch;
}

const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';

/**
 * A Microsoft refresh token ends after 90 days without use. Every refresh answers with a new
 * refresh token, so the apps count 80 days from the last refresh.
 */
export const MICROSOFT_REFRESH_LIFETIME_SECONDS = 6_912_000;

const isFileScope = (scope: string): boolean =>
  scope.split('/').pop()?.toLowerCase() === ONEDRIVE_FILE_SCOPE.toLowerCase();

const microsoftExchange =
  (options: MicrosoftHandlerOptions) =>
  async (request: ExchangeRequest): Promise<ExchangeResult> => {
    const answer = await postTokenForm(
      TOKEN_URL,
      {
        client_id: options.clientId,
        client_secret: options.clientSecret,
        scope: ONEDRIVE_SCOPES.join(' '),
        ...grantForm(request),
      },
      options.fetch ?? ((...args) => globalThis.fetch(...args)),
    );
    if (answer.kind !== 'answer') return answer;
    const { body } = answer;

    const refreshToken =
      typeof body.refresh_token === 'string'
        ? body.refresh_token
        : request.kind === 'refresh'
          ? request.refreshToken
          : undefined;
    if (request.kind === 'code') {
      if (refreshToken === undefined) return { kind: 'rejected', reason: 'no_refresh_token' };
      if (!grantedScopes(body).some(isFileScope)) {
        return { kind: 'rejected', reason: 'missing_scope' };
      }
    }
    const tokens = parseTokenResponse({
      accessToken: body.access_token,
      expiresIn: body.expires_in,
      refreshToken,
      refreshExpiresIn: MICROSOFT_REFRESH_LIFETIME_SECONDS,
    });
    return tokens ? { kind: 'tokens', tokens } : { kind: 'rejected', reason: 'invalid' };
  };

/**
 * Builds the handler of the Microsoft routes. It sends the code and the refresh token to Microsoft
 * as a form, answers with the same token shape as the other routes, keeps the refresh token that
 * Microsoft sends with every answer, and refuses a sign in that gave no refresh token or did not
 * grant the app folder scope.
 */
export const createMicrosoftHandler = (options: MicrosoftHandlerOptions) =>
  createTokenHandler({
    allowedOrigins: options.allowedOrigins,
    provider: { name: 'Microsoft', exchange: microsoftExchange(options) },
  });
