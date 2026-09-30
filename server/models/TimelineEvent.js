import mongoose from 'mongoose';

const timelineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ts: { type: Date, default: Date.now },
  kind: { type: String, enum: ['baseline', 'deviation', 'question', 'answer', 'triage', 'priority', 'symptom', 'device', 'info'], default: 'info' },
  title: { type: String, required: true },
  detail: String,
  refs: { type: mongoose.Schema.Types.Mixed },
});

timelineSchema.index({ userId: 1, ts: -1 });

export default mongoose.model('TimelineEvent', timelineSchema);
