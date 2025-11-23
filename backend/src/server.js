import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import voterRoutes from './routes/voterRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

// File path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.join(__dirname, '../../frontend/dist');

const app = express();

// --- CORS ---
const corsOrigin =
  process.env.NODE_ENV === 'production'
    ? true
    : process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// --- Security & Helpers ---
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// --- API Routes ---
app.use('/api/voter', voterRoutes);
app.use('/api/admin', adminRoutes);

// Health check route for Koyeb
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Serve Frontend (built /dist) ---
app.use(express.static(frontendDistPath));

// --- SPA Fallback ---
// This ensures only NON-API routes go to index.html
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// --- Start Server ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
