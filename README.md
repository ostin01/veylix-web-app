# Veylix Dashboard

Next.js (App Router, TypeScript, Tailwind v4) operator console for the Veylix API.

## Run

```bash
cd dashboard
cp .env.example .env.local      # VEYLIX_API_URL defaults to http://127.0.0.1:8000
npm install
npm run dev                     # http://localhost:3000
```

Start the backend first (`make dev-all` from the repo root, or `uv run uvicorn main:app`).

The browser only talks to Next.js. `next.config.ts` rewrites `/api/v1/*` and `/backend-health`
to `VEYLIX_API_URL`, so no CORS configuration is needed on the API.

## What is wired to the real API

| Page | Endpoints used |
| --- | --- |
| Overview | list endpoints with `page_size=1` for counts (`total_items`), recent devices, fleets |
| Fleets | `GET/POST/PATCH/DELETE /fleets` |
| Vehicles | list (search, fleet, status, sort, pagination), create, update, delete, detail |
| Devices | list/filter, register, edit, assign, unassign, assignment history |

Server errors (409 conflicts, 422 validation) are shown in the forms and dialogs.

## Mocked / not available yet

- **Signed-in user** (`lib/user.ts`) is the only mock data: the backend has no auth.
- **Live map, telemetry charts, alerts, analytics, commands, reports** need backend endpoints that do
  not exist yet (telemetry read API, diagnostics/alerts, analytics). These show explicit empty states
  or "Soon" pages rather than fake numbers.

## Checks

```bash
npm run typecheck
npm run build
```
