import { oauthRoute } from './env';
import { createGoogleHandler } from './google';

export interface GoogleRouteEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

/** Builds the handler of the Google routes from the environment of the project. */
export const createGoogleRoute = (env: GoogleRouteEnv, fetchImpl?: typeof fetch) =>
  oauthRoute(
    {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowedOrigins: env.ALLOWED_ORIGINS,
    },
    (options) => createGoogleHandler({ ...options, fetch: fetchImpl }),
  );
