import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import meRoutes from './routes/meRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { initRealtime } from './utils/realtime.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health-check', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/me', meRoutes);
app.use('/api', deviceRoutes); // /api/ingest, /api/device/config

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initRealtime(server);

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => server.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
