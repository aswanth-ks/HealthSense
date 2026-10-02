import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const historySchema = new mongoose.Schema(
  { condition: String, since: String, notes: String },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['patient', 'clinician'], default: 'patient' },
    profile: {
      dob: Date,
      sex: { type: String, enum: ['female', 'male', 'other', ''], default: '' },
      heightCm: Number,
      weightKg: Number,
    },
    medicalHistory: [historySchema],
    // Menstrual cycle tracking (optional, sensitive). Detailed cycles live in MenstrualCycle.
    cycle: {
      tracking: { type: Boolean, default: false },
      lastPeriodStart: Date,
      avgLengthDays: { type: Number, default: 28 },
      lengthUnknown: { type: Boolean, default: false },
      typicalPeriodLength: Number,
      regularity: { type: String, enum: ['regular', 'somewhat_irregular', 'very_irregular', 'unsure', null], default: null },
      setupAt: Date,
    },
    // Monitoring ranges configured by the user (Settings page)
    ranges: {
      hrMin: { type: Number, default: 60 },
      hrMax: { type: Number, default: 100 },
      spo2Min: { type: Number, default: 95 },
      tempMin: { type: Number, default: 36.0 },
      tempMax: { type: Number, default: 37.5 },
    },
    // Used by ESP32 / simulator to post readings for this user
    deviceId: { type: String, default: '' },
    device: {
      firmware: String,
      battery: Number,
      transport: { type: String, default: 'wifi' },
      lastSeen: Date,
      firstSeen: Date,
      packets: { type: Number, default: 0 },
      latencyMs: Number,
      mode: { type: String, enum: ['sensor', 'simulation', ''], default: '' },
    },
    deviceKey: { type: String, default: () => crypto.randomBytes(16).toString('hex'), select: false },
    clinicianIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublic = function toPublic() {
  const o = this.toObject();
  delete o.password;
  delete o.deviceKey;
  delete o.__v;
  return o;
};

export default mongoose.model('User', userSchema);
