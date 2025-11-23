# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first (better caching)
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN cd backend && npm install
RUN cd frontend && npm install

# Copy the rest of the source
COPY backend ./backend
COPY frontend ./frontend

# Fix Vite permission issue (Alpine bug)
RUN chmod +x ./frontend/node_modules/.bin/vite

# Build frontend
RUN cd frontend && npm run build

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy backend and built frontend
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose port
WORKDIR /app/backend
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]
