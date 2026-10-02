// 3-Day Assessment — gathers the user's real stored data (read-only), runs Layer 1 + Layer 2, caches the result.
import crypto from 'crypto';
import Assessment from '../models/Assessment.js';
import Cycle from '../models/Cycle.js';
import Baseline from '../models/Baseline.js';
import Reading from '../models/Reading.js';
import SymptomLog from '../models/SymptomLog.js';
import Question from '../models/Question.js';
import TimelineEvent from '../models/TimelineEvent.js';
import MenstrualCycle from '../models/MenstrualCycle.js';
import MenstrualSymptom from '../models/MenstrualSymptom.js';
import { buildAssessment, ENGINE_VERSION } from '../engines/assessmentEngine.js';
import { narrate } from '../engines/assessmentNarrative.js';
import { cycleContext, recurringPattern } from '../engines/menstrualEngine.js';
import { cycleSymptoms } from './menstrualService.js';

const DAY = 24 * 3600_000;
const SYMPTOM_TYPES = { pain: 'pain', cramp: 'cramps', cramps: 'cramps', fatigue: 'fatigue', headache: 'headache', bloating: 'bloating', wake_sudden: 'sleep_disturbance', sleep_disturbance: 'sleep_disturbance', nausea: 'nausea', dizziness: 'dizziness', breathless: 'breathlessness' };

const plainBaseline = (b) => (b ? { established: b.established, daysUsed: b.daysUsed, metrics: b.metrics instanceof Map ? Object.fromEntries(b.metrics) : b.metrics || {} } : { established: false, daysUsed: 0, metrics: {} });

/** The default window: the last 3 daily monitoring cycles (today + 2 previous days). */
export function defaultWindow(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return { start: new Date(d.getTime() - 2 * DAY), end: now };
}

async function gather(user, start, end) {
  const userId = user._id;
  const tracking = !!user.cycle?.tracking;
  const [days, history, baselineDoc, latest, logs, mens, questions, timeline, readingSources] = await Promise.all([
    Cycle.find({ userId, start: { $gte: start, $lte: end } }).sort({ start: 1 }).lean(),
    Cycle.find({ userId, start: { $lt: start } }).sort({ start: -1 }).limit(21).lean(),
    Baseline.findOne({ userId }).lean(),
    Cycle.findOne({ userId }).sort({ start: -1 }).select('assessment nextPriority updatedAt').lean(),
    SymptomLog.find({ userId, ts: { $gte: start, $lte: end } }).lean(),
    tracking ? MenstrualSymptom.find({ userId, ts: { $gte: start, $lte: end } }).lean() : [],
    Question.find({ userId, $or: [{ status: 'open' }, { answeredAt: { $gte: start, $lte: end } }] }).sort({ createdAt: -1 }).limit(20).lean(),
    TimelineEvent.find({ userId, ts: { $gte: start, $lte: end } }).sort({ ts: 1 }).lean(),
    Reading.aggregate([{ $match: { userId, ts: { $gte: start, $lte: end } } }, { $group: { _id: '$source', n: { $sum: 1 } } }]),
  ]);

  let menstrual = null;
  if (tracking) {
    const [cycles, cycDays, cycSym] = await Promise.all([
      MenstrualCycle.find({ userId }).sort({ startDate: 1 }).lean(),
      Cycle.find({ userId, start: { $gte: new Date(Date.now() - 120 * DAY) } }).select('start completeness aggregates activity sleep').lean(),
      cycleSymptoms(userId),
    ]);
    menstrual = { context: cycleContext(user.cycle, cycles), pattern: recurringPattern({ cycles, symptoms: cycSym, days: cycDays }) };
  }

  const symptoms = [
    ...logs.filter((l) => SYMPTOM_TYPES[l.type]).map((l) => ({ id: String(l._id), ts: l.ts, type: SYMPTOM_TYPES[l.type], severity: l.severity, source: 'reported' })),
    ...mens.filter((m) => SYMPTOM_TYPES[m.symptom] || m.symptom === 'custom').map((m) => ({ id: String(m._id), ts: m.ts, type: m.symptom === 'custom' ? (m.label || 'symptom') : SYMPTOM_TYPES[m.symptom], severity: m.severity, source: m.source || 'reported' })),
  ].sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const src = Object.fromEntries(readingSources.map((r) => [r._id, r.n]));
  const answered = questions.filter((q) => q.status === 'answered').length;
  const baseline = plainBaseline(baselineDoc);
  const counts = {
    measured: src.measured || 0,
    user_reported: (src.reported || 0) + symptoms.length + answered,
    historical: (baseline.daysUsed || 0) + history.length + (menstrual?.pattern?.perCycle?.length || 0),
    estimated: src.estimated || 0,
  };

  const inputsHash = crypto.createHash('sha1').update(JSON.stringify([
    ENGINE_VERSION,
    days.map((d) => [d.start, d.updatedAt]), latest?.updatedAt, baselineDoc?.updatedAt, symptoms.length,
    questions.map((q) => [q._id, q.status]), timeline.length, counts, tracking, menstrual?.pattern?.cyclesMatched,
    menstrual?.context?.lastPeriodStart, menstrual?.context?.history, menstrual?.context?.confidence,
  ])).digest('hex');

  return {
    inputsHash,
    input: {
      days, history, baseline,
      triage: latest?.assessment?.result || null,
      modules: latest?.assessment?.modules || [],
      priority: latest?.nextPriority || null,
      symptoms,
      questions: questions.map((q) => ({ id: String(q._id), code: q.code, text: q.text, status: q.status, answer: q.answer, answeredAt: q.answeredAt, createdAt: q.createdAt, reason: q.reason, kind: q.kind, options: q.options, module: q.module, unit: q.unit, min: q.min, max: q.max, step: q.step, suggested: q.suggested, field: q.field })),
      timeline: timeline.map((t) => ({ id: String(t._id), ts: t.ts, kind: t.kind, title: t.title, detail: t.detail })),
      menstrual,
      counts,
      start,
      end,
    },
  };
}

const out = (doc) => ({
  assessment_id: String(doc._id),
  patient_id: String(doc.userId),
  previous_assessment_id: doc.previousId ? String(doc.previousId) : null,
  ...doc.payload,
  narrative: doc.narrative,
  narrative_available: !!doc.narrative,
  cached: !!doc.cached,
});

/** Create (or reuse the cached) assessment for a window. Recalculates only when inputs changed. */
export async function createAssessment(user, { start, end, force = false } = {}) {
  const w = start && end ? { start: new Date(start), end: new Date(end) } : defaultWindow();
  if (w.end - w.start > 7 * DAY || w.end <= w.start) throw Object.assign(new Error('The assessment window must be between 0 and 7 days'), { status: 400 });

  const { inputsHash, input } = await gather(user, w.start, w.end);
  const sameStart = await Assessment.findOne({ userId: user._id, periodStart: w.start }).sort({ createdAt: -1 }).lean();
  if (!force && sameStart && sameStart.inputsHash === inputsHash) return out({ ...sameStart, cached: true });

  const payload = buildAssessment(input);
  const narrative = narrate(payload);
  const previous = await Assessment.findOne({ userId: user._id }).sort({ createdAt: -1 }).select('_id').lean();
  const doc = await Assessment.create({
    userId: user._id, periodStart: w.start, periodEnd: w.end, inputsHash, payload, narrative, previousId: previous?._id,
  });
  // keep the collection small: only the 20 most recent assessments per user
  const old = await Assessment.find({ userId: user._id }).sort({ createdAt: -1 }).skip(20).select('_id').lean();
  if (old.length) await Assessment.deleteMany({ _id: { $in: old.map((o) => o._id) } });
  return out(doc.toObject());
}

export async function latestAssessment(user) {
  return createAssessment(user, {});
}

export async function getAssessment(user, id) {
  const doc = await Assessment.findOne({ _id: id, userId: user._id }).lean();
  return doc ? out(doc) : null;
}

export async function assessmentHistory(user) {
  const rows = await Assessment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean();
  return rows.map((r) => ({
    assessment_id: String(r._id), period: r.payload.period, triage_level: r.payload.triage_level,
    confidence: r.payload.confidence, data_completeness: r.payload.data_quality?.completeness, generated_at: r.createdAt,
  }));
}
