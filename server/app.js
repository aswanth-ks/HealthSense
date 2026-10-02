import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import meRoutes from './routes/meRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// The Express app, shared by the local server (server.js) and Vercel (default export).
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health-check', (_req, res) => res.json({ ok: true }));

// Make sure MongoDB is connected before any route that needs it (cached after the first call).
app.use('/api', (req, res, next) => {
  connectDB().then(() => next()).catch((err) => res.status(503).json({ message: `Database unavailable: ${err.message}` }));
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/me', meRoutes);
app.use('/api', deviceRoutes); // /api/ingest, /api/device/config

app.use(notFound);
app.use(errorHandler);

export default app;
