# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build     # emits dist/

# --- runtime ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma

# Generate Prisma client with correct binary targets
RUN npx prisma generate
COPY --from=build /app/node_modules/.bin/ts-node ./node_modules/.bin/

# Generate Prisma client
# Expose port 
EXPOSE 4000

# Start the server
CMD ["npm", "run", "start"]