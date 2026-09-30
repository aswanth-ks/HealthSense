import mongoose from 'mongoose';

export const LEVELS = ['LOW', 'MONITOR', 'MODERATE', 'HIGH'];

const triageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
  ts: { type: Date, default: Date.now },
  level: { type: String, enum: LEVELS, required: true },
  prevLevel: { type: String, enum: [...LEVELS, null], default: null },
  reasons: [String],
  confidence: Number,
  module: String, // sleepRisk | endoSymptoms | general
});

triageSchema.index({ userId: 1, ts: -1 });

export default mongoose.model('TriageEvent', triageSchema);
