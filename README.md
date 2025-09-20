# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/74f27b2b-cc42-4221-9109-8d5326352129

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/74f27b2b-cc42-4221-9109-8d5326352129) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:


## Avvio rapido (Windows)

Prerequisiti: Node.js LTS, Docker con Postgres locale già avviato (porta 5434) o una istanza Postgres raggiungibile.


```powershell

In alternativa:

```powershell
./start-api.ps1
./start-frontend.ps1
```

Note API-only:
- Le letture pubbliche non richiedono token.
- Per le mutazioni (crea/aggiorna/elimina) imposta `API_TOKEN` nel backend e il corrispondente `VITE_API_TOKEN` nel frontend per inviare l'header `Authorization: Bearer <token>`.
Env backend richieste: `POSTGRES_URL`/`DATABASE_URL`, `PORT`, `JWT_SECRET`, `API_TOKEN` (opzionale), `STRIPE_SECRET_KEY`, `PUBLIC_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
Env frontend richieste: `VITE_BACKEND_MODE=api`, `VITE_API_BASE_URL`, `VITE_API_TOKEN` (per mutazioni protette lato admin/dev).

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
