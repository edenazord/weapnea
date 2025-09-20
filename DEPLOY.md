# Deploy guide

This project runs as two parts:
- Frontend (Vite/React) on a static host (Vercel/Netlify/etc.)
- Backend API (Node/Express + Postgres) on a server host (Render/Railway/Fly.io/Heroku-like)

## Backend (Render example)

1. Create a new Web Service
- Build command: `npm ci`
- Start command: `node server/index.cjs`
- Environment:
  - `POSTGRES_URL` = your managed Postgres connection string
  - `PORT` = 10000 (Render assigns `$PORT`; you can omit and let the platform set it)
  - `API_TOKEN` = a long random string (optional but recommended)

2. Networking
- Expose HTTP

3. Health
- Optional: `/api/health`

## Backend (Railway example)

- Add a Postgres plugin and copy the connection URL to `POSTGRES_URL`.
- Create a service from this repo; set `START` to `node server/index.cjs` or use Nixpacks default.
- Set `API_TOKEN`.

## Frontend (Vercel example)

- Framework preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_BACKEND_MODE` = `api`
  - `VITE_API_BASE_URL` = `https://<your-backend-host>`
  - Optionally `VITE_API_TOKEN` if you need to send auth for mutations from the browser (dev/admin only).

## Frontend (Netlify example)

- Build: `npm run build`
- Publish directory: `dist`
- Environment: same as Vercel

## CORS
The backend enables CORS for any origin by default:
```
app.use(cors({ origin: true, credentials: true }));
```
Adjust in `server/index.cjs` if you want to restrict to your frontend domain in production.

## Database migrations
Ensure your Postgres has the required tables: `events`, `categories`, `forum_categories`, `forum_topics`, `forum_replies`.

## Troubleshooting
- 404/500 from `/api/events`: verify DB schema and that `POSTGRES_URL` is correct.
- CORS errors: set `origin` to your domain or `*`.
- Images/avatars: handled by the API or local hosting; Supabase is no longer used.
