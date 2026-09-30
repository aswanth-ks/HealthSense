import mongoose from 'mongoose';

const symptomSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ts: { type: Date, default: Date.now },
  type: { type: String, required: true }, // pain | cramp | fatigue | wake_sudden | headache | mood | sleep_quality | ...
  severity: { type: Number, min: 0, max: 10, default: 0 },
  location: String,
  notes: String,
  source: { type: String, default: 'reported' },
});

symptomSchema.index({ userId: 1, ts: -1 });

export default mongoose.model('SymptomLog', symptomSchema);
