FROM node:20-alpine AS builder

WORKDIR /build

# API dependencies
COPY api/package*.json ./api/
COPY api/tsconfig.json ./api/
COPY api/nest-cli.json ./api/
WORKDIR /build/api
RUN npm ci

# Copy API source
COPY api/src ./src
COPY shared ./shared
RUN npm run build

# Web dependencies
WORKDIR /build
COPY web/package*.json ./web/
WORKDIR /build/web
RUN npm ci

# Copy Web source
COPY web/src ./src
COPY web/public ./public
COPY web/tsconfig.json ./
RUN npm run build

# Final image
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache nut-upsc

# Copy API
COPY --from=builder /build/api/dist ./api/dist
COPY --from=builder /build/api/package*.json ./api/
COPY --from=builder /build/api/node_modules ./api/node_modules

# Copy Web
COPY --from=builder /build/web/build ./web/build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "api/dist/main.js"]