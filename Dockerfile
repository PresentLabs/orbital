FROM node:24-bookworm-slim AS astro
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
COPY public ./public
COPY services/payload/src ./services/payload/src
ARG PUBLIC_SITE_URL
RUN npm run build
CMD ["npm", "start"]

FROM node:24-bookworm-slim AS payload
RUN apt-get update && apt-get install -y --no-install-recommends php-cli php-xml php-mbstring php-curl php-bcmath && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/payload/package.json services/payload/package-lock.json ./
RUN npm ci
COPY services/payload/ ./
# Keep the billing engine at the path resolved from /app/src/billing/bridge.ts.
COPY modules/billing-cl /modules/billing-cl
COPY modules/woo-dte-chile/wordpress/woo-dte-chile /modules/woo-dte-chile/wordpress/woo-dte-chile
ENV BILLING_ENGINE_PATH=/modules/billing-cl/engine.php
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN PAYLOAD_SECRET=orbital-build-only npm run build
CMD ["node", "serve.mjs"]
