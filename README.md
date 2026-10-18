# gamerdex-auth

A small Vercel project that serves every Gamerdex app. It swaps a sign in code or a refresh token
for tokens. It is the only place that holds a client secret. It keeps no data.

`src/tokenHandler.ts` holds what every provider shares: the origin list, the CORS headers, the
routes, and the logging. Each provider adds one small object that talks to its sign in service:
`src/handler.ts` for GitHub, and `src/google.ts`, `src/dropbox.ts` and `src/microsoft.ts` for the
providers that take a form (`src/oauthForm.ts` sends it). `src/githubRoute.ts` and the other
`src/<provider>Route.ts` files read the environment, and `api/<provider>/[action].ts` exposes the
routes. The project uses `@gamerdexapp/gamerdex-sync` for the public GitHub Client ID (`GITHUB_APP`)
and for `parseTokenResponse`, so the answer of every route and the token source of the apps share
one definition of the token shape.

## Routes

| Route                         | Body                    | Answer                                                       |
| ----------------------------- | ----------------------- | ------------------------------------------------------------ |
| `POST /api/github/token`      | `{ code, redirectUri }` | `{ accessToken, expiresIn, refreshToken, refreshExpiresIn }` |
| `POST /api/github/refresh`    | `{ refreshToken }`      | The same answer                                              |
| `POST /api/google/token`      | `{ code, redirectUri }` | The same answer                                              |
| `POST /api/google/refresh`    | `{ refreshToken }`      | The same answer                                              |
| `POST /api/dropbox/token`     | `{ code, redirectUri }` | The same answer                                              |
| `POST /api/dropbox/refresh`   | `{ refreshToken }`      | The same answer                                              |
| `POST /api/microsoft/token`   | `{ code, redirectUri }` | The same answer                                              |
| `POST /api/microsoft/refresh` | `{ refreshToken }`      | The same answer                                              |

Only the origins in `ALLOWED_ORIGINS` get an answer. Every other origin gets 403. A project that
lacks its secret or its origins answers 500 and calls nothing. A GitHub answer that has no access
token or no refresh token answers 400. A rejected request answers 400
`{ error: "rejected", reason }` with the reason that the provider gave, and the same reason is
logged without any secret.

## Environment

| Variable                  | Value                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| `GITHUB_CLIENT_SECRET`    | The client secret of the `gamerdex-sync` GitHub App.               |
| `GOOGLE_CLIENT_ID`        | The client ID of the Google Web application OAuth client.          |
| `GOOGLE_CLIENT_SECRET`    | The client secret of that Google OAuth client.                     |
| `DROPBOX_CLIENT_ID`       | The app key of the Dropbox app.                                    |
| `DROPBOX_CLIENT_SECRET`   | The app secret of that Dropbox app.                                |
| `MICROSOFT_CLIENT_ID`     | The application (client) ID of the Microsoft app registration.     |
| `MICROSOFT_CLIENT_SECRET` | The value of a client secret of that app registration.             |
| `ALLOWED_ORIGINS`         | The origins of the Gamerdex apps, separated by commas, no slashes. |

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

## Dropbox

The Dropbox routes send the code and the refresh token to `https://api.dropbox.com/oauth2/token` as
a form. They answer 400 `no_refresh_token` when the sign in gave no refresh token and 400
`missing_scope` when it did not grant both `files.content.read` and `files.content.write`.
`dropboxAuthorizeUrl` in `gamerdex-sync` asks for a refresh token with `token_access_type=offline`.
A Dropbox refresh token does not expire and never changes, and the refresh answer has none, so the
route returns the refresh token that it was given, with a lifetime of 180 days from now.

Dropbox setup, in the App Console: create a Scoped access app with the App folder access type,
enable the two file scopes on the Permissions tab, and add the redirect URI of each app
(`https://<app host>/sync/callback`, and `http://localhost:3000/sync/callback` for local work). The
app key is `DROPBOX_CLIENT_ID` and the app secret is `DROPBOX_CLIENT_SECRET`.

## Microsoft

The Microsoft routes send the code and the refresh token to the `consumers` endpoint of the
Microsoft identity platform, so they sign in personal Microsoft accounts. They answer 400
`no_refresh_token` and 400 `missing_scope` in the same cases as the Dropbox routes, with the
`Files.ReadWrite.AppFolder` scope. Microsoft sends a new refresh token with every refresh and the
old one must be dropped, so the route returns the new one. A refresh token ends after 90 days
without use, and the route gives it a lifetime of 80 days from now.

Microsoft setup, in the Microsoft Entra admin center: register an application for personal Microsoft
accounts only, add a Web redirect URI for each app (not a single page application URI, which would
refuse the client secret), create a client secret and copy its value at once, and add the delegated
Microsoft Graph permissions `Files.ReadWrite.AppFolder` and `offline_access`. The secret expires, so
note its date. The application ID is `MICROSOFT_CLIENT_ID` and the secret value is
`MICROSOFT_CLIENT_SECRET`.

## Commands

`pnpm lint`, `pnpm format`, `pnpm test:coverage`.

## Adding a provider

Write a `TokenProvider` (`exchange(request)` returns tokens, a rejection reason, or `unreachable`),
wrap it with `createTokenHandler`, then add a route file (`api/<provider>/[action].ts`) and its
secret variables. A provider that signs in with PKCE and no secret needs no route.
