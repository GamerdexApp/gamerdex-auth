# gamerdex-auth

A small Vercel project that serves every Gamerdex app. It swaps a sign in code or a refresh token
for tokens. It is the only place that holds a client secret. It keeps no data.

The handler is in `src/handler.ts` (`createAuthHandler`). `src/githubRoute.ts` reads the environment
and `api/github/[action].ts` exposes the routes. It uses `@gamerdexapp/gamerdex-sync` for the public
Client ID (`GITHUB_APP`) and for `parseTokenResponse`, so the answer of the routes and the token
source of the apps share one definition of the token shape.

## Routes

| Route                      | Body                    | Answer                                                       |
| -------------------------- | ----------------------- | ------------------------------------------------------------ |
| `POST /api/github/token`   | `{ code, redirectUri }` | `{ accessToken, expiresIn, refreshToken, refreshExpiresIn }` |
| `POST /api/github/refresh` | `{ refreshToken }`      | The same answer                                              |

Only the origins in `ALLOWED_ORIGINS` get an answer. Every other origin gets 403. A project that
lacks its secret or its origins answers 500 and calls nothing. A GitHub answer that has no access
token or no refresh token answers 400.

## Environment

| Variable               | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| `GITHUB_CLIENT_SECRET` | The client secret of the `gamerdex-sync` GitHub App.               |
| `ALLOWED_ORIGINS`      | The origins of the Gamerdex apps, separated by commas, no slashes. |

Copy `.env.example` to `.env` for local work. Never commit `.env`. Set the same variables in the
Vercel project settings.

## Commands

`pnpm lint`, `pnpm format`, `pnpm test:coverage`.

## Adding a provider

Add a route folder (`api/<provider>/[action].ts`), a secret variable and a provider setting for the
handler. A provider that signs in with PKCE and no secret needs no route.

## Not done yet

- The project is not deployed and has no remote.
