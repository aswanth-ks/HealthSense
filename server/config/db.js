import mongoose from 'mongoose';

// Cached connection: a long-running server connects once; on Vercel each warm function instance reuses it.
let pending = null;

export default function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!pending) {
    pending = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 })
      .then((conn) => {
        console.log(`MongoDB connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((err) => {
        pending = null; // allow a retry on the next request
        throw err;
      });
  }
  return pending;
}
