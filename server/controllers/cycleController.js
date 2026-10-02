// Menstrual cycle tracking API (/api/me/cycle). Sensitive data: everything is scoped to the signed-in user,
// nothing is collected while tracking is disabled, and all of it can be edited or deleted.
import mongoose from 'mongoose';
import MenstrualCycle from '../models/MenstrualCycle.js';
import MenstrualSymptom from '../models/MenstrualSymptom.js';
import CycleBaseline from '../models/CycleBaseline.js';
import TimelineEvent from '../models/TimelineEvent.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import { cycleContext, recurringPattern } from '../engines/menstrualEngine.js';
import { startPeriod, endPeriod, addCycleSymptom, deleteAllCycleData, cycleSymptoms } from '../services/menstrualService.js';
import { updateCycles } from '../services/cycleService.js';
import Cycle from '../models/Cycle.js';

const DAY = 24 * 3600_000;
const REGULARITY = ['regular', 'somewhat_irregular', 'very_irregular', 'unsure'];
const SYMPTOMS = ['pain', 'cramps', 'fatigue', 'bloating', 'headache', 'sleep_disturbance', 'activity_impact', 'flow', 'custom'];
const validDate = (d) => d && !Number.isNaN(new Date(d).getTime()) && new Date(d) <= new Date(Date.now() + DAY);
const num = (v, lo, hi) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Math.min(hi, Math.max(lo, Number(v))));

const requireTracking = (req) => { if (!req.user.cycle?.tracking) throw httpError(409, 'Menstrual cycle tracking is turned off'); };
const refresh = (userId) => updateCycles(userId).catch((e) => console.error('cycle refresh failed:', e.message));

/** GET /api/me/cycle — context, history, symptoms, cycle-aware baselines and recurring patterns. */
export const getCycle = asyncHandler(async (req, res) => {
  const settings = req.user.cycle || {};
  if (!settings.tracking) return res.json({ tracking: false });
  const userId = req.user._id;
  const [cycles, symptoms, baselines, days, allSymptoms] = await Promise.all([
    MenstrualCycle.find({ userId }).sort({ startDate: -1 }).limit(24).lean(),
    MenstrualSymptom.find({ userId, ts: { $gte: new Date(Date.now() - 90 * DAY) } }).sort({ ts: -1 }).limit(200).lean(),
    CycleBaseline.find({ userId }).lean(),
    Cycle.find({ userId, start: { $gte: new Date(Date.now() - 120 * DAY) } }).select('start completeness aggregates activity sleep').lean(),
    cycleSymptoms(userId),
  ]);
  res.json({
    tracking: true,
    settings: {
      lastPeriodStart: settings.lastPeriodStart, avgLengthDays: settings.avgLengthDays, lengthUnknown: settings.lengthUnknown,
      typicalPeriodLength: settings.typicalPeriodLength, regularity: settings.regularity, setupAt: settings.setupAt,
    },
    context: cycleContext(settings, cycles),
    cycles: cycles.map((c) => ({
      id: c._id, startDate: c.startDate, endDate: c.endDate, periodEndDate: c.periodEndDate, cycleLength: c.cycleLength,
      periodLength: c.periodLength, source: c.source, confidence: c.confidence, flow: c.flow,
    })),
    symptoms: symptoms.map((s) => ({ id: s._id, ts: s.ts, symptom: s.symptom, label: s.label, severity: s.severity, durationHours: s.durationHours, activityImpact: s.activityImpact, flow: s.flow, source: s.source, confidence: s.confidence, cycleId: s.cycleId, notes: s.notes })),
    baselines: baselines.map(({ cycleContext: ctx, metric, baselineValue, range, n, cyclesUsed, confidence }) => ({ cycleContext: ctx, metric, baselineValue, range, n, cyclesUsed, confidence })),
    pattern: recurringPattern({ cycles, symptoms: allSymptoms, days }),
  });
});

/** PUT /api/me/cycle/settings — enable/disable + onboarding answers. */
export const updateSettings = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const userId = req.user._id;
  const c = req.user.cycle?.toObject?.() || req.user.cycle || {};

  if (b.tracking === false) {
    req.user.cycle = { ...c, tracking: false };
    await req.user.save();
    if (b.deleteData) await deleteAllCycleData(userId);
    await TimelineEvent.create({ userId, kind: 'info', title: 'Menstrual cycle tracking turned off', detail: b.deleteData ? 'Cycle data was deleted.' : 'Existing cycle data is kept but no longer used or shown.' });
    await refresh(userId);
    return res.json({ tracking: false });
  }

  const next = { ...c, tracking: true };
  if (b.lengthUnknown !== undefined) next.lengthUnknown = !!b.lengthUnknown;
  if (b.avgLengthDays !== undefined) next.avgLengthDays = num(b.avgLengthDays, 15, 60) ?? c.avgLengthDays;
  if (b.typicalPeriodLength !== undefined) next.typicalPeriodLength = num(b.typicalPeriodLength, 1, 15);
  if (b.regularity !== undefined) next.regularity = REGULARITY.includes(b.regularity) ? b.regularity : 'unsure';
  if (!c.setupAt) next.setupAt = new Date();
  req.user.cycle = next;
  await req.user.save();

  if (b.lastPeriodStart && validDate(b.lastPeriodStart)) await startPeriod(userId, new Date(b.lastPeriodStart), { silent: false });
  if (!c.tracking) await TimelineEvent.create({ userId, kind: 'info', title: 'Menstrual cycle tracking turned on', detail: 'Cycle context is now used to interpret your other readings.' });
  await refresh(userId);
  res.json({ tracking: true });
});

/** POST /api/me/cycle/period/start { date } · POST /api/me/cycle/period/end { date } */
export const periodStart = asyncHandler(async (req, res) => {
  requireTracking(req);
  const date = validDate(req.body?.date) ? new Date(req.body.date) : new Date();
  const c = await startPeriod(req.user._id, date);
  await refresh(req.user._id);
  res.status(201).json({ id: c._id, startDate: c.startDate });
});

export const periodEnd = asyncHandler(async (req, res) => {
  requireTracking(req);
  const date = validDate(req.body?.date) ? new Date(req.body.date) : new Date();
  const c = await endPeriod(req.user._id, date);
  if (!c) throw httpError(400, 'No period start recorded before that date');
  await refresh(req.user._id);
  res.json({ id: c._id, periodLength: c.periodLength });
});

/** POST /api/me/cycle/symptoms { symptom, severity?, durationHours?, activityImpact?, flow?, label?, notes?, ts? } */
export const logCycleSymptom = asyncHandler(async (req, res) => {
  requireTracking(req);
  const b = req.body || {};
  if (!SYMPTOMS.includes(b.symptom)) throw httpError(400, `symptom must be one of ${SYMPTOMS.join(', ')}`);
  if (b.symptom === 'custom' && !String(b.label || '').trim()) throw httpError(400, 'Describe the custom symptom');
  const doc = await addCycleSymptom(req.user._id, {
    ...b, severity: num(b.severity, 0, 10), durationHours: num(b.durationHours, 0, 240), label: b.label ? String(b.label).slice(0, 60) : undefined,
  });
  await refresh(req.user._id);
  res.status(201).json(doc);
});

const ownId = (id) => { if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid id'); return id; };

/** PUT /api/me/cycle/cycles/:id { startDate?, periodEndDate? } — correct a recorded cycle. */
export const editCycle = asyncHandler(async (req, res) => {
  const c = await MenstrualCycle.findOne({ _id: ownId(req.params.id), userId: req.user._id });
  if (!c) throw httpError(404, 'Cycle not found');
  if (validDate(req.body?.startDate)) c.startDate = new Date(req.body.startDate);
  if (req.body?.periodEndDate === null) { c.periodEndDate = undefined; c.periodLength = undefined; }
  else if (validDate(req.body?.periodEndDate)) {
    c.periodEndDate = new Date(req.body.periodEndDate);
    c.periodLength = Math.round((new Date(c.periodEndDate).setHours(0, 0, 0, 0) - new Date(c.startDate).setHours(0, 0, 0, 0)) / DAY) + 1;
  }
  c.source = 'user_reported';
  c.confidence = 1;
  await c.save();
  // Re-derive cycle lengths from consecutive starts
  const all = await MenstrualCycle.find({ userId: req.user._id }).sort({ startDate: 1 });
  for (let i = 0; i < all.length; i += 1) {
    const next = all[i + 1];
    all[i].cycleLength = next ? Math.round((new Date(next.startDate).setHours(0, 0, 0, 0) - new Date(all[i].startDate).setHours(0, 0, 0, 0)) / DAY) : undefined;
    all[i].endDate = next ? new Date(new Date(next.startDate).getTime() - DAY) : undefined;
    await all[i].save();
  }
  await refresh(req.user._id);
  res.json({ ok: true });
});

export const deleteCycle = asyncHandler(async (req, res) => {
  const c = await MenstrualCycle.findOneAndDelete({ _id: ownId(req.params.id), userId: req.user._id });
  if (!c) throw httpError(404, 'Cycle not found');
  await MenstrualSymptom.updateMany({ cycleId: c._id }, { $unset: { cycleId: '' } });
  const prev = await MenstrualCycle.findOne({ userId: req.user._id, startDate: { $lt: c.startDate } }).sort({ startDate: -1 });
  if (prev) {
    const next = await MenstrualCycle.findOne({ userId: req.user._id, startDate: { $gt: prev.startDate } }).sort({ startDate: 1 });
    prev.cycleLength = next ? Math.round((new Date(next.startDate) - new Date(prev.startDate)) / DAY) : undefined;
    prev.endDate = next ? new Date(new Date(next.startDate).getTime() - DAY) : undefined;
    await prev.save();
  }
  await refresh(req.user._id);
  res.json({ ok: true });
});

export const deleteSymptom = asyncHandler(async (req, res) => {
  const s = await MenstrualSymptom.findOneAndDelete({ _id: ownId(req.params.id), userId: req.user._id });
  if (!s) throw httpError(404, 'Entry not found');
  await refresh(req.user._id);
  res.json({ ok: true });
});

/** DELETE /api/me/cycle — delete all menstrual data (tracking stays as the user set it). */
export const deleteAll = asyncHandler(async (req, res) => {
  await deleteAllCycleData(req.user._id);
  await refresh(req.user._id);
  res.json({ ok: true });
});
