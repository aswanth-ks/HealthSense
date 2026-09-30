import User from '../models/User.js';
import { asyncHandler, httpError } from './errorHandler.js';

// ESP32 / simulator authenticate with the per-user device key (shown on the My Watch page).
export const deviceAuth = asyncHandler(async (req, _res, next) => {
  const key = req.headers['x-device-key'];
  if (!key) throw httpError(401, 'Missing x-device-key header');
  const user = await User.findOne({ deviceKey: key });
  if (!user) throw httpError(401, 'Unknown device key');
  req.user = user;
  next();
});
