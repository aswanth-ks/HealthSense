import { Router } from 'express';
import { getLive, getOverview, getHeartRate } from '../controllers/meController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.get('/live', getLive);
router.get('/overview', getOverview);
router.get('/heart-rate', getHeartRate);

export default router;
