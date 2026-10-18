export const misconfigured = () =>
  new Response(JSON.stringify({ error: 'misconfigured' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Reads the comma separated list of allowed origins. Blank entries are dropped. */
export const parseOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');

export interface OAuthRouteEnv {
  clientId: string | undefined;
  clientSecret: string | undefined;
  allowedOrigins: string | undefined;
}

/**
 * Builds the route of a provider that has a client ID and a client secret. A project that lacks
 * one of them, or the allowed origins, answers 500 and calls nothing.
 */
export const oauthRoute = <Handler extends (request: Request) => Promise<Response>>(
  env: OAuthRouteEnv,
  build: (options: { clientId: string; clientSecret: string; allowedOrigins: string[] }) => Handler,
): ((request: Request) => Promise<Response>) => {
  const allowedOrigins = parseOrigins(env.allowedOrigins);
  if (!env.clientId || !env.clientSecret || allowedOrigins.length === 0) {
    return async () => misconfigured();
  }
  return build({ clientId: env.clientId, clientSecret: env.clientSecret, allowedOrigins });
};
