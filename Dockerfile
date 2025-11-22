# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy full source into builder
COPY backend ./backend
COPY frontend ./frontend

# Install deps and build
RUN cd backend && npm install
RUN cd frontend && npm install && npm run build

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy backend code and built frontend from builder
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]