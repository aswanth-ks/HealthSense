import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
    code: String, // rule that generated it, e.g. "sleep.wake_sudden"
    field: String, // missing field it resolves
    text: { type: String, required: true },
    kind: { type: String, enum: ['yesno', 'scale', 'choice', 'number'], default: 'yesno' },
    options: [String],
    reason: String, // why the system is asking
    status: { type: String, enum: ['open', 'answered', 'dismissed'], default: 'open' },
    answer: mongoose.Schema.Types.Mixed,
    answeredAt: Date,
  },
  { timestamps: true }
);

questionSchema.index({ userId: 1, status: 1 });

export default mongoose.model('Question', questionSchema);
