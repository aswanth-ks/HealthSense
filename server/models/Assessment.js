import mongoose from 'mongoose';

// A stored 3-day assessment (cached per period; recalculated only when new data arrives).
const assessmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, default: '3_day' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    inputsHash: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true }, // Layer 1 structured assessment
    narrative: { type: mongoose.Schema.Types.Mixed, default: null }, // Layer 2 explanation (may be null)
    previousId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
    feedback: [{ helpful: Boolean, note: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

assessmentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Assessment', assessmentSchema);
