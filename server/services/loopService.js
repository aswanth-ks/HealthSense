// Runs after every cycle update: missing-data resolution + adaptive questions (spec §27-E/F).
import Cycle from '../models/Cycle.js';
import Baseline from '../models/Baseline.js';
import Reading from '../models/Reading.js';
import Question from '../models/Question.js';
import SymptomLog from '../models/SymptomLog.js';
import TimelineEvent from '../models/TimelineEvent.js';
import User from '../models/User.js';
import { resolveMissing } from '../engines/missingDataEngine.js';
import { patternQuestions } from '../engines/questionEngine.js';
import { upsertCycle } from './cycleService.js';
import { emitToUser } from '../utils/realtime.js';

const DAY = 24 * 3600_000;
// Where estimated/reported cycle-level values are timestamped inside their cycle
export const SLOT = { sleep: 7 * 3600_000, steps: 20 * 3600_000 };

const baselinePlain = (b) => (b ? { established: b.established, metrics: b.metrics instanceof Map ? Object.fromEntries(b.metrics) : b.metrics || {} } : { established: false, metrics: {} });

/** Create a question unless an equivalent one is already open (or was answered for this cycle). */
export async function ask(userId, cycleId, q, module) {
  const dup = await Question.findOne({
    userId, code: q.code,
    $or: [{ status: 'open' }, { cycleId, status: { $in: ['answered', 'dismissed'] } }],
  }).lean();
  if (dup) return null;
  const doc = await Question.create({ userId, cycleId, module, ...q });
  await TimelineEvent.create({ userId, kind: 'question', title: 'Targeted question generated', detail: q.text, refs: { questionId: doc._id } });
  return doc;
}

export async function analyzeRecent(userId) {
  const [user, baselineDoc] = await Promise.all([User.findById(userId).lean(), Baseline.findOne({ userId }).lean()]);
  const baseline = baselinePlain(baselineDoc);
  const deviceOnline = !!user?.device?.lastSeen && Date.now() - new Date(user.device.lastSeen).getTime() < 30 * 60_000;
  const now = new Date();
  const created = [];

  // Yesterday (closed) + today (open)
  const cycles = await Cycle.find({ userId }).sort({ start: -1 }).limit(7).lean();
  for (const c of cycles.slice(0, 2)) {
    const isOpen = c.status === 'open';
    const hoursElapsed = Math.min(24, (now - c.start) / 3600_000);
    // Don't chase data that simply hasn't happened yet today
    const relevant = (c.missing || []).filter((m) => {
      if (m.resolution === 'estimated' || m.resolution === 'resolved') return false;
      if (!isOpen) return true;
      if (m.field === 'sleep') return now.getHours() >= 9;
      if (m.field === 'steps') return now.getHours() >= 20;
      return hoursElapsed >= 6;
    });
    if (!relevant.length) continue;
    // Skip cycles with (almost) no data at all — nothing to anchor to
    if ((c.completeness ?? 0) < 0.1 && !isOpen) continue;

    const coverage = Object.fromEntries(Object.entries(c.aggregates || {}).map(([k, v]) => [k, v.coverage ?? 0]));
    const mov = c.aggregates?.movement;
    const movementSteps = mov ? mov.mean * 12000 * (mov.coverage ?? 0) : null;

    const results = resolveMissing(relevant, { deviceOnline, baseline, coverage, isOpen, hoursElapsed, movementSteps });
    let recompute = false;
    const resolution = new Map((c.missing || []).map((m) => [m.field, m.resolution]));

    for (const r of results) {
      resolution.set(r.field, r.resolution);
      if (r.resolution === 'estimated' && SLOT[r.field] != null) {
        const ts = new Date(c.start.getTime() + SLOT[r.field]);
        const exists = await Reading.exists({ userId, metric: r.field, source: { $in: ['estimated', 'reported'] }, ts: { $gte: c.start, $lt: c.end } });
        if (!exists) {
          await Reading.create({ userId, metric: r.field, value: r.estimate.value, ts, source: 'estimated', confidence: r.estimate.confidence });
          recompute = true;
        }
      }
      if (r.resolution === 'asked') {
        const q = await ask(userId, c._id, r.question, 'missing');
        if (q) created.push(q);
      }
    }

    if (recompute) await upsertCycle(userId, c.start, c.end, c.index, c.status);
    // Persist how each missing field was handled
    const fresh = await Cycle.findById(c._id);
    fresh.missing = (fresh.missing || []).map((m) => ({ field: m.field, resolution: resolution.get(m.field) || m.resolution }));
    await fresh.save();
  }

  // Pattern-driven questions
  const since = new Date(Date.now() - 14 * DAY);
  const [symptoms, recentQs] = await Promise.all([
    SymptomLog.find({ userId, ts: { $gte: new Date(Date.now() - 7 * DAY) } }).lean(),
    Question.find({ userId, updatedAt: { $gte: since }, status: { $in: ['answered', 'open'] } }).select('code status').lean(),
  ]);
  const answered = new Set(recentQs.filter((q) => q.status === 'answered').map((q) => q.code));
  const open = new Set(recentQs.filter((q) => q.status === 'open').map((q) => q.code));
  const fresh = await Cycle.find({ userId }).sort({ start: -1 }).limit(7).lean();
  for (const q of patternQuestions({ cycles: fresh, symptoms, answered, user })) {
    if (open.has(q.code)) continue;
    const doc = await ask(userId, fresh[0]?._id, q, q.code.startsWith('sleep') ? 'sleepRisk' : 'endoSymptoms');
    if (doc) created.push(doc);
  }

  if (created.length) emitToUser(userId, 'questions', { created: created.length });
  return created;
}
