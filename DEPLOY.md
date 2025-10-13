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
  - Storage (uploads): choose one of the following
    - Local disk on Render: set `STORAGE_DRIVER=local` and ensure `disk` is configured in `render.yaml` with `UPLOADS_DIR=/data/uploads` (files served from `https://<api-domain>/public/uploads/...`).
    - SFTP (recommended if you want files on your hosting): set `STORAGE_DRIVER=sftp` and configure variables below.

2. Networking
- Expose HTTP

3. Health
- Optional: `/api/health`

## Backend (Railway example)

- Add a Postgres plugin and copy the connection URL to `POSTGRES_URL`.
- Create a service from this repo; set `START` to `node server/index.cjs` or use Nixpacks default.
- Set `API_TOKEN`.

## Upload storage: SFTP configuration

If you want uploaded images/videos to be stored on your FTP hosting (and served from your main website), configure the SFTP driver:

1. In `render.yaml` we set `STORAGE_DRIVER: sftp` and declared the following env vars (do not commit secrets; set them in Render dashboard):
  - `SFTP_HOST` (e.g. access-XXXX.webspace-host.com)
  - `SFTP_PORT` (22)
  - `SFTP_USERNAME`
  - `SFTP_PASSWORD`
  - `SFTP_BASE_DIR` (remote uploads directory, e.g. `/weapnea/uploads`)
  - `SFTP_REMOTE_ROOT` (web root, e.g. `/weapnea`)
  - One of:
    - `SFTP_PUBLIC_BASE_URL` (full public base URL, e.g. `https://weapnea.it/uploads`)
    - or `SFTP_PUBLIC_DOMAIN` (domain only, e.g. `weapnea.it` — the server will infer `/uploads` from `SFTP_BASE_DIR` vs `SFTP_REMOTE_ROOT`).

2. After setting env vars, redeploy the backend. The upload endpoint `/api/upload` will:
  - upload files to `SFTP_BASE_DIR` via SFTP
  - return a public URL like `https://<domain>/uploads/<filename>`

3. Frontend components (e.g. ImageUpload) already convert relative URLs to absolute using the API base when necessary.

Notes:
- If you keep `STORAGE_DRIVER=local`, on Render you must attach a persistent disk (see `render.yaml`) or files will be ephemeral.
- Avoid committing any credentials (use `.env` locally or the provider dashboard in production).

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
