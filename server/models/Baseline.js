import mongoose from 'mongoose';

const statSchema = new mongoose.Schema({ mean: Number, sd: Number, p10: Number, p90: Number, n: Number }, { _id: false });

const baselineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    metrics: { type: Map, of: statSchema, default: {} }, // hr, spo2, temp, resp, steps, sleep
    daysUsed: { type: Number, default: 0 },
    established: { type: Boolean, default: false },
    establishedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Baseline', baselineSchema);
