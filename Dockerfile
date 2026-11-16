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
WORKDIR /app
COPY services/payload/package.json services/payload/package-lock.json ./
RUN npm ci
COPY services/payload/ ./
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN PAYLOAD_SECRET=orbital-build-only npm run build
CMD ["node", "serve.mjs"]
