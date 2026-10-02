import Cycle from '../models/Cycle.js';
import TriageEvent from '../models/TriageEvent.js';
import TimelineEvent from '../models/TimelineEvent.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { DISCLAIMER } from '../engines/triageEngine.js';

const short = (p) => (p ? { metrics: p.metrics || [], nightBoost: !!p.nightBoost, sampleIntervalSec: p.sampleIntervalSec, checkinFocus: p.checkinFocus || [], reason: p.reason, fromCycle: p.fromCycle, influencedBy: p.influencedBy || [] } : null);

/** GET /api/me/triage — current level, explanation, modules and the closed-loop view. */
export const getTriage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [cycles, history] = await Promise.all([
    Cycle.find({ userId }).sort({ start: -1 }).limit(2).lean(),
    TriageEvent.find({ userId }).sort({ ts: -1 }).limit(10).lean(),
  ]);
  const [current, previous] = cycles;
  const a = current?.assessment;
  const last = history[0];

  res.json({
    current: a ? {
      level: a.result.level,
      score: a.result.score,
      confidence: a.result.confidence,
      module: a.result.module,
      reasons: a.result.reasons,
      changed: last && last.prevLevel ? { from: last.prevLevel, to: last.level, at: last.ts } : null,
    } : null,
    disclaimer: DISCLAIMER,
    modules: a?.modules || [],
    deviations: a?.deviations || [],
    history: history.map((h) => ({ level: h.level, prevLevel: h.prevLevel, ts: h.ts, reasons: h.reasons, confidence: h.confidence })),
    // Previous cycle → learning → next-cycle monitoring priority (spec §28 step 8)
    loop: current ? {
      previousCycle: previous ? { index: previous.index, start: previous.start, completeness: previous.completeness, findings: (previous.findings || []).slice(0, 4), learned: short(previous.nextPriority) } : null,
      currentCycle: { index: current.index, start: current.start, applied: short(current.appliedPriority), completeness: current.completeness },
      next: short(current.nextPriority),
    } : null,
  });
});

/** GET /api/me/timeline?limit=50 */
export const getTimeline = asyncHandler(async (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 60);
  const rows = await TimelineEvent.find({ userId: req.user._id }).sort({ ts: -1 }).limit(limit).lean();
  res.json(rows.map((r) => ({ id: r._id, ts: r.ts, kind: r.kind, title: r.title, detail: r.detail })));
});
