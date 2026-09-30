import { Router } from 'express';
import { register, login, profile } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, profile);

export default router;
