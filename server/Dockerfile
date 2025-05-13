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
COPY --from=build /app/knexfile.js ./
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/seeds ./seeds

# Copy the ts-node binary for seeding
COPY --from=build /app/node_modules/.bin/ts-node ./node_modules/.bin/

# Generate Prisma client
RUN npx prisma generate

# Start the server
CMD ["node", "dist/index.js"]