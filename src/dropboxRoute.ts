import { CLIENT_IDS } from '@gamerdexapp/gamerdex-sync';
import { createDropboxHandler } from './dropbox';
import { oauthRoute } from './env';

export interface DropboxRouteEnv {
  DROPBOX_CLIENT_ID?: string;
  DROPBOX_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

/**
 * Builds the handler of the Dropbox routes from the environment of the project. The client ID is the
 * default of `gamerdex-sync` unless `DROPBOX_CLIENT_ID` replaces it, and an empty value makes the
 * routes answer 500.
 */
export const createDropboxRoute = (env: DropboxRouteEnv, fetchImpl?: typeof fetch) =>
  oauthRoute(
    {
      clientId: env.DROPBOX_CLIENT_ID ?? CLIENT_IDS.dropbox,
      clientSecret: env.DROPBOX_CLIENT_SECRET,
      allowedOrigins: env.ALLOWED_ORIGINS,
    },
    (options) => createDropboxHandler({ ...options, fetch: fetchImpl }),
  );
