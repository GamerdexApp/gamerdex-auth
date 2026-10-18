# gamerdex-auth

A small Vercel project that serves every Gamerdex app. It swaps a sign in code or a refresh token
for tokens. It is the only place that holds a client secret. It keeps no data.

`src/tokenHandler.ts` holds what every provider shares: the origin list, the CORS headers, the
routes, and the logging. Each provider adds one small object that talks to its sign in service:
`src/handler.ts` for GitHub and `src/google.ts` for Google. `src/githubRoute.ts` and
`src/googleRoute.ts` read the environment, and `api/<provider>/[action].ts` exposes the routes. The
project uses `@gamerdexapp/gamerdex-sync` for the public GitHub Client ID (`GITHUB_APP`) and for
`parseTokenResponse`, so the answer of every route and the token source of the apps share one
definition of the token shape.

## Routes

| Route                      | Body                    | Answer                                                       |
| -------------------------- | ----------------------- | ------------------------------------------------------------ |
| `POST /api/github/token`   | `{ code, redirectUri }` | `{ accessToken, expiresIn, refreshToken, refreshExpiresIn }` |
| `POST /api/github/refresh` | `{ refreshToken }`      | The same answer                                              |
| `POST /api/google/token`   | `{ code, redirectUri }` | The same answer                                              |
| `POST /api/google/refresh` | `{ refreshToken }`      | The same answer                                              |

Only the origins in `ALLOWED_ORIGINS` get an answer. Every other origin gets 403. A project that
lacks its secret or its origins answers 500 and calls nothing. A GitHub answer that has no access
token or no refresh token answers 400. A rejected request answers 400
`{ error: "rejected", reason }` with the reason that the provider gave, and the same reason is
logged without any secret.

## Environment

| Variable               | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| `GITHUB_CLIENT_SECRET` | The client secret of the `gamerdex-sync` GitHub App.               |
| `GOOGLE_CLIENT_ID`     | The client ID of the Google Web application OAuth client.          |
| `GOOGLE_CLIENT_SECRET` | The client secret of that Google OAuth client.                     |
| `ALLOWED_ORIGINS`      | The origins of the Gamerdex apps, separated by commas, no slashes. |

Copy `.env.example` to `.env` for local work. Never commit `.env`. Set the same variables in the
Vercel project settings.

## Google

The Google routes send the code and the refresh token to Google as a form. They differ from the
GitHub routes in three ways:

- Google sends a refresh token only with the first agreement, and only when the sign in asked for
  `access_type=offline` and `prompt=consent` (`googleAuthorizeUrl` in `gamerdex-sync` does). A code
  exchange without a refresh token answers 400 `no_refresh_token`.
- A sign in that did not grant the Drive file scope answers 400 `missing_scope`. The consent screen
  lets a player untick it.
- A refresh answer has no new refresh token and no lifetime. The route returns the refresh token
  that it was given, with a lifetime of 180 days from now, because Google ends a refresh token after
  six months without use.

Google setup, in Google Cloud: create a project, create an OAuth client of type Web application, add
the redirect URI of each app (`https://<app host>/sync/callback`, and
`http://localhost:3000/sync/callback` for local work), set the consent screen to External with only
the `drive.file` scope, and publish the app to production. While the app is in Testing, refresh
tokens end after seven days.

## Commands

`pnpm lint`, `pnpm format`, `pnpm test:coverage`.

## Adding a provider

Write a `TokenProvider` (`exchange(request)` returns tokens, a rejection reason, or `unreachable`),
wrap it with `createTokenHandler`, then add a route file (`api/<provider>/[action].ts`) and its
secret variables. A provider that signs in with PKCE and no secret needs no route.
