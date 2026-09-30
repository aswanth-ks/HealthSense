import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const EDITABLE = ['name', 'profile', 'medicalHistory', 'cycle', 'ranges', 'deviceId'];

export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export const updateMe = asyncHandler(async (req, res) => {
  for (const key of EDITABLE) if (req.body[key] !== undefined) req.user[key] = req.body[key];
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

// Shown on the My Watch page so the user can configure the ESP32 / simulator.
export const getDeviceKey = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+deviceKey');
  res.json({ deviceId: user.deviceId, deviceKey: user.deviceKey });
});
