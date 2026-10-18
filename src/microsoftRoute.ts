import { oauthRoute } from './env';
import { createMicrosoftHandler } from './microsoft';

export interface MicrosoftRouteEnv {
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

/** Builds the handler of the Microsoft routes from the environment of the project. */
export const createMicrosoftRoute = (env: MicrosoftRouteEnv, fetchImpl?: typeof fetch) =>
  oauthRoute(
    {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      allowedOrigins: env.ALLOWED_ORIGINS,
    },
    (options) => createMicrosoftHandler({ ...options, fetch: fetchImpl }),
  );
