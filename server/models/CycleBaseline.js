import mongoose from 'mongoose';

// Cycle-aware personal baseline: e.g. "typical HR during cycle days 1–3" vs "outside the period".
const cycleBaselineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cycleContext: { type: String, enum: ['period_days_1_3', 'outside_period'], required: true },
    metric: { type: String, required: true }, // hr | temp | resp | spo2 | steps | sleep
    baselineValue: Number,
    range: { lo: Number, hi: Number },
    n: Number, // days of data
    cyclesUsed: Number,
    confidence: Number,
  },
  { timestamps: true }
);

cycleBaselineSchema.index({ userId: 1, cycleContext: 1, metric: 1 }, { unique: true });

export default mongoose.model('CycleBaseline', cycleBaselineSchema);
