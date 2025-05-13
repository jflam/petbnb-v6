# Azure Container App Integration Guide

This guide explains how the frontend application has been configured to connect to an Azure Container App directly.

## Changes Made

1. **Environment Variables Setup**:
   - Created `.env` file with `VITE_API_BASE_URL` variable pointing to the Container App
   - Added `.env.production` for production builds
   - Added TypeScript declarations in `env.d.ts` for better type support

2. **App.tsx Updates**:
   - Modified fetch calls to use `${API_BASE_URL}/api/...` instead of relative paths
   - Added fallback to empty string if environment variable is missing

3. **Vite Configuration**:
   - Updated `vite.config.ts` to conditionally use proxy only in development
   - Added support for environment variables in production builds

4. **Static Web Apps Configuration**:
   - Added `staticwebapp.config.json` with proper routing and security headers
   - Set up CSP headers to allow connections to the Container App
   - Modified Vite config to automatically copy the config file to the dist directory during build

5. **Documentation**:
   - Updated README.md with environment variables information
   - Added detailed guide for setting up environment variables in Azure Static Web Apps

## How It Works

- In **development**: Vite's proxy forwards `/api` requests to `http://localhost:4000`
- In **production**: API requests go directly to the Container App URL specified in environment variables

## Next Steps

1. **Configure CORS on the Container App**: 
   Ensure your Container App allows requests from your Static Web App domain.

2. **Set Environment Variables**: 
   When deploying to Azure Static Web Apps, set the `VITE_API_BASE_URL` application setting.

3. **Test End-to-End**: 
   Verify that the frontend can successfully connect to the Container App.

## Security Considerations

- Environment variables with `VITE_` prefix are embedded in the client-side bundle
- Only use this for non-sensitive, public URLs
- The CSP headers in `staticwebapp.config.json` restrict which domains the app can connect to
