# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-10-18

### Changed

- The client IDs of Google, Dropbox and Microsoft default to the IDs in `gamerdex-sync`, so the
  service and the apps use the same ID. `GOOGLE_CLIENT_ID`, `DROPBOX_CLIENT_ID` and
  `MICROSOFT_CLIENT_ID` are now optional and replace the default when they are set. Only the client
  secrets are required.

## [1.0.0] - 2026-10-18

### Added

- Sign in token routes for GitHub, Google, Dropbox and Microsoft. Each provider has
  `POST /api/<provider>/token`, which swaps a sign in code for tokens, and
  `POST /api/<provider>/refresh`, which renews them.
- One answer shape for every provider: `{ accessToken, expiresIn, refreshToken, refreshExpiresIn }`.
- Only the origins in `ALLOWED_ORIGINS` get an answer. The service keeps no data and logs only the
  reason that a provider gave for a refused request.
- Checks on the sign in result. A Google, Dropbox or Microsoft sign in that gives no refresh token,
  or does not grant the file scope that sync needs, is refused.
- Refresh token handling for each provider. Google and Dropbox keep the refresh token that the
  player has. Microsoft sends a new refresh token with every refresh, and the route returns it.
