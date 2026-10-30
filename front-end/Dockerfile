# ==============================================================================
# VisionCraft OS – Frontend Production Multi-Stage Dockerfile
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN mkdir -p public && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
