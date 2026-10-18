import { createAuthHandler } from 'gamerdex-sync';

export interface GitHubRouteEnv {
  GITHUB_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

const misconfigured = () =>
  new Response(JSON.stringify({ error: 'misconfigured' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Builds the handler of the GitHub routes from the environment of the project. */
export const createGitHubRoute = (env: GitHubRouteEnv, fetchImpl?: typeof fetch) => {
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  if (!clientSecret || allowedOrigins.length === 0) return async () => misconfigured();
  return createAuthHandler({ clientSecret, allowedOrigins, fetch: fetchImpl });
};
