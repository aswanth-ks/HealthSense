// Vercel serverless entry used when the Vercel project's Root Directory is `client`.
// It runs the same Express API as the repository-root entry (../api/index.js): server/app.js, unchanged.
import app from '../../server/app.js';

export default app;
