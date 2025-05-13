# Configuring Environment Variables in Azure Static Web Apps

When deploying your application to Azure Static Web Apps, you'll need to configure environment variables to point to your Container App or other backend services. This document explains how to properly configure these settings.

> **Note**: The `staticwebapp.config.json` file is automatically copied to the `dist` directory during the build process through a custom Vite plugin in `vite.config.ts`. This ensures that Azure Static Web Apps can find and use this configuration file.

## Option 1: Azure Static Web Apps Configuration

You can configure application settings directly in the Azure Portal or using Azure CLI:

### Azure Portal Method

1. Go to the Azure Portal and navigate to your Static Web App resource
2. Select "Configuration" from the sidebar
3. Under the "Application settings" tab, click "Add"
4. Add your variable with the exact name `VITE_API_BASE_URL` 
5. Set the value to your Container App URL: `https://server.happybay-75f07611.westcentralus.azurecontainerapps.io`
6. Click "Save"

### Azure CLI Method

```bash
az staticwebapp appsettings set \
  --name YOUR_STATIC_WEBAPP_NAME \
  --resource-group YOUR_RESOURCE_GROUP \
  --setting-names VITE_API_BASE_URL="https://server.happybay-75f07611.westcentralus.azurecontainerapps.io"
```

## Option 2: Build-time Environment Configuration

Alternatively, you can build your application with the environment variables set at build time:

1. Update your `.env.production` file with the correct URL
2. Build your application with `npm run build`
3. Deploy the built files to Azure Static Web Apps

## Security Considerations

- Remember that all environment variables prefixed with `VITE_` will be embedded in your client-side bundle
- Only include non-sensitive information that is safe to be exposed to users
- Never include API keys, secrets, or tokens in client-side environment variables
- For sensitive values, use a backend API to handle those requests

## Testing Environment Variables

You can test your configuration locally by:

1. Creating a `.env.local` file with your test values
2. Running `npm run dev` to test in development mode
3. Running `npm run build && npm run preview` to test the production build

## Troubleshooting

If your application isn't connecting to the API:

1. Check browser console for CORS errors
2. Verify the environment variable is correctly set
3. Ensure your Container App allows cross-origin requests from your Static Web App domain
4. Check the network tab to see if requests are being made to the correct URL
