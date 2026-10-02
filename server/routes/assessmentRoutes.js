import { Router } from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import Assessment from '../models/Assessment.js';
import { createAssessment, latestAssessment, getAssessment, assessmentHistory } from '../services/assessmentService.js';

// Assessment API. "patient" is always the signed-in user — nobody can read another person's assessment.
const router = Router();
router.use(protect);

const checkPatient = (req) => {
  const pid = req.body?.patient_id ?? req.query?.patient_id;
  if (pid && pid !== String(req.user._id)) throw httpError(403, 'You can only access your own assessments');
};
const validId = (id) => { if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid assessment id'); return id; };

/** POST /api/assessments { start_at?, end_at?, assessment_type?, force_recalculate? } */
router.post('/', asyncHandler(async (req, res) => {
  checkPatient(req);
  const b = req.body || {};
  if (b.assessment_type && b.assessment_type !== '3_day') throw httpError(400, 'Only 3_day assessments are supported');
  res.status(201).json(await createAssessment(req.user, { start: b.start_at, end: b.end_at, force: !!b.force_recalculate }));
}));

/** GET /api/assessments/latest — current 3-day window (recalculated only if new data arrived) */
router.get('/latest', asyncHandler(async (req, res) => res.json(await latestAssessment(req.user))));

/** GET /api/assessments — history */
router.get('/', asyncHandler(async (req, res) => res.json(await assessmentHistory(req.user))));

router.get('/:id', asyncHandler(async (req, res) => {
  const a = await getAssessment(req.user, validId(req.params.id));
  if (!a) throw httpError(404, 'Assessment not found');
  res.json(a);
}));

/** GET /api/assessments/:id/evidence[?pattern_id=…] */
router.get('/:id/evidence', asyncHandler(async (req, res) => {
  const a = await getAssessment(req.user, validId(req.params.id));
  if (!a) throw httpError(404, 'Assessment not found');
  let ids = null;
  if (req.query.pattern_id) ids = new Set(a.patterns.find((p) => p.pattern_id === req.query.pattern_id)?.evidence_ids || []);
  if (req.query.target === 'professional_evaluation') ids = new Set(a.professional_evaluation.evidence_ids);
  res.json({ assessment_id: a.assessment_id, evidence: ids ? a.evidence.filter((e) => ids.has(e.id)) : a.evidence });
}));

/** POST /api/assessments/:id/feedback { helpful: boolean, note? } */
router.post('/:id/feedback', asyncHandler(async (req, res) => {
  const doc = await Assessment.findOne({ _id: validId(req.params.id), userId: req.user._id });
  if (!doc) throw httpError(404, 'Assessment not found');
  doc.feedback.push({ helpful: !!req.body?.helpful, note: req.body?.note ? String(req.body.note).slice(0, 500) : undefined });
  await doc.save();
  res.status(201).json({ ok: true });
}));

export default router;
