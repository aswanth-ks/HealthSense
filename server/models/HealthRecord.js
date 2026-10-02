import mongoose from 'mongoose';

// Daily health metrics imported from the phone's health platform (Health Connect / Apple Health)
// through the HealthSense mobile bridge. Demo Mode writes source DEMO + demo: true — never mixed up
// with real imported data. One record per user + metric + date + source, so repeated syncs never duplicate.
export const HEALTH_METRICS = ['steps', 'distance', 'heart_rate', 'resting_heart_rate', 'sleep', 'exercise'];
export const HEALTH_SOURCES = ['HEALTH_CONNECT', 'APPLE_HEALTH', 'DEMO'];

const healthRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    metric: { type: String, enum: HEALTH_METRICS, required: true },
    value: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // the user's local calendar day
    source: { type: String, enum: HEALTH_SOURCES, required: true },
    provenance: { type: String, enum: ['IMPORTED'], default: 'IMPORTED' },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
    sourceRecordId: String,
    syncedAt: { type: Date, required: true },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

healthRecordSchema.index({ userId: 1, metric: 1, date: 1, source: 1 }, { unique: true });

export default mongoose.model('HealthRecord', healthRecordSchema);
