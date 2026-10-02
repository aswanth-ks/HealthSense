import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import { SCENARIOS, demoStatus } from '../services/demoService.js';

// Demo Mode API — only ever touches the signed-in user's own data. Disable with DEMO_MODE=off.
const router = Router();
router.use((req, _res, next) => (process.env.DEMO_MODE === 'off' ? next(httpError(404, 'Demo mode is disabled')) : next()));
router.use(protect);

router.get('/status', asyncHandler(async (req, res) => res.json(await demoStatus(req.user._id))));

router.post('/:scenario', asyncHandler(async (req, res) => {
  const run = SCENARIOS[req.params.scenario];
  if (!run) throw httpError(404, `Unknown scenario. Use one of: ${Object.keys(SCENARIOS).join(', ')}`);
  const started = Date.now();
  const message = await run(req.user._id);
  res.json({ ok: true, message, ms: Date.now() - started, status: await demoStatus(req.user._id) });
}));

export default router;
