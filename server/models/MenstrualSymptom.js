import mongoose from 'mongoose';

// Symptom recorded in menstrual-cycle context (pain, cramps, fatigue, bloating, …).
const menstrualSymptomSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenstrualCycle' },
    ts: { type: Date, default: Date.now },
    symptom: { type: String, required: true }, // pain | cramps | fatigue | bloating | headache | sleep_disturbance | activity_impact | flow | custom
    label: String, // free text for custom symptoms
    severity: { type: Number, min: 0, max: 10 },
    durationHours: Number,
    activityImpact: { type: String, enum: ['none', 'some', 'significant', null], default: null },
    flow: { type: String, enum: ['spotting', 'light', 'medium', 'heavy', null], default: null },
    source: { type: String, enum: ['user_reported', 'historical', 'ai_estimated'], default: 'user_reported' },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
    notes: String,
  },
  { timestamps: true }
);

menstrualSymptomSchema.index({ userId: 1, ts: -1 });

export default mongoose.model('MenstrualSymptom', menstrualSymptomSchema);
