import { ExchangeRequest, isRecord } from './tokenHandler';

export type FormAnswer =
  | { kind: 'answer'; body: Record<string, unknown> }
  | { kind: 'rejected'; reason: string }
  | { kind: 'unreachable' };

/** The form fields that name the grant of a sign in code or of a refresh token. */
export const grantForm = (request: ExchangeRequest): Record<string, string> =>
  request.kind === 'code'
    ? { grant_type: 'authorization_code', code: request.code, redirect_uri: request.redirectUri }
    : { grant_type: 'refresh_token', refresh_token: request.refreshToken };

/**
 * Sends a form to the token address of a provider and reads the answer. A provider refuses a
 * request with an `error` code in the body.
 */
export const postTokenForm = async (
  url: string,
  form: Record<string, string>,
  send: typeof fetch,
): Promise<FormAnswer> => {
  let body: unknown;
  try {
    const response = await send(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    body = await response.json();
  } catch {
    return { kind: 'unreachable' };
  }
  if (!isRecord(body)) return { kind: 'rejected', reason: 'invalid' };
  if (typeof body.error === 'string') return { kind: 'rejected', reason: body.error };
  return { kind: 'answer', body };
};

/** The scopes of a token answer, as the provider wrote them. */
export const grantedScopes = (body: Record<string, unknown>): string[] =>
  typeof body.scope === 'string' ? body.scope.split(' ') : [];
