@description('The location used for all deployed resources')
param location string = resourceGroup().location

@description('Tags that will be applied to all resources')
param tags object = {}


@secure()
param postgresDatabasePassword string
param serverExists bool

@description('Id of the user or app to assign application roles')
param principalId string

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = uniqueString(subscription().id, resourceGroup().id, location)

// Monitor application with Azure Monitor
module monitoring 'br/public:avm/ptn/azd/monitoring:0.1.0' = {
  name: 'monitoring'
  params: {
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
    applicationInsightsDashboardName: '${abbrs.portalDashboards}${resourceToken}'
    location: 'westus2'
    tags: tags
  }
}
// Container registry
module containerRegistry 'br/public:avm/res/container-registry/registry:0.1.1' = {
  name: 'registry'
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    location: location
    tags: tags
    publicNetworkAccess: 'Enabled'
    roleAssignments:[
      {
        principalId: serverIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
      }
    ]
  }
}

// ── Static Web App host for the “client” service ───────────────────────────
resource client 'Microsoft.Web/staticSites@2024-04-01' = {
  name: '${abbrs.webStaticSites}${resourceToken}'   // e.g. stapp-d6itaqirtryda
  location: 'westus2'

  sku: {
    name:  'Free'   // or 'Standard', 'Basic' if you need paid tiers
    tier:  'Free'
  }
  properties: {
    allowConfigFileUpdates: true   // simple flag satisfies the schema
  }
  tags: union(tags, { 'azd-service-name': 'client' })
}

// Container apps environment
module containerAppsEnvironment 'br/public:avm/res/app/managed-environment:0.4.5' = {
  name: 'container-apps-environment'
  params: {
    logAnalyticsWorkspaceResourceId: monitoring.outputs.logAnalyticsWorkspaceResourceId
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    zoneRedundant: false
  }
}
var postgresDatabaseName = 'aistarterapppostgresdb'
var postgresDatabaseUser = 'psqladmin'
module postgresServer 'br/public:avm/res/db-for-postgre-sql/flexible-server:0.1.4' = {
  name: 'postgresServer'
  params: {
    name: '${abbrs.dBforPostgreSQLServers}${resourceToken}'
    skuName: 'Standard_B1ms'
    tier: 'Burstable'
    administratorLogin: postgresDatabaseUser
    administratorLoginPassword: postgresDatabasePassword
    geoRedundantBackup: 'Disabled'
    passwordAuth:'Enabled'
    firewallRules: [
      {
        name: 'AllowAllIps'
        startIpAddress: '0.0.0.0'
        endIpAddress: '255.255.255.255'
      }
    ]
    databases: [
      {
        name: postgresDatabaseName
      }
    ]
    location: location
  }
}

module serverIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.2.1' = {
  name: 'serveridentity'
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}server-${resourceToken}'
    location: location
  }
}
module serverFetchLatestImage './modules/fetch-container-image.bicep' = {
  name: 'server-fetch-image'
  params: {
    exists: serverExists
    name: 'server'
  }
}

// Construct the database URL with lowercase secret name
var dbConnectionString = 'postgres://${postgresDatabaseUser}:${postgresDatabasePassword}@${postgresServer.outputs.name}.postgres.database.azure.com:5432/${postgresDatabaseName}?sslmode=require'

module server 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'server'
  params: {
    name: 'server'
    ingressTargetPort: 4000
    scaleMinReplicas: 1
    scaleMaxReplicas: 10
    secrets: {
      secureList:  [
        {
          name: 'database-url' // lowercase name compliant with Container Apps restrictions
          value: dbConnectionString
        }
      ]
    }
    containers: [
      {
        image: serverFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        name: 'main'
        resources: {
          cpu: json('0.5')
          memory: '1.0Gi'
        }
        env: [
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: monitoring.outputs.applicationInsightsConnectionString
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: serverIdentity.outputs.clientId
          }
          {
            name: 'PORT'
            value: '4000'
          }
          {
            name: 'DATABASE_URL' // Keep uppercase env var name for Prisma
            secretRef: 'database-url' // Reference the lowercase secret name
          }
        ]
      }
    ]
    managedIdentities:{
      systemAssigned: false
      userAssignedResourceIds: [serverIdentity.outputs.resourceId]
    }
    registries:[
      {
        server: containerRegistry.outputs.loginServer
        identity: serverIdentity.outputs.resourceId
      }
    ]
    environmentResourceId: containerAppsEnvironment.outputs.resourceId
    location: location
    tags: union(tags, { 'azd-service-name': 'server' })
  }
}
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output AZURE_RESOURCE_SERVER_ID string = server.outputs.resourceId
output AZURE_RESOURCE_AISTARTERAPPPOSTGRESDB_ID string = '${postgresServer.outputs.resourceId}/databases/aistarterapppostgresdb'
