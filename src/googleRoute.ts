import { CLIENT_IDS } from '@gamerdexapp/gamerdex-sync';
import { oauthRoute } from './env';
import { createGoogleHandler } from './google';

export interface GoogleRouteEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

/**
 * Builds the handler of the Google routes from the environment of the project. The client ID is the
 * default of `gamerdex-sync` unless `GOOGLE_CLIENT_ID` replaces it, and an empty value makes the
 * routes answer 500.
 */
export const createGoogleRoute = (env: GoogleRouteEnv, fetchImpl?: typeof fetch) =>
  oauthRoute(
    {
      clientId: env.GOOGLE_CLIENT_ID ?? CLIENT_IDS.google,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowedOrigins: env.ALLOWED_ORIGINS,
    },
    (options) => createGoogleHandler({ ...options, fetch: fetchImpl }),
  );
