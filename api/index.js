// Vercel serverless entry: the whole Express API (server/app.js) runs as one function.
// vercel.json rewrites /api/* here; Express still sees the original /api/... path, so all routes work unchanged.
import app from '../server/app.js';

export default app;
