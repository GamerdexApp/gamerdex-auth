import { createDropboxHandler } from './dropbox';
import { oauthRoute } from './env';

export interface DropboxRouteEnv {
  DROPBOX_CLIENT_ID?: string;
  DROPBOX_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

/** Builds the handler of the Dropbox routes from the environment of the project. */
export const createDropboxRoute = (env: DropboxRouteEnv, fetchImpl?: typeof fetch) =>
  oauthRoute(
    {
      clientId: env.DROPBOX_CLIENT_ID,
      clientSecret: env.DROPBOX_CLIENT_SECRET,
      allowedOrigins: env.ALLOWED_ORIGINS,
    },
    (options) => createDropboxHandler({ ...options, fetch: fetchImpl }),
  );
