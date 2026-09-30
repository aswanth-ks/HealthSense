import { Router } from 'express';
import { getLive, getOverview, getHeartRate } from '../controllers/meController.js';
import { getBaseline, getTrends, getCycles, getCycle, getReadings } from '../controllers/trendsController.js';
import { checkin, logSymptom, getSymptoms, getQuestions, answerQuestion, dismissQuestion } from '../controllers/inputController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { updateCycles } from '../services/cycleService.js';

const router = Router();
router.use(protect);
router.get('/live', getLive);
router.get('/overview', getOverview);
router.get('/heart-rate', getHeartRate);
router.get('/baseline', getBaseline);
router.get('/trends', getTrends);
router.get('/cycles', getCycles);
router.get('/cycles/:id', getCycle);
router.get('/readings', getReadings);
router.post('/checkin', checkin);
router.get('/symptoms', getSymptoms);
router.post('/symptoms', logSymptom);
router.get('/questions', getQuestions);
router.post('/questions/:id/answer', answerQuestion);
router.post('/questions/:id/dismiss', dismissQuestion);
// Recompute cycles + baseline now (normally automatic after ingest); ?full=1 rebuilds closed cycles too
router.post('/cycles/recompute', asyncHandler(async (req, res) => {
  await updateCycles(req.user._id, { full: req.query.full === '1' });
  res.json({ ok: true });
}));

export default router;
