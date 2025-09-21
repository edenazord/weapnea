# Migrazione: convergere su API (Supabase rimosso)

Legenda stato:
- [ ] Da fare
- [x] Fatto
- [~] In corso

## 0. Preparazione
- [x] Strategia: un'unica modalità supportata (api); mock rimossi
- [ ] Creare branch dedicato `feat/migration-cleanup` (se necessario)
- [x] Aggiornare `.env.example` con tutte le chiavi necessarie (frontend e backend)

## 1. Audit riferimenti Supabase (completato)
- [x] Elencare import/usi di `@supabase/supabase-js`, `supabase.functions.invoke`, Storage, Auth, Realtime
- [~] Mappare pagine/feature impattate: Auth, Profili, Eventi, Blog, Forum, Pagamenti, Upload avatar (Blog/Packages/Payments/Avatar già rivisti)

## 2. Autenticazione
- [x] Modalità API: `ApiAuthProvider` con user locale (`auth_user`) + `VITE_API_TOKEN` per mutazioni
- [x] Modalità Supabase: rimossa completamente
- [x] Aggiornare `ProtectedRoute` per usare il nuovo contesto auth

## 3. Dati (DB/API)
- [x] Origine dati: API minima + Postgres locale; Supabase rimosso
- [x] Definire contratti API: eventi/categorie CRUD; forum categorie/topics/replies CRUD + reorder/status/views
- [x] Sostituire le query con wrapper API: eventi, categorie, pagamenti, pacchetti, blog, forum
- [x] Endpoint API implementati: eventi/categorie CRUD; forum CRUD completo; token per mutazioni
- [ ] Aggiornare eventuali Query Key e cache dove necessario
	- [x] Mutazioni API passano header Authorization via apiClient

## 4. Pagamenti/abbonamenti
- [ ] Decidere strategia definitiva: Stripe (endpoint server + webhook) o alternative
- [x] Wrapper `invokeFunction` rimosso (non più necessario)
- [~] Stato post-pagamento: da definire in base a strategia reale

## 5. Storage (avatar, immagini)
- [x] Storage: gestito dall'API o hosting locale
- [ ] Implementare upload con URL presignati (se backend) o servizio terzo
- [ ] Aggiornare URL immagini dove necessario

## 6. Pulizia Supabase (completata)
- [x] Rimosso `src/integrations/supabase/*` e riferimenti
- [x] Migrato codice Edge Functions nel backend API o rimosso
- [x] Rimosse migrazioni Supabase e config locali

## 7. UI/UX
- [~] Aggiornare messaggi/flow (es. pagamenti, stato post-checkout)
- [ ] Verificare redirect auth e rotte protette

## 8. Build & Deploy
- [x] Aggiornare `README.md` con istruzioni locali e script PowerShell
- [~] Aggiungere `DEPLOY.md` con ricette (Vercel/Netlify per frontend; Render/Railway per backend)
- [ ] Impostare variabili ambiente in piattaforma
- [ ] Smoke test produzione

## 9. Migrazione dati (se necessario)
- [x] Verifica integrazione e conteggi via script `db:check` (events, categories, forum_*)
- [ ] Import in nuova origine (DB/CMS) quando si decide il backend definitivo

## 10. Qualità
- [x] ESLint/TypeScript pass repo-wide (0 errori; warnings accettati)
- [ ] Test di base per auth e pagamenti (manuali o unit/integration)
- [ ] Check SEO: sitemap/robots, metadati, canonical

---
Aggiornamenti recenti:
- Forum API lato backend: categorie/topics/replies CRUD; reorder, status (pin/lock), views; mutazioni protette da token.
- Frontend: forum/eventi/categorie cablati in modalità `api`; payments/packages/blog ripuliti dai mock.
- Auth in modalità `api`: `ApiAuthProvider` con `auth_user` + `VITE_API_TOKEN` per Authorization.
- Mock completamente rimosso (codice, asset `public/mock-data`, script export) e cleanup in `package.json`.
- Script PowerShell per avvio rapido: `start-api.ps1`, `start-frontend.ps1`, `start-all.ps1` (supportano `-ApiToken`).
 - Script aggiornati: rimosso `mock` dalle opzioni; README allineato con modalità supportate.

---
Note: piccole PR incrementali per ridurre il rischio.

Prossimi passi consigliati:
- [ ] JWT reale sul backend (sostituire token statico), permessi granulari
- [ ] Webhook pagamenti e stato post-checkout
- [ ] `.env.example` esteso e `DEPLOY.md`

ok