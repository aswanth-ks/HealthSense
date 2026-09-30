import mongoose from 'mongoose';

// One 24-hour monitoring cycle.
const cycleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    index: { type: Number, required: true }, // cycle number for this user
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    // { hr: { mean, min, max, count, source, confidence }, ... }
    aggregates: { type: mongoose.Schema.Types.Mixed, default: {} },
    activity: { steps: Number, activeMinutes: Number, source: String, confidence: Number },
    sleep: { hours: Number, quality: Number, source: String, confidence: Number },
    symptoms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SymptomLog' }],
    missing: [{ field: String, resolution: { type: String, enum: ['awaiting_sensor', 'estimated', 'asked', 'resolved', 'unresolved'] } }],
    events: { spo2Dips: Number, respPauses: Number, nightSamples: Number },
    completeness: { type: Number, default: 0 }, // 0-1
    confidence: { type: Number, default: 0 }, // 0-1
    findings: [{ code: String, text: String, severity: Number }],
    priority: [String], // metrics to prioritise in the NEXT cycle (closed loop)
    priorityReason: String,
    triage: { level: String, confidence: Number },
  },
  { timestamps: true }
);

cycleSchema.index({ userId: 1, start: -1 }, { unique: true });

export default mongoose.model('Cycle', cycleSchema);
