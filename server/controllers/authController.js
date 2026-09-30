import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';

const respond = (res, user, status = 200) => res.status(status).json({ token: generateToken(user), user: user.toPublic() });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) throw httpError(400, 'Name, email and password are required');
  if (await User.exists({ email: email.toLowerCase() })) throw httpError(409, 'Email already registered');

  const user = await User.create({ name, email, password, role: role === 'clinician' ? 'clinician' : 'patient' });
  respond(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password || ''))) throw httpError(401, 'Invalid email or password');
  respond(res, user);
});

export const profile = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublic() });
});
