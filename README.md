# WeApnea

App React (Vite) con backend Node/Express su Postgres.

## Sviluppo locale

Requisiti: Node.js LTS.

```powershell
npm install
npm run dev
```

Backend API (opzionale per test reali, richiede Postgres e variabili d'ambiente):

```powershell
npm run api
```

Variabili API principali: POSTGRES_URL/DATABASE_URL, JWT_SECRET, API_TOKEN (opzionale), STRIPE_SECRET_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL.

## Deploy

- Frontend: Vercel (Preset Vite). Build: `npm run build`, Output: `dist`.
- Backend API: Render (Web Service). Start: `node server/index.cjs`. Health: `/api/health`.

Vedi `vercel.json` e `render.yaml` per i dettagli minimi.
