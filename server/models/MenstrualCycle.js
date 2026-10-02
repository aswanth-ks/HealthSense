import mongoose from 'mongoose';

// One menstrual cycle (period start → day before next period start). Sensitive health data.
export const CYCLE_SOURCES = ['user_reported', 'historical', 'ai_estimated'];

const menstrualCycleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true }, // first day of period
    periodEndDate: Date, // last day of bleeding (if known)
    endDate: Date, // day before the next period started (set when the next cycle begins)
    cycleLength: Number, // days, known once the next period starts
    periodLength: Number, // days of bleeding, if known
    regularity: { type: String, enum: ['regular', 'somewhat_irregular', 'very_irregular', 'unsure', null], default: null },
    source: { type: String, enum: CYCLE_SOURCES, default: 'user_reported' },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
    flow: [{ ts: Date, level: { type: String, enum: ['spotting', 'light', 'medium', 'heavy'] } }],
  },
  { timestamps: true }
);

menstrualCycleSchema.index({ userId: 1, startDate: -1 });

export default mongoose.model('MenstrualCycle', menstrualCycleSchema);
