FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SITE_URL=https://zwds.bwliangc.com NODE_OPTIONS=--max-old-space-size=2048
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
RUN apk add --no-cache git
COPY . .
RUN npm run typecheck && npm test && npx --no-install tsx scripts/integration/ai.test.ts && npx --no-install tsx scripts/integration/heming.test.ts && npm run build
RUN npm prune --omit=dev --no-audit --no-fund && rm -rf .git docs scripts
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SITE_URL=https://zwds.bwliangc.com
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["npm","run","start","--","--hostname","0.0.0.0"]
