import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isDayKey, dayKey } from '../engines/stepsEngine.js';
import * as health from '../services/healthDataService.js';

// Phone health data (Health Connect / Apple Health) — written by the HealthSense mobile bridge,
// read by the web app. All routes act on the signed-in user only.
const router = Router();
router.use(protect);

// `today` lets the client anchor "today" on the user's own calendar day.
const todayOf = (req) => (isDayKey(req.query.today) ? req.query.today : dayKey(new Date()));
const daysOf = (req) => ([7, 14, 30].includes(+req.query.days) ? +req.query.days : 7);

router.get('/status', asyncHandler(async (req, res) => res.json(await health.getStatus(req.user._id))));
router.post('/connect', asyncHandler(async (req, res) => res.json(await health.connect(req.user._id, req.body))));
router.post('/disconnect', asyncHandler(async (req, res) => res.json(await health.disconnect(req.user._id, { deleteData: !!req.body?.delete_data }))));
router.post('/sync', asyncHandler(async (req, res) => res.json(await health.sync(req.user._id, req.body))));

router.get('/steps', asyncHandler(async (req, res) => res.json(await health.stepsToday(req.user._id, todayOf(req)))));
router.get('/steps/history', asyncHandler(async (req, res) => res.json(await health.stepsHistory(req.user._id, { todayKey: todayOf(req), days: daysOf(req) }))));
router.get('/steps/trends', asyncHandler(async (req, res) => {
  const h = await health.stepsHistory(req.user._id, { todayKey: todayOf(req), days: daysOf(req) });
  res.json({ days: h.days, trend: h.trend, averages: h.averages, week_change: h.week_change, insights: h.insights, baseline: h.baseline });
}));

export default router;
