import { Router } from 'express';
import { getMe, updateMe, getDeviceKey } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.get('/me', getMe);
router.put('/me', updateMe);
router.get('/me/device-key', getDeviceKey);

export default router;
