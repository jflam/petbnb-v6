import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  return {
    plugins: [
      react(),
      // Plugin to copy staticwebapp.config.json to dist directory
      {
        name: 'copy-swa-config',
        closeBundle() {
          const srcPath = resolve(__dirname, 'staticwebapp.config.json');
          const destPath = resolve(__dirname, 'dist', 'staticwebapp.config.json');
          try {
            copyFileSync(srcPath, destPath);
            console.log('Successfully copied staticwebapp.config.json to dist directory');
          } catch (err) {
            console.error('Error copying staticwebapp.config.json:', err);
          }
        }
      }
    ],
    server: {
      port: 3000,
      // Only use proxy in development, in production we'll use VITE_API_BASE_URL
      proxy: isDev ? { '/api': 'http://localhost:4000' } : undefined
    },
    // Ensure environment variables are properly loaded
    define: {
      'process.env': {}
    }
  };
});
