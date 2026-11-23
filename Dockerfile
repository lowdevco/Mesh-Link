# Production Multi-Stage Dockerfile for MeshLink
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

# Hugging Face Spaces and container best practices: run as non-root
USER node

EXPOSE 7860

CMD ["node", "server.js"]
