# Full-Stack AI Starter App (React • Express • PostgreSQL • Azure)

A batteries-included reference app that proves a **React/Vite SPA, an Express + Prisma API, and a PostgreSQL database** can run locally in Docker and go live on Azure with a single `azd up`.

Out of the box you get a playful “fortune-cookie” feature—click once and the front-end calls the API, which fetches a random fortune from Postgres. Swap that model for your own data and you instantly have:

* Hot-reload local development (Vite + Nodemon + Docker Compose)  
* One-command cloud deployment to Azure Container Apps, Static Web Apps, and PostgreSQL Flexible Server  
* IaC in Bicep, secret management via Key Vault, and a ready-made GitHub Actions pipeline

Fork it, rename it, and start shipping real features instead of scaffolding infrastructure.

---

## 1 • What’s Inside?

* **Backend** – Node 20 · Express · Prisma · PostgreSQL. One endpoint: `/api/fortunes/random`.
* **Frontend** – React + Vite SPA that pipes the fortune onto the screen.
* **Docker‑first dev** – PostgreSQL and API run in containers so “it works on my machine” means “it works everywhere.”
* **Azure‑native deploy** – Azure Developer CLI (azd), Bicep IaC, Container Apps, Static Web Apps, PostgreSQL Flexible Server.

Everything lives in a monorepo with clear boundaries (`/server`, `/client`, `/infra`, `/scripts`).

---

## 2 • Quick Start (Local)

```bash
git clone https://github.com/<you>/ai-app-starter-postgres.git
cd ai-app-starter-postgres
npm run bootstrap   # install deps & generate Prisma client
npm run dev         # spins up DB + API (Docker) & Vite dev server
```

Now open:

* **SPA** → [http://localhost:3000](http://localhost:3000)
* **API** → [http://localhost:4001](http://localhost:4001)
* **DB**  → `localhost:5433`

---

## 3 • Prerequisites

* **Node 20 LTS** (includes npm)
* **Docker Desktop 24+**
* **Azure CLI** & **Azure Developer CLI (azd)** – required only for cloud deployment
* **uv** – Python package runner (used by helper scripts)

Verify:

```bash
node -v   # v20.x
docker --version   # Docker 24.x
az --version       # azure‑cli ≥ 2.61
azd version        # e.g. 1.5.0
uv --version       # e.g. 0.1.x
```

> Need Node? Install via `nvm install 20 && nvm use 20` (macOS/Linux) or grab the installer for Windows.

---

## 4 • Project Layout

```
ai-app-starter-postgres/
│
├── client/        # React/Vite SPA
├── server/        # Express API + Prisma + Dockerfile
├── infra/         # Bicep IaC + azure.yaml + config
├── scripts/       # helper Python + shell scripts
└── package.json   # workspace root scripts
```

Each service is self‑contained: its own `package.json`, env file, and build process. The root uses npm workspaces so `npm run <script>` cascades where appropriate.

---

## 5 • Local Development Workflow

> Everything in this section runs **only on your machine**—no Azure resources are involved.

### Local Dev Server (HMR)

1. `npm run bootstrap` – one-time install & Prisma client generation  
2. `npm run dev` – starts **all** services locally:  
   * PostgreSQL 16 (Docker)  
   * Express API with hot-reload (Docker)  
   * Vite dev server with HMR (port 3000)

Edit code → save → browser refreshes automatically.

### Local Production Build & Preview

```bash
npm run build      # compiles server & client for production
npm run start:prod # serves the built API (Docker) + previews the SPA

---

## 6 • Deploy to Azure in One Command

> All cloud resources are defined in Bicep and orchestrated by `azd`. You *do not* need to click around the Portal.

\### Step 1 – Prep Azure

```bash
az login                        # browser sign‑in
az account set --subscription <SUB_ID>
azd init                       # choose env name + region
azd env set POSTGRES_ADMIN_PASSWORD "$(openssl rand -base64 24)"
```

\### Step 2 – Quota Check (Optional but Smart)

```bash
uv run scripts/check_azure_quota.py   # prints regions with capacity
source ./set_region.sh                # exports AZURE_LOCATION
```

\### Step 3 – Ship it

```bash
azd up        # provisions RG, ACR, Container Apps, Static Web App, Postgres… then deploys code
```

A few minutes later you’ll get URLs like:

* `https://<static>.azurestaticapps.net`  (SPA)
* `https://server.<hash>.<region>.azurecontainerapps.io`  (API)

\### Step 4 – Migrate & Seed

```bash
azd show                          # grab DATABASE_URL secret
cd server
DATABASE_URL="<url>" npx prisma migrate deploy
DATABASE_URL="<url>" npx prisma db seed
```

That’s it—production ready.

---

## 7 • CI/CD with GitHub Actions

Run:

```bash
azd pipeline config
```

The wizard creates a service principal, injects credentials as repo secrets, and writes `.github/workflows/azure-dev.yml`. Every push to `main` redeploys to your chosen environment. Add branch filters or approvals as you wish.

---

## 8 • Environment Variables Cheat‑Sheet

* `DATABASE_URL` – injected into the Container App as a secret.
* `PORT` – API port (default 4000).
* `VITE_API_BASE_URL` – baked into the SPA at build time. **Public, non‑secret.**

Remember: only values prefixed with `VITE_` end up in client‑side JS.

---

## 9 • Troubleshooting 101

* **Build fails?** Re‑run `npm run bootstrap`.
* **Container App 502?** `az containerapp logs show --name server -g <rg> --follow`.
* **CORS issues?** Set `VITE_API_BASE_URL` on the Static Web App.
* **Quota errors?** Re‑run the quota script or request increases in the Portal.

Run `azd down` to delete the entire environment when finished.

---

## 10 • Security Notes

* Secrets live in Azure Key Vault and Container App secrets—never in Git.
* The API pulls images from ACR using a user‑assigned managed identity with *AcrPull* role least privilege.
* CSP headers in `staticwebapp.config.json` restrict outbound hosts.

---

### Happy shipping! 🎉
