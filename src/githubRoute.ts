import { misconfigured, parseOrigins } from './env';
import { createAuthHandler } from './handler';

export interface GitHubRouteEnv {
  GITHUB_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

/** Builds the handler of the GitHub routes from the environment of the project. */
export const createGitHubRoute = (env: GitHubRouteEnv, fetchImpl?: typeof fetch) => {
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const allowedOrigins = parseOrigins(env.ALLOWED_ORIGINS);
  if (!clientSecret || allowedOrigins.length === 0) return async () => misconfigured();
  return createAuthHandler({ clientSecret, allowedOrigins, fetch: fetchImpl });
};
