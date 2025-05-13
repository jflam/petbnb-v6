
Below is a *step-by-step implementation plan* that takes the current **`ai-app-starter-postgres`** template (which is still Express + Knex + SQLite ([GitHub][1])) and evolves it into a fully containerised, Prisma-based Postgres stack that can be pushed to Azure with a single command.

---

## 0  |  Ground rules & prerequisites

* **Branching** – create `feat/postgres-prisma` off `main`; merge only when the end-to-end path (local → Azure) is proven.

* **Tooling** – you’ll use Node 20, Docker ≥ 24, the Azure CLI, and the Azure Developer CLI (`azd`).
  Install once:

  ```bash
  brew install azure-cli azure-dev-cli
  npm i -g prisma
  ```

* **Secrets** – keep all credentials in `.env` (local) and in Azure Container Apps secrets (prod).

---

## 1  |  Introduce Postgres locally, still on Knex (safety net)

1. **Add Docker Compose**

   ```yaml
   # docker-compose.yml
   services:
     db:
       image: postgres:16-alpine
       environment:
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgres
         POSTGRES_DB: ai_app
       ports: ["5432:5432"]
       volumes: ["pgdata:/var/lib/postgresql/data"]
   volumes:
     pgdata: {}
   ```

2. **Update `server/.env`**

   ```
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/ai_app
   ```

3. Adjust `knexfile.ts` to read `process.env.DATABASE_URL`.
   Now `docker compose up db` + `npm run dev` should work exactly as before—only the storage engine changed.

---

## 2  |  Knex → Prisma

> Prisma buys you type-safe queries, migrations, and seed scripts at once.

1. **Remove Knex**

   ```bash
   npm --ws remove knex
   ```

2. **Add Prisma & PG driver**

   ```bash
   npm --ws add prisma @prisma/client pg
   ```

3. **Create `server/prisma/schema.prisma`**

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }

   generator client {
     provider = "prisma-client-js"
   }

   model Fortune {
     id      Int    @id @default(autoincrement())
     text    String
     created DateTime @default(now())
   }
   ```

4. **Generate & migrate**

   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

   Write a tiny seed script in `prisma/seed.ts` that inserts the original 20 fortunes.

5. **Rewrite data access**

   ```ts
   // server/src/db.ts
   import { PrismaClient } from '@prisma/client';
   export const prisma = new PrismaClient();

   // server/src/fortune.service.ts
   export async function getRandomFortune() {
     return prisma.fortune.findFirst({ orderBy: { id: 'asc' }, skip: Math.floor(Math.random()*20) });
   }
   ```

6. Replace the Knex logic in `server/index.ts` with `getRandomFortune()`.

At this point `npm run dev` (outside Docker) and `docker compose up db && npm run dev` both hit Postgres through Prisma.

---

## 3  |  Containerise the Express API

Create `server/Dockerfile`:

```dockerfile
# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build     # emits dist/

# --- runtime ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=build /app .
CMD ["node", "dist/index.js"]
```

Add the API to `docker-compose.yml`:

```yaml
  api:
    build: ./server
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/ai_app
      PORT: 4000
    depends_on: [db]
    ports: ["4000:4000"]
```

`docker compose up --build` now gives you **Postgres + Prisma + Express** in one shot.

---

## 4  |  Dev-container & Codespaces (optional but slick)

Add `.devcontainer/devcontainer.json` that:

* Starts `docker compose up --build`.
* Installs Node 20, PNPM/NPM, Prisma, and the Azure CLI.

Anyone can “Open in Dev Container” and hack immediately.

---

## 5  |  Monorepo scripts cleanup

Update root `package.json`:

```jsonc
{
  "scripts": {
    "dev": "npm-run-all -p dev:*",
    "dev:client": "npm --workspace=client run dev",
    "dev:api": "docker compose up --build",       // now runs inside compose
    "bootstrap": "npm i && npm run prisma:generate",
    "prisma:generate": "npx prisma generate"
  }
}
```

---

## 6  |  GitHub Actions CI

`.github/workflows/ci.yml`

```yaml
name: Build & Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      db:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ai_app_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx prisma migrate deploy
        env: { DATABASE_URL: postgres://postgres:postgres@localhost:5432/ai_app_test }
      - run: npm test --workspaces
```

---

## 7  |  Azure infrastructure with **azd**

1. **Initialise**

   ```bash
   azd init --template "" --name ai-starter --location westus3
   ```

   Delete the default sample and keep only:

   ```
   infra/
     main.bicep
   azure.yaml
   ```

2. **`azure.yaml`**

   ```yaml
   name: ai-starter
   services:
     api:
       project: ./server
       host: containerapp
     web:
       project: ./client
       host: staticwebapp
   infra:
     path: ./infra
   ```

3. **`infra/main.bicep`** (outline)

   * Azure Container Registry (Premium throughput not needed).
   * Postgres Flexible Server (burstable B1s, zone redundant storage).
   * Static Web App (free tier is fine to start).
   * Container App Environment + Container App (`api`).
   * **Service Connector** resource linking Container App ↔ Postgres; injects `DATABASE_URL` secret automatically ([Microsoft Learn][2]).

4. **Provision & deploy**

   ```bash
   azd up          # provisions infra, builds image, pushes to ACR, deploys
   ```

   The first run may take \~10 min; subsequent pushes re-deploy in \~1-2 min.

---

## 8  |  Local–prod parity & data safety

* **Local Postgres stays in Docker**; prod uses managed Postgres (back-ups, HA, automatic patching).
  You avoid stateful containers in Azure and keep restore-from-snapshot workflows trivial.

* Run `az containerapp revision set-default` only when migrations succeed in a blue-green pattern to prevent downtime.

---

## 9  |  Documentation & onboarding

* Update `README.md` top-to-bottom: quick start, dev-container, prisma workflows, “Deploy to Azure” badge that calls `azd up`.
* A `docs/` folder with:

  * `LOCAL_DEV.md` – describes Docker Compose workflows.
  * `AZURE_DEPLOY.md` – explains the azd pipeline & rollback story.
  * `DATA_MODEL.md` – current Prisma schema and migration policy.

---

### Success definition

You can:

1. `npm run dev` – develop with hot reload against Docker Postgres.
2. `docker compose up --build` – run the full stack exactly as it will in prod.
3. `azd up` – provision or update Azure resources, build & push the API image, inject the managed Postgres connection string, and publish the Vite SPA to Static Web Apps.

Follow these tasks in order and the SQLite legacy codebase will be completely retired, replaced by a modern Postgres + Prisma core that ships to Azure with almost no manual steps.

[1]: https://github.com/jflam/ai-app-starter-postgres "GitHub - jflam/ai-app-starter-postgres"
[2]: https://learn.microsoft.com/en-us/azure/service-connector/how-to-integrate-postgres?utm_source=chatgpt.com "Integrate Azure Database for PostgreSQL with Service Connector"

Great — I’ll prepare a full implementation guide that shows how to use the Azure Developer CLI (`azd`) to provision and deploy:

* Azure Container Registry (ACR)
* Azure Container Apps for the Express API
* Azure Database for PostgreSQL (Flexible Server)
* Azure Static Web Apps for the React front-end
* A Service Connector to wire the database connection into the container
* CI/CD setup with GitHub Actions
* A single "dev" environment

I’ll include complete examples of `azure.yaml`, `main.bicep`, and deployment workflows so a coding agent can one-shot the task.

I’ll get back to you shortly with the report.


# Deploying the `ai-app-starter-postgres` Project with Azure Developer CLI (azd)

This guide walks through provisioning Azure resources and deploying an Express/Postgres API and Vite/React front-end using the Azure Developer CLI (**azd**). We will set up a single **"dev"** environment with all necessary Azure services and continuous deployment. The main steps are:

1. **Azure Resource Provisioning** – Create an Azure Container Registry, a Container Apps environment for the Express API, an Azure Database for PostgreSQL (Flexible Server), an Azure Static Web App for the React front-end, and a Service Connector (via configuration) to provide the Postgres connection string to the API.
2. **Configuration Files** – Define an `azure.yaml` manifest for azd and Bicep templates (in `infra/`) such as `main.bicep` to declare infrastructure as code. Also set up a GitHub Actions workflow for CI/CD integration with azd.
3. **Deployment with azd** – Use `azd up` to provision resources and deploy the application code. Verify everything is running, and then configure your local environment for iterative development.

By the end, a coding agent (or developer) can run through these steps and have the full stack deployed on Azure, with CI/CD pipeline configured and guidance for local testing.

## Azure Resources and Architecture

We will provision the following Azure resources in the **dev** environment (all in a single resource group):

* **Azure Container Registry (ACR)** – To store the Docker image for the Express API.
* **Azure Container Apps** – A Container App instance (within a Container Apps Environment) to run the Express API container. This will be publicly accessible via HTTPS.
* **Azure Database for PostgreSQL (Flexible Server)** – A managed Postgres database for persistent data, with credentials injected into the API.
* **Azure Static Web App (SWA)** – Hosts the front-end React app as static assets, served globally with an `<your-app>.azurestaticapps.net` domain.
* **Service Connector / Secret Injection** – The Postgres connection string is made available to the API Container App as an environment secret named `DATABASE_URL`. This is accomplished in our Bicep template by creating a secret and environment variable in the Container App configuration, equivalent to using an Azure Service Connector to inject the secret.

**Architecture Overview:** The React single-page app (SPA) calls the Express API over HTTPS. The API reads and writes to Postgres via Prisma. We enable cross-origin requests (CORS) to allow the front-end’s domain to call the API. Azure Developer CLI will help wire up the connection string securely and manage deployment flows.

## Project Manifest (`azure.yaml`)

The `azure.yaml` file defines our project structure for azd. It declares two services: `api` (the Node/Express backend) and `web` (the React front-end). It also specifies how each service is hosted on Azure. Below is the **azure.yaml** configuration:

```yaml
name: ai-app-starter-postgres
services:
  # Express API Service
  api:
    project: ./api                # Path to the Express API project (assumes a Dockerfile here)
    language: js                  # Node.js project
    host: containerapp            # Deploy as an Azure Container App
    docker:                       # Docker build context for the API service
      path: ./api/Dockerfile      # Path to the Dockerfile for building the image
      context: ./api              # Build context directory
    # No explicit resourceName means azd will name the Container App using the pattern "<env><service>"
    # e.g., "devapi" for env "dev" and service "api"
    environmentVariables:        # (Optional) Additional env vars if needed
      # These can be used to supply non-secret config to the container. Secret DB URL is set via Bicep (see infra).
      - PORT=3000                # Example: define the port if needed by your app

  # React Front-end Service
  web:
    project: ./web               # Path to the React front-end project (Vite app)
    language: js                 # JavaScript/TypeScript front-end
    host: staticwebapp           # Deploy as an Azure Static Web App
    # The Static Web App build & deployment is handled by azd:
    # It will run the front-end build and upload the static files.
    # We specify output directory and any build hooks if needed.
    dist: dist                   # Output folder after building the React app (Vite's default output)
    hooks:
      # Before packaging the Static Web App, inject API URL into the front-end build environment.
      prepackage:
        # On Windows runners
        windows:
          shell: pwsh
          run: |
            echo "VITE_API_URL=\"$Env:API_URL\"" > .env.local
        # On Linux/macOS runners
        posix:
          shell: sh
          run: |
            echo "VITE_API_URL=\"$API_URL\"" > .env.local
      # After deployment, remove the temporary .env.local file
      postdeploy:
        windows:
          shell: pwsh
          run: rm .env.local
        posix:
          shell: sh
          run: rm .env.local
```

**Explanation:**

* The `api` service is configured to deploy as a Container App. We specify `docker.path` and `docker.context` so azd knows how to build the image. On deploy, azd will build the Docker image from `./api/Dockerfile`, push it to ACR, and update the Container App with the new image. We don't hard-code a resource name, letting azd use the default naming convention (e.g. *devapi* for a **dev** environment).
* The `web` service is set to use Azure Static Web Apps. We point to the `./web` project and its build output directory (`dist`). The **hooks** section creates a `.env.local` file with `VITE_API_URL` before building the React app. This injects the API’s URL at build time so that the front-end knows how to reach the API. We use the environment variable `API_URL` (populated from our infrastructure outputs) to set `VITE_API_URL`. Vite will include this in the built files (since it uses the `VITE_` prefix convention). After deployment, the hook removes the temp file. This hook mechanism follows Azure’s guidance for passing configuration to front-end build processes.

**Note:** Azure Developer CLI automatically makes outputs from the infrastructure available as environment variables to these hooks. In our case, we will output the API’s URL (as `API_URL`) from the Bicep template, so `$API_URL` in the hook will be the deployed API endpoint. This is how azd “pre-configures” connection settings between services. For example, the `API_URL` will contain the Container App’s domain, and our API service will also get a `DATABASE_URL` environment variable for Postgres (set in Bicep).

## Infrastructure as Code (`infra/main.bicep`)

Next, we define the Azure resources using a Bicep template. Below is `infra/main.bicep` which declares all required resources and outputs. The Bicep template uses parameters for some configurable values (like the database admin password) and sets up resource dependencies appropriately:

```bicep
// Parameters
param location string = resourceGroup().location

@description('Name for the Azure Container Registry')
param acrName string = '${uniqueString(resourceGroup().id)}acr'  // unique ACR name based on RG ID
@description('PostgreSQL administrator username')
param postgresAdminUser string = 'azureuser'
@secure()
@description('PostgreSQL administrator password (set via azd env)')
param postgresAdminPassword string
@description('Initial Postgres database name')
param postgresDbName string = 'appdb'

// Resource: Azure Container Registry (ACR)
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false  // Use managed identity for access; no admin user
  }
}

// Resource: Container Apps Environment (for Azure Container Apps)
resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${name}-env'  // e.g. "ai-app-starter-postgres-dev-env"
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      // For brevity, not creating a Log Analytics workspace here; container app will use platform default logging.
    }
  }
}

// Resource: Azure Container App for the Express API
resource apiContainerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: azdEnvironment().environmentName == '' ? 'api' : '${azdEnvironment().environmentName}-api'
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true            // Expose to public internet
        targetPort: 3000          // The port our Express app listens on
        allowInsecure: false
        corsPolicy: {            
          allowedOrigins: ['*']   // Allow all origins (for dev/testing). Lock down to front-end domain as needed.
        }
      }
      registries: [ // Grant access to the ACR
        {
          server: acr.properties.loginServer
          identity: 'system'     // Use the container app's system-managed identity to auth to ACR
        }
      ]
      secrets: [
        {
          name: 'DATABASE_URL'
          value: 'Server=${pgServer.name}.postgres.database.azure.com;Database=${postgresDbName};Port=5432;User Id=${postgresAdminUser}@${pgServer.name};Password=${postgresAdminPassword};Ssl Mode=Require;'
        }
      ]
    }
    identity: {
      type: 'SystemAssigned'    // Enable a system-assigned managed identity (used for ACR pull)
    }
    template: {
      containers: [
        {
          name: 'api'   // container name
          image: '${acr.properties.loginServer}/${apiContainerApp.name}:latest'
          resources: {
            cpu: 0.5
            memory: '1.0Gi'
          }
          env: [
            // Reference the secret for DATABASE_URL as an environment variable in the container
            {
              name: 'DATABASE_URL'
              secretRef: 'DATABASE_URL'
            }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 1 }  // Keep one instance (adjust as needed)
    }
  }
  dependsOn: [
    acr,
    containerEnv
  ]
}

// Resource: Assign ACR Pull role to the Container App's identity (for image pull)
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, apiContainerApp.name, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')  // AcrPull role ID:contentReference[oaicite:7]{index=7}
    principalId: apiContainerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Resource: PostgreSQL Flexible Server
resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: uniqueString(resourceGroup().id, 'pg')   // generate a unique name for the server
  location: location
  properties: {
    version: '14'
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32        // minimum storage size
    }
    createMode: 'Create'
    availabilityZone: '1'      // For single-zone deployment (no HA)
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      // Use public access (no VNet). We'll add firewall rules below to control access.
      publicNetworkAccess: 'Enabled'
    }
  }
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
}

// Resource: Initial Database on the Postgres server
resource pgDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  name: postgresDbName
  parent: pgServer
  properties: {
    charset: 'UTF8'
    collation: 'en_US.UTF8'
  }
}

// Resource: Firewall rule to allow Azure services (e.g., Container App) to access Postgres
resource pgAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  name: 'AllowAllAzureServices'
  parent: pgServer
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Resource: Azure Static Web App (for React front-end)
resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: '${azdEnvironment().environmentName}-web'   // e.g., "dev-web"
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      skipGithubActionWorkflowGeneration: true  // We'll use our own CI/CD pipeline
    }
  }
}

// Outputs
output API_URL string = apiContainerApp.properties.configuration.ingress.fqdn
output STATIC_WEB_APP_URL string = staticWebApp.properties.defaultHostname
```

**Key points in the Bicep template:**

* **Container Registry and Image:** We create an ACR (`Microsoft.ContainerRegistry/registries`). We disable the admin user and instead use the Container App’s managed identity for pulling images. The Container App’s `configuration.registries` section references the ACR login server and uses identity-based auth. We assign the built-in **AcrPull** role to the Container App’s identity on the ACR – this grants it permission to pull images securely, without embedding credentials.

* **Container App:** The `apiContainerApp` resource is our Azure Container App for the Express API. We attach it to a **Managed Environment** (`containerEnv`) for Container Apps. In `template.containers[0]`, we reference the Docker image to deploy. We construct the image name as `<acr-login-server>/<container-app-name>:latest`. On first deployment, this image tag may not exist yet, but azd will build and push it during the *deploy* phase. We expose port 3000 (matching the Express app’s listening port) and enable external ingress. We also set a CORS policy allowing all origins (`allowedOrigins: ['*']`) for simplicity – in production, you should restrict this to the Static Web App’s domain, but for dev/testing this permits the front-end to call the API without CORS issues.

* **Database Connection Secret:** In `configuration.secrets`, we create a secret named `DATABASE_URL` that contains the Postgres connection string (using the server name, DB name, and credentials). In `template.containers.env`, we reference that secret by name, which injects it as the `DATABASE_URL` environment variable in the container. This means the Express API (and Prisma) can read `process.env.DATABASE_URL` at runtime, and it will have the correct connection string. The actual password remains secure in Azure (not exposed in plain text in our code or logs).

* **PostgreSQL Flexible Server:** We deploy a Postgres instance with a unique server name (Azure will suffix `.postgres.database.azure.com`). We use **Burstable (B1ms)** SKU on **Postgres 14** for a cost-effective dev setup. The admin username is set to `azureuser` (you can change as needed; some names like "postgres" or "admin" are reserved). The admin password is a secure parameter – we’ll supply it via azd environment rather than hard-code. We enable public network access on the DB and then add a firewall rule `AllowAllAzureServices` (0.0.0.0/32). This special rule allows Azure services to connect (including our Container App). By default, the database is not accessible from the public internet (except Azure IPs); if you need local connectivity, you can add a firewall rule for your dev machine’s IP or use Azure Data Proxy. We also create an **`appdb`** database on the server to be used by the app (the flexible server comes with a default "postgres" database as well).

* **Static Web App:** The Static Web App resource is created with SKU Free. We set `skipGithubActionWorkflowGeneration: true` to prevent Azure from trying to create its own deployment workflow, since we are managing deployment via our azd pipeline. We do *not* specify a repository URL or branch, meaning this static site isn’t connected to any particular repo – we will deploy to it manually using azd/CLI. The output `STATIC_WEB_APP_URL` will give the default `<random-name>.azurestaticapps.net` domain once deployed.

* **Outputs:** We output the API’s URL (`API_URL`) using the Container App’s generated FQDN (fully qualified domain name). Azure Container Apps assigns a domain like `<containerapp>.<region>.azurecontainerapps.io` for external ingress. We also output the Static Web App’s default hostname (`STATIC_WEB_APP_URL`), which is a convenience for knowing where the front-end is served (e.g. to configure CORS or just to visit the site). These outputs are captured by azd and made available as environment variables to our services and pipeline. For instance, azd will set an environment variable `API_URL` that our `azure.yaml` hooks use to inject into the React build.

**Secure Parameters:** Notice `postgresAdminPassword` is marked as `@secure()`. We will provide this value through azd’s environment configuration rather than hardcoding. This keeps the password out of source control and ensures azd treats it carefully. Specifically, we will run `azd env set POSTGRES_ADMIN_PASSWORD "<your-password>"` before deployment (or let azd prompt us securely). The `DATABASE_URL` secret constructed in the Container App uses this password at deployment time, and the value will be stored in Azure as a secret.

## GitHub Actions CI/CD Workflow

We will use **GitHub Actions** for continuous deployment, leveraging the Azure Developer CLI to automate provisioning and deployment. The workflow file (usually named `.github/workflows/azure-dev.yml`) is configured to run on pushes to the main branch. It logs into Azure using federated credentials (OIDC) and then runs `azd provision` and `azd deploy`.

Below is the **azure-dev.yml** workflow configuration:

```yaml
name: Deploy to Azure (azd)

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  id-token: write   # Required for OIDC login
  contents: read    # Needed to fetch repository code

env:
  AZURE_ENV_NAME: dev                 # Azure Developer CLI environment name to deploy to
  AZURE_LOCATION: westus2             # Azure region for deployment (must match what's used in azd env)
  AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}  # Subscription ID (set as repo variable or secret)
  AZURE_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}              # Tenant ID for Azure (repo variable)
  AZURE_CLIENT_ID: ${{ vars.AZURE_CLIENT_ID }}              # Client ID of the Azure AD app (service principal) for OIDC
  # Note: The above AZURE_* variables are populated by `azd pipeline config` when you set up the pipeline:contentReference[oaicite:16]{index=16}.

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Azure Developer CLI
        uses: Azure/setup-azd@v2

      - name: Setup Node.js (for front-end build)
        uses: actions/setup-node@v4
        with:
          node-version: 18

      # Azure login using OIDC (Federated Identity)
      - name: Log in with Azure (Federated)
        if: ${{ env.AZURE_CLIENT_ID != '' }}
        run: |
          azd auth login \
            --client-id "$AZURE_CLIENT_ID" \
            --tenant-id "$AZURE_TENANT_ID" \
            --federated-credential-provider "github"
        shell: bash

      # (Fallback for using client secret credentials, if OIDC is not configured)
      - name: Log in with Azure (Client Credentials)
        if: ${{ env.AZURE_CLIENT_ID == '' }}
        env:
          AZURE_CREDENTIALS: ${{ secrets.AZURE_CREDENTIALS }}
        run: |
          # AZURE_CREDENTIALS should be a JSON with clientId, clientSecret, tenantId (set by azd if not using OIDC)
          creds=$(echo "$AZURE_CREDENTIALS" | jq -r ".")
          azd auth login \
            --client-id "${creds.clientId}" \
            --client-secret "${creds.clientSecret}" \
            --tenant-id "${creds.tenantId}"
        shell: bash

      - name: Provision Azure Resources
        run: azd provision --no-prompt
        env:
          AZURE_ENV_NAME: ${{ env.AZURE_ENV_NAME }}
          AZURE_LOCATION: ${{ env.AZURE_LOCATION }}
          AZURE_SUBSCRIPTION_ID: ${{ env.AZURE_SUBSCRIPTION_ID }}
          # AZD_INITIAL_ENVIRONMENT_CONFIG contains secure values (like the DB password) for the environment
          AZD_INITIAL_ENVIRONMENT_CONFIG: ${{ secrets.AZD_INITIAL_ENVIRONMENT_CONFIG }}

      - name: Deploy Application Code
        run: azd deploy --no-prompt
        env:
          AZURE_ENV_NAME: ${{ env.AZURE_ENV_NAME }}
          AZURE_LOCATION: ${{ env.AZURE_LOCATION }}
          AZURE_SUBSCRIPTION_ID: ${{ env.AZURE_SUBSCRIPTION_ID }}
```

**What this workflow does:**

* It triggers on any push to `main` (or `master`) and can also be run manually (`workflow_dispatch`). Adjust the branch name as needed for your repo’s default branch.
* **OIDC Authentication:** It uses GitHub’s OpenID Connect to authenticate to Azure. The `permissions: id-token: write` setting and the `azure/login` step (here we use `azd auth login` for consistency with azd) allow the workflow to exchange a GitHub OIDC token for an Azure AD token, logging in as a service principal. The `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` are set as repository variables or secrets by the pipeline setup process. If OIDC is properly configured via `azd pipeline config`, the first login step will succeed (using the federated credential). We include a fallback step to use a service principal client secret (`AZURE_CREDENTIALS`) if OIDC is not available – this would be a JSON secret containing `clientId`, `clientSecret`, `tenantId` for a service principal. In most cases, after running `azd pipeline config`, you’ll be using OIDC (no secret needed).
* **Azure Provisioning & Deploy:** After login, the workflow runs `azd provision` to ensure infrastructure is up-to-date (creating any new resources defined in Bicep). Then it runs `azd deploy` to build and deploy the application code (Docker image build/push, Static Web App content upload, etc). We pass `--no-prompt` to avoid any interactive prompts in CI. The environment name (`AZURE_ENV_NAME`) is set to “dev” (as we chose), and `AZD_INITIAL_ENVIRONMENT_CONFIG` is a secret that azd uses to inject any required environment values (like the `POSTGRES_ADMIN_PASSWORD` and other secrets) during CI runs. This secret is created by `azd pipeline config` to store your environment’s `.env` file securely in GitHub.

**Setting up the Pipeline:** You can generate and configure this workflow automatically by running `azd pipeline config`. This azd command will: create a service principal (and federated credentials) for GitHub, set the necessary secrets/variables in your repository, and commit an `azure-dev.yml` workflow to your repo. It handles connecting GitHub to Azure so that the workflow can run seamlessly. In summary, `azd pipeline config` **creates the Azure AD app/SP, configures repo secrets or OIDC, and pushes the workflow file**. After running it, you should see this GitHub Actions workflow in your repo, and on the next push to main, it will trigger a deployment.

*Security:* The workflow avoids storing sensitive Azure credentials in plaintext. Using OIDC is recommended (no long-lived secrets). The database password is kept in Azure Key Vault equivalent storage by azd (and provided via `AZD_INITIAL_ENVIRONMENT_CONFIG` secret to the workflow). This means the CI pipeline has what it needs to deploy, but the actual secret is not exposed in logs or code.

## Deploying with Azure Developer CLI (`azd up`)

With everything configured, deploying the entire stack is straightforward. Azure Developer CLI can provision all resources and deploy code in one command: `azd up`. This command will create or update Azure resources (as defined in Bicep) and then build and deploy your application code to those resources.

Here’s how to use it for our project:

1. **Install Azure Developer CLI** if you haven’t already. (See Azure’s documentation for installation instructions.)
2. **Login to Azure** locally by running `azd auth login` (or `az login` if you prefer to authenticate via the Azure CLI).
3. **Initialize an azd environment:** In the project root (where `azure.yaml` is located), run:

   ```bash
   azd env new dev
   ```

   This will create a new environment named “dev”. You’ll be prompted to select an Azure subscription and location during this step (unless you set `AZURE_SUBSCRIPTION_ID` and `AZURE_LOCATION` beforehand). The environment corresponds to a set of Azure resources and can have its own config. We use a single "dev" environment here as planned.
4. **Set the Postgres password:** Run the following to set the Postgres admin password in your azd environment (replace with a strong password of your choice):

   ```bash
   azd env set POSTGRES_ADMIN_PASSWORD "<YOUR-SECURE-PASSWORD>"
   ```

   This stores the password in the local `.azure/<env>/.env` file (and this will be encrypted when `azd pipeline config` stores it in GitHub). Because our Bicep param is named `postgresAdminPassword`, azd will match the env var `POSTGRES_ADMIN_PASSWORD` to that parameter. Now azd can deploy the database without interactive prompts.
5. **Provision and Deploy:** Run:

   ```bash
   azd up
   ```

   Azure Developer CLI will provision all resources and deploy the code in one go. You’ll see output as it builds the Docker image, pushes to ACR, creates the Postgres server, sets up the Static Web App, etc. The first time might take a few minutes. If successful, azd will output the endpoints for your application. In particular, it should show the Static Web App URL and the API URL (which we also output in our Bicep). For example, you might see:

   * **API URL:** `https://<dev-api>.<region>.azurecontainerapps.io` (this is also available as `API_URL` in your azd environment)
   * **Static Web App URL:** `https://<random-name>.<hash>.azurestaticapps.net`

   You can click or open the Static Web App URL, and it should load your React front-end. The front-end will internally call the API via the `VITE_API_URL` we configured (pointing to the Container App domain).

During `azd up`, if anything goes wrong (e.g., a resource fails to provision), azd will report the error. Common issues might be: name collisions (ensure global resource names are unique), or a wrong password format (Azure requires the Postgres password to meet certain complexity criteria). Fix any issues and re-run `azd up` as needed – it is idempotent and will only create missing resources.

**Verification:** Once `azd up` completes successfully, verify the running application:

* In the Azure portal, you should see a new Resource Group (named `{project}-{env}`, e.g. **ai-app-starter-postgres-dev**) containing the resources: the Container App, ACR, Postgres server, Static Web App, and supporting resources.
* Access the front-end URL in a browser. It should display the React app. Try any functionality that triggers API calls – the requests should succeed. For example, if the app has a test endpoint or database query, you should get valid responses from the API. Internally, the API is connecting to Postgres with the `DATABASE_URL` we provided.
* You can also directly test the API by hitting the `API_URL` (for instance, `https://<dev-api>.<region>.azurecontainerapps.io/endpoint`). If CORS is enabled as above, you could call it from tools like Postman or your browser JS console. We allowed `*` origins in CORS for dev, so it should respond.

## Local Development and Iteration

With the cloud environment in place, you can continue developing the app locally and use azd to deploy updates, or run the app against cloud resources for testing. Here are some tips for local development:

* **Local API with Cloud Database:** You can run the Express API on your machine and have it connect to the Azure Postgres database. To do this, you’ll need to allow your local IP through the Postgres firewall. You can add a firewall rule in the Azure portal for the Postgres server (or via CLI) with your public IP, or set `publicNetworkAccess` to `Enabled` and add a rule for a range. Alternatively, for development, you might run a local Postgres instance with the same schema. If you choose to use the cloud DB, update your `.env` file in the `api` project with `DATABASE_URL` pointing to the Azure Postgres (you can find the exact connection string in the Azure Portal or use the one from our Bicep output, adding your password). Ensure the connection string uses `sslmode=require`. Also, update the firewall as noted, because by default Azure DB will reject non-Azure IPs.

* **Local Front-end with Local/Cloud API:** You can run the React dev server (`npm run dev` inside `web/`) which typically runs on localhost:3000. If you want this local front-end to call the API, set a proxy or environment variable. In a Vite app, you can create a `.env.development` with `VITE_API_URL=http://localhost:3000` (if you run the API locally on 3000) or pointing to the cloud API URL. This way, while coding the front-end, you can hit an API running locally or in Azure. Make sure to enable CORS on the API accordingly (our Azure Container App allowed `*`, and for local Express you can use a library like `cors()` with appropriate origin).

* **Iterate and Deploy:** As you make changes to the code, you can deploy updates with `azd deploy` (no need to reprovision unless infra changed). For example, if you update the API routes or front-end logic, simply commit and push to GitHub – the GitHub Actions pipeline will automatically build and deploy the latest code to Azure (because we set it up for pushes to main). You can also run `azd deploy` locally for quick testing; azd will rebuild the Docker image, upload it, and restart the Container App, and upload new static files to the Static Web App. This tight loop is helpful for testing changes in a real Azure environment.

* **Database Migrations/Prisma:** If your project uses Prisma migrations, you’d handle them as part of your deploy process or CI. For instance, you might run `npx prisma migrate deploy` inside the API container startup. Ensure your Dockerfile or startup script covers applying any pending migrations to the Azure Postgres. Alternatively, run migrations locally pointed at the Azure DB. Azure Postgres is just standard Postgres – you can connect with psql or any client using the `postgresAdminUser` and password, and run schema changes. For production-grade workflows, include this in CI/CD steps.

* **Monitoring and Logs:** You can view Container App logs with `az containerapp logs show -n <app-name> -g <resource-group>` or via the Azure Portal (Container Apps > your app > Logs). This can help debug runtime issues. The Static Web App provides a staging environment and dev server capability if needed (in Standard tier), but for Free tier you’ll rely on local builds and the single production environment.

* **Cleaning up:** When done, you can remove all resources with `azd down` or by deleting the resource group. This avoids incurring costs. The database and Container App incur some cost when running (Postgres Flexible Server dev SKU and container app compute). During development, you might scale down or pause these if supported (e.g., flexible server supports stopping). For now, since we used a small SKU and one container, costs should be low in dev.

## Conclusion

Following this guide, we deployed the **ai-app-starter-postgres** application to Azure using infrastructure-as-code and Azure Developer CLI. We set up a secure connection between the API and the database (with the connection string managed as a secret), and used azd to simplify getting everything running end-to-end. The `azd up` command provisioned and deployed our app in one step, and we configured a GitHub Actions workflow to automate future deployments on every push to main.

This approach provides a repeatable and consistent deployment process. A developer or “coding agent” can use the provided configurations to spin up the entire stack in their Azure subscription and have a cloud environment for development or testing. They can then iteratively develop the application, with the ability to test locally or deploy updates quickly via the CLI or CI pipeline.

**Next steps:** You can extend this setup by adjusting resource settings (e.g., scaling out the Container App or moving to a production-tier Postgres), adding monitoring (Application Insights, etc.), or introducing other Azure services as needed. With the Azure Developer CLI framework in place, adding new resources (via Bicep) and exposing their settings to your app (via outputs and azd config) becomes a structured process. Happy coding!
