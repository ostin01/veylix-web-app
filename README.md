# Veylix Web App

Next.js (App Router, TypeScript, Tailwind v4) operator console for the Veylix API. Everything on
screen comes from the real backend; nothing is mocked.

## Run

```bash
cp .env.example .env.local      # VEYLIX_API_URL defaults to http://127.0.0.1:8000
npm install
npm run dev                     # http://localhost:3000
```

Start the backend first. Sign in with an account the backend knows about, for example the bootstrap
admin created from `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` (see the backend README).

## How authentication works

The browser never sees a token. Next.js acts as a small backend-for-frontend:

- `POST /api/auth/login` exchanges the username/password for tokens and stores them in **httpOnly**
  cookies (`vx_at` access, `vx_rt` refresh). `POST /api/auth/logout` revokes the refresh token.
- `/api/v1/*` is a route handler (`app/api/v1/[...path]`) that attaches the bearer token and forwards
  to `VEYLIX_API_URL`. When the access token is about to expire it refreshes it first.
- The API's refresh tokens are single-use and a replay revokes the whole session, so concurrent
  refreshes are collapsed into one upstream call (`lib/server/session.ts`).
- State-changing requests with a foreign `Origin` header are rejected (CSRF), on top of `SameSite=Lax`.
- `proxy.ts` redirects visitors without a session cookie to `/login`; the API still enforces access
  on every call.
- Because the API has no CORS middleware, the browser only ever talks to Next.js.

Set `VEYLIX_API_URL` to the address of the API **as reachable from the Next.js server** (for Docker
Compose that is the service name, e.g. `http://api:8000`).

## Roles

| Role | What the UI allows |
| --- | --- |
| admin | everything, plus Users, Quarantine, diagnostic profile management |
| operator | create/edit/delete fleets, vehicles, devices; acknowledge alerts |
| viewer | read-only (write buttons are hidden; the API rejects them anyway) |

## Pages and the endpoints they use

| Page | Endpoints |
| --- | --- |
| Login / Account | `POST /auth/token`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `POST /auth/password` |
| Dashboard | list endpoints (`total_items`), `GET /alerts/summary`, `GET /telemetry/latest`, Leaflet map |
| Fleets / Vehicles / Devices | full CRUD, search, filters, sort, assign/unassign, history; vehicles pick a diagnostic profile |
| Vehicle detail | vehicle, `GET /vehicles/{id}/health`, `/vehicles/{id}/telemetry`, alerts, devices |
| Alerts | `GET /alerts` (active, severity, sort, vehicle), `POST /alerts/{id}/acknowledge` |
| Profiles | `GET/POST/PATCH/DELETE /diagnostic-profiles` (edit is admin-only) |
| Users (admin) | `GET/POST /users`, `PATCH /users/{id}/status` |
| Quarantine (admin) | `GET /telemetry/dead-letters`, replay, delete |

## Map

The dashboard links to a full-screen vehicle map, which clusters nearby vehicles at lower zoom
levels and opens around Amsterdam when there are no GPS positions. Vehicle markers use the latest
latitude and longitude supplied by backend telemetry; the frontend does not generate or move
vehicle locations. Vehicles without valid coordinates are not shown. The map uses keyless
OpenStreetMap tiles by default, darkened to match the dashboard. The browser needs internet access
to load tiles; if they fail, a notice appears and the vehicle markers keep updating. You can
optionally set `NEXT_PUBLIC_MAP_TILE_URL` and
`NEXT_PUBLIC_MAP_ATTRIBUTION` to use another tile provider; provider URLs that need an API key must
include its key. These public environment variables are embedded at build time, so redeploy after
changing them. The default OpenStreetMap tile service is intended for light use and requires the
visible attribution shown on the map. Clustering avoids rendering one DOM marker per vehicle, but
the current telemetry endpoint still returns every vehicle's latest position; very large fleets
will eventually need server-side viewport filtering to reduce response size and processing.

## Not built yet

Analytics, Commands and Reports are placeholder pages: the backend has no endpoints for them.

## Checks

```bash
npm run typecheck
npm run build
```
