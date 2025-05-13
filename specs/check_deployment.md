## 1  Checking PostgreSQL Flexible-Server quota **before you deploy**

### Portal (fastest)

1. Open **Subscriptions ▶ <your subscription> ▶ Usage + quotas**.
2. Add a filter **Service = Azure Database for PostgreSQL – Flexible Server** and another for the region (for example *West US 2*).
3. Look for the *BURSTABLEVCORES*, *GENERALPURPOSEVCORES*, *MEMORYOPTIMIZEDVCORES*, and *SERVERS* lines. They show **Current Value / Limit** so you can see immediately whether you still have free vCores or server slots in that region. ([Microsoft Learn][1])

If the current value already equals the limit, the deployment you attempted will fail with the “capacity exceeded / quota denied” error you just saw.

---

### CLI (scriptable)

The generic *Quota* REST API for PostgreSQL is not yet wired into the main `az postgres flexible-server` group, but you can call it with **`az rest`** (or the *Quota* preview extension) to incorporate the check into a pipeline:

```bash
# variables
SUB=$(az account show --query id -o tsv)
REGION=westus2        # the region you want to test
API="2024-11-01-preview"

# list all quota counters for Postgres Flexible Server in the region
az rest \
  --method get \
  --url "https://management.azure.com/subscriptions/${SUB}/providers/Microsoft.DBforPostgreSQL/locations/${REGION}/resourceType/flexibleServers/usages?api-version=${API}" \
  --query "value[].{name:name.value, current:currentValue, limit:limit}" \
  -o table
```

The response tells you, for each counter (vCores, servers, storage, etc.), how many units are **in use** and what the **limit** is. If `current == limit`, you need either to pick another region or to file a quota increase request. ([Microsoft Learn][2])

---

### Requesting more quota (if you must stay in the same region)

Use the portal: **Help + support ▶ Create a support request ▶ Quota** and pick *Azure Database for PostgreSQL Flexible Server*. Provide the number of extra vCores or server instances you need. ([Microsoft Learn][3])

---

## 2  Making your Bicep file region-agnostic (so you can deploy where quota exists)

Instead of hard-wiring every resource to the resource-group location, add a **second location parameter just for the database** (defaults to the RG location, so nothing breaks if you don’t override it):

```bicep
// main.bicep  (excerpt only)

// The location for most resources (kept as is)
param location string = resourceGroup().location

// **New** parameter that lets you point the Postgres server (and its children)
// to a different Azure region when you run out of quota.
@allowed([
  'westus2'
  'westus'
  'centralus'
  'eastus'
  'eastus2'
])
param pgLocation string = location   // default = same as RG

// …

// Resource: PostgreSQL Flexible Server
resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: uniqueString(resourceGroup().id, 'pg')
  location: pgLocation          // <-- switches to the DB-specific region
  properties: {
    version: '16'
    administratorLogin: 'postgresql_user'
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    createMode: 'Create'
    availabilityZone: '1'
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
  }
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
}

// Child resources (database, firewall rule) inherit pgServer’s location
```

### Deploying to a region that still has quota

```bash
az deployment group create \
  --resource-group my-rg \
  --template-file main.bicep \
  --parameters pgLocation=eastus2
```

Only the PostgreSQL flexible server (and its database + firewall rule) move to **East US 2**; every other resource (ACR, Container Apps Environment, Log Analytics, Static Web Apps, etc.) still lands in the resource-group’s default region unless you give them their own overrides.

That single-parameter change lets you rerun the deployment in any region with spare quota while keeping the rest of the stack untouched.

---

**In short**

1. Check quota first (portal or `az rest` above).
2. If the target region is full, either file a quota-increase ticket or redeploy by passing `pgLocation=<other region>` without touching the rest of your Bicep template.

[1]: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-resolve-capacity-errors?utm_source=chatgpt.com "Azure Database for PostgreSQL flexible server - Learn Microsoft"
[2]: https://learn.microsoft.com/zh-cn/rest/api/postgresql/flexibleserver/quota-usages/list?view=rest-postgresql-flexibleserver-2024-11-01-preview&utm_source=chatgpt.com "Quota Usages - List - REST API (Azure PostgreSQL) | Microsoft Learn"
[3]: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-request-quota-increase?utm_source=chatgpt.com "How to request a quota increase - Azure Database for PostgreSQL ..."
