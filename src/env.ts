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
