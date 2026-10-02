import { Router } from 'express';
import { getLive, getOverview, getHeartRate } from '../controllers/meController.js';
import { getBaseline, getTrends, getCycles, getCycle, getReadings } from '../controllers/trendsController.js';
import { checkin, logSymptom, getSymptoms, getQuestions, answerQuestion, dismissQuestion } from '../controllers/inputController.js';
import { getTriage, getTimeline } from '../controllers/triageController.js';
import * as cyc from '../controllers/cycleController.js';
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
router.get('/triage', getTriage);
// Menstrual cycle tracking (optional, sensitive)
router.get('/cycle', cyc.getCycle);
router.delete('/cycle', cyc.deleteAll);
router.put('/cycle/settings', cyc.updateSettings);
router.post('/cycle/period/start', cyc.periodStart);
router.post('/cycle/period/end', cyc.periodEnd);
router.post('/cycle/symptoms', cyc.logCycleSymptom);
router.delete('/cycle/symptoms/:id', cyc.deleteSymptom);
router.put('/cycle/cycles/:id', cyc.editCycle);
router.delete('/cycle/cycles/:id', cyc.deleteCycle);
// Menstrual history API (same handlers, contract names)
router.get('/menstrual/cycles', cyc.listCycles);
router.post('/menstrual/cycles', cyc.addCycle);
router.put('/menstrual/cycles/:id', cyc.editCycle);
router.delete('/menstrual/cycles/:id', cyc.deleteCycle);
router.get('/menstrual/current', cyc.currentCycle);
router.get('/menstrual/baseline', cyc.cycleBaseline);
router.post('/cycle/cycles', cyc.addCycle);
router.get('/timeline', getTimeline);
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
