import { CLIENT_IDS } from '@gamerdexapp/gamerdex-sync';
import { oauthRoute } from './env';
import { createMicrosoftHandler } from './microsoft';

export interface MicrosoftRouteEnv {
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

/**
 * Builds the handler of the Microsoft routes from the environment of the project. The client ID is the
 * default of `gamerdex-sync` unless `MICROSOFT_CLIENT_ID` replaces it, and an empty value makes the
 * routes answer 500.
 */
export const createMicrosoftRoute = (env: MicrosoftRouteEnv, fetchImpl?: typeof fetch) =>
  oauthRoute(
    {
      clientId: env.MICROSOFT_CLIENT_ID ?? CLIENT_IDS.microsoft,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      allowedOrigins: env.ALLOWED_ORIGINS,
    },
    (options) => createMicrosoftHandler({ ...options, fetch: fetchImpl }),
  );
