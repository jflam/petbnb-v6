# PetBnB - Sitter Discovery App (React • Express • PostgreSQL • PostGIS • Azure)

A full-featured pet sitter discovery platform built with a modern stack:

* **Backend**: Node.js with Express, Prisma ORM, and PostgreSQL with PostGIS extensions for spatial queries
* **Frontend**: React SPA with Material-UI, React Router, React Query, and MapLibre GL for interactive maps

The app allows pet owners to search for pet sitters by location, filter by various criteria, and view detailed profiles.

---

## 1 • What's Inside?

* **Data Model** – Users, Sitters, Pets, Reviews, Availability, and more with complete relational integrity
* **Spatial Search** – Location-based sitter discovery with distance filtering using PostGIS
* **UI Components** – Search bar, filter drawer, list/map toggle, sitter cards, and responsive design
* **API Design** – REST endpoints for sitter search and profile retrieval with validation
* **DevOps** – Docker Compose for local development, Bicep IaC for Azure deployment

---

## 2 • Quick Start (Local)

```bash
git clone https://github.com/<you>/petbnb-v6.git
cd petbnb-v6
npm run bootstrap   # install deps & generate Prisma client
npm run dev         # spins up DB + API (Docker) & Vite dev server
```

Now open:

* **SPA** → [http://localhost:5173](http://localhost:5173)
* **API** → [http://localhost:4000](http://localhost:4000)
* **DB**  → `localhost:5433`

---

## 3 • Prerequisites

* **Node 20 LTS** (includes npm)
* **Docker Desktop 24+**
* **Azure CLI** & **Azure Developer CLI (azd)** – required only for cloud deployment

Verify:

```bash
node -v   # v20.x
docker --version   # Docker 24.x
az --version       # azure‑cli ≥ 2.61
azd version        # e.g. 1.5.0
```

---

## 4 • Project Layout

```
petbnb-v6/
│
├── client/           # React/Vite SPA
│   ├── src/          # Frontend source code
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── store/         # Zustand state management
│   │   ├── api/           # API client
│   │   └── types/         # TypeScript type definitions
│   └── public/       # Static assets
│
├── server/           # Express API + Prisma + Dockerfile
│   ├── src/          # Backend source code
│   │   ├── controllers/   # API route handlers
│   │   ├── middleware/    # Express middleware
│   │   └── utils/         # Helper utilities
│   ├── prisma/       # Prisma schema and migrations
│   └── scripts/      # Utility scripts
│
├── infra/            # Bicep IaC + azure.yaml + config
├── docs/             # Documentation
└── package.json      # workspace root scripts
```

---

## 5 • Local Development Workflow

### Local Dev Server

1. `npm run bootstrap` – one-time install & Prisma client generation  
2. `npm run dev` – starts all services locally:  
   * PostgreSQL 16 with PostGIS extensions (Docker)  
   * Express API with hot-reload (Docker)  
   * Vite dev server with HMR (port 5173)

Edit code → save → browser refreshes automatically.

### Running Seed Scripts

The seed script generates demo data including sitter profiles, pets, reviews, and mock images:

```bash
# From the project root
cd server
npm run seed
```

The seed script will:
1. Create 10 sitter profiles (5 in Seattle, 5 in Austin)
2. Create 10 pet owners with 25 pets of varied sizes and needs
3. Generate 200 random reviews
4. Create mock profile images for each sitter (saved in `client/public/sitters/`)

### Running Smoke Tests

To verify the API is working correctly:

```bash
# From the project root
cd server
./scripts/smoke-tests.sh
```

The smoke tests verify:
1. API health endpoint is responding
2. Sitter search is returning results
3. Sitter profile endpoint is returning detailed data

For testing against a deployed environment:

```bash
./scripts/smoke-tests.sh https://your-deployed-api-url
```

---

## 6 • Deploy to Azure

> All cloud resources are defined in Bicep and orchestrated by `azd`. You *do not* need to click around the Portal.

### Step 1 – Prep Azure

```bash
az login                        # browser sign‑in
az account set --subscription <SUB_ID>
azd init                        # choose env name + region
azd env set POSTGRES_ADMIN_PASSWORD "$(openssl rand -base64 24)"
```

### Step 2 – Ship it

```bash
azd up        # provisions RG, Container Apps, Static Web App, Postgres… then deploys code
```

A few minutes later you'll get URLs like:

* `https://<static>.azurestaticapps.net`  (SPA)
* `https://server.<hash>.<region>.azurecontainerapps.io`  (API)

### Step 3 – Migrate & Seed

```bash
azd show                          # grab DATABASE_URL secret
cd server
DATABASE_URL="<url>" npx prisma migrate deploy
DATABASE_URL="<url>" npx prisma db seed
```

---

## 7 • Environment Variables

* `DATABASE_URL` – PostgreSQL connection string for Prisma
* `PORT` – API port (default 4000)
* `VITE_API_BASE_URL` – API URL for the frontend (default: http://localhost:4000)
* `APPINSIGHTS_CONNECTION_STRING` – Optional Azure App Insights connection string for telemetry

---

## 8 • Troubleshooting

* **Build fails?** Re‑run `npm run bootstrap`
* **Missing sitter images?** Run the seed script again
* **Search returns no results?** Check the search coordinates are near Seattle (47.6097, -122.3331) or Austin (30.2672, -97.7431)
* **PostGIS errors?** Make sure PostgreSQL has the PostGIS extension installed

---

### Happy pet sitting! 🐶 🐱