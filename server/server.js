import http from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { initRealtime } from './utils/realtime.js';

// On Vercel the platform invokes the exported app per request: no listen(), no Socket.IO.
// Locally (npm run dev / npm start) we run a normal HTTP server with live Socket.IO pushes.
if (!process.env.VERCEL) {
  const server = http.createServer(app);
  initRealtime(server);
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => server.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`)))
    .catch((err) => {
      console.error('MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

export default app;
