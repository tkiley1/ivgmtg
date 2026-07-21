FROM node:20-bookworm-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=65534:65534 /app/public ./public
COPY --from=builder --chown=65534:65534 /app/.next/standalone ./
COPY --from=builder --chown=65534:65534 /app/.next/static ./.next/static
COPY --from=builder --chown=65534:65534 /app/drizzle ./drizzle
COPY --from=builder --chown=65534:65534 /app/scripts ./scripts
USER 65534:65534
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "scripts/start.sh"]
