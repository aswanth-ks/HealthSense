import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler, httpError } from './errorHandler.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw httpError(401, 'Not authorized, no token');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, 'Not authorized, invalid token');
  }
  req.user = await User.findById(payload.id);
  if (!req.user) throw httpError(401, 'User no longer exists');
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(httpError(403, 'Forbidden'));
