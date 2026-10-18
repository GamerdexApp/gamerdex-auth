import { misconfigured, parseOrigins } from './env';
import { createGoogleHandler } from './google';

export interface GoogleRouteEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

/** Builds the handler of the Google routes from the environment of the project. */
export const createGoogleRoute = (env: GoogleRouteEnv, fetchImpl?: typeof fetch) => {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const allowedOrigins = parseOrigins(env.ALLOWED_ORIGINS);
  if (!clientId || !clientSecret || allowedOrigins.length === 0) return async () => misconfigured();
  return createGoogleHandler({ clientId, clientSecret, allowedOrigins, fetch: fetchImpl });
};
