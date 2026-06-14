FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY data/.gitkeep data/.gitkeep
COPY generated/plans/.gitkeep generated/plans/.gitkeep
COPY generated/exports/.gitkeep generated/exports/.gitkeep
EXPOSE 8787
CMD ["node", "apps/server/dist/index.js"]
