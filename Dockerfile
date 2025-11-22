FROM node:20-alpine AS builder
WORKDIR /app

# Install backend and frontend dependencies
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN cd backend && npm install
RUN cd frontend && npm install && npm run build

# Copy source and built frontend
COPY backend ./backend
COPY frontend/dist ./frontend/dist

# --- Runtime image ---
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy from builder
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]