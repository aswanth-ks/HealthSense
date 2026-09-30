import mongoose from 'mongoose';

export const METRICS = ['hr', 'spo2', 'resp', 'temp', 'movement', 'position', 'steps', 'sleep', 'bp_sys', 'bp_dia'];
export const SOURCES = ['measured', 'reported', 'estimated'];

const readingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metric: { type: String, enum: METRICS, required: true },
  value: { type: Number, required: true },
  ts: { type: Date, required: true },
  source: { type: String, enum: SOURCES, default: 'measured' },
  confidence: { type: Number, min: 0, max: 1, default: 1 },
  deviceId: String,
});

readingSchema.index({ userId: 1, metric: 1, ts: -1 });

export default mongoose.model('Reading', readingSchema);
