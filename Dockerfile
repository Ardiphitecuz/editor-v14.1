# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source dan build
COPY . .
RUN npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Hanya install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built React app dari stage 1
COPY --from=builder /app/dist ./dist

# Copy server dan backend
COPY server.js ./
COPY api/ ./api/
COPY backend/ ./backend/
COPY public/ ./public/

# Port yang diexpose
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
