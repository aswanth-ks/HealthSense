// Menstrual cycle tracking API (/api/me/cycle). Sensitive data: everything is scoped to the signed-in user,
// nothing is collected while tracking is disabled, and all of it can be edited or deleted.
import mongoose from 'mongoose';
import MenstrualCycle from '../models/MenstrualCycle.js';
import MenstrualSymptom from '../models/MenstrualSymptom.js';
import CycleBaseline from '../models/CycleBaseline.js';
import TimelineEvent from '../models/TimelineEvent.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import { cycleContext, recurringPattern, recomputeLengths, validatePeriod, cycleBaselineStats } from '../engines/menstrualEngine.js';
import { startPeriod, endPeriod, addCycleSymptom, deleteAllCycleData, cycleSymptoms, addHistoricalCycle, recomputeAllLengths } from '../services/menstrualService.js';
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
      previousUnknown: settings.previousUnknown, reportedSymptoms: settings.reportedSymptoms || [],
    },
    context: cycleContext(settings, cycles),
    cycles: cycles.map((c) => ({
      id: c._id, startDate: c.startDate, endDate: c.endDate, periodEndDate: c.periodEndDate, cycleLength: c.cycleLength, possibleGap: (c.cycleLength ?? 0) > 45,
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
  if (b.avgLengthDays !== undefined) next.avgLengthDays = b.avgLengthDays === null ? undefined : num(b.avgLengthDays, 15, 90) ?? c.avgLengthDays;
  if (b.lengthUnknown) next.avgLengthDays = undefined; // unknown stays unknown — never a silent 28
  if (b.typicalPeriodLength !== undefined) next.typicalPeriodLength = b.typicalPeriodLength === null ? undefined : num(b.typicalPeriodLength, 1, 15);
  if (b.regularity !== undefined) next.regularity = REGULARITY.includes(b.regularity) ? b.regularity : 'unsure';
  if (b.previousUnknown !== undefined) next.previousUnknown = !!b.previousUnknown;
  if (Array.isArray(b.reportedSymptoms)) {
    next.reportedSymptoms = b.reportedSymptoms
      .filter((x) => x && typeof x.symptom === 'string' && ['yes', 'no', 'not_sure'].includes(x.present))
      .slice(0, 12)
      .map((x) => ({ symptom: x.symptom.slice(0, 40), present: x.present, severity: x.present === 'yes' ? num(x.severity, 1, 10) : undefined }));
  }

  // Validate every reported date before saving anything
  const starts = [b.lastPeriodStart, ...(Array.isArray(b.previousStarts) ? b.previousStarts : [])].filter(Boolean);
  const errs = [
    ...(b.lastPeriodStart ? validatePeriod({ start: b.lastPeriodStart, end: b.lastPeriodEnd || null }) : []),
    ...(Array.isArray(b.previousStarts) ? b.previousStarts.filter(Boolean).flatMap((d) => validatePeriod({ start: d })) : []),
  ];
  if (b.lastPeriodStart && (b.previousStarts || []).some((d) => d && new Date(d) >= new Date(b.lastPeriodStart))) errs.push('Previous period starts must be before the most recent one.');
  if (errs.length) throw httpError(400, errs[0]);

  if (!c.setupAt) next.setupAt = new Date();
  req.user.cycle = next;
  await req.user.save();

  // Historical cycles first (oldest → newest), then the most recent period; nothing is overwritten
  const prev = (b.previousStarts || []).filter(Boolean).map((d) => new Date(d)).sort((x, y) => x - y);
  for (const d of prev) await addHistoricalCycle(userId, { start: d, silent: true }).catch(() => {});
  if (b.lastPeriodStart) {
    await addHistoricalCycle(userId, { start: b.lastPeriodStart, end: b.lastPeriodEnd || null, silent: true }).catch(() => {});
  }
  if (starts.length) {
    await TimelineEvent.create({
      userId, kind: 'cycle', title: 'Cycle history added',
      detail: `${starts.length} period start${starts.length > 1 ? 's' : ''} reported (most recent ${new Date(b.lastPeriodStart || starts[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}). Source: USER_REPORTED.`,
    });
  }
  if (!c.tracking) await TimelineEvent.create({ userId, kind: 'info', title: 'Menstrual cycle tracking turned on', detail: 'Cycle context is now used to interpret your other readings.' });

  // Record the resulting estimate (clearly labelled) on the timeline
  const ctx = cycleContext(next, await MenstrualCycle.find({ userId }).lean());
  if (ctx.cycleDay) {
    await TimelineEvent.create({ userId, kind: 'cycle', title: `Current cycle estimated as Day ${ctx.cycleDay}`, detail: `Source: AI_ESTIMATED · Confidence ${Math.round(ctx.confidence * 100)}%.` });
  }
  await refresh(userId);
  res.json({ tracking: true, context: ctx });
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
  const errs = validatePeriod({ start: req.body?.startDate || c.startDate, end: req.body?.periodEndDate === undefined ? c.periodEndDate : req.body.periodEndDate });
  if (errs.length) throw httpError(400, errs[0]);
  const before = c.startDate;
  if (validDate(req.body?.startDate)) c.startDate = new Date(req.body.startDate);
  if (req.body?.periodEndDate === null) { c.periodEndDate = undefined; c.periodLength = undefined; }
  else if (validDate(req.body?.periodEndDate)) {
    c.periodEndDate = new Date(req.body.periodEndDate);
    c.periodLength = Math.round((new Date(c.periodEndDate).setHours(0, 0, 0, 0) - new Date(c.startDate).setHours(0, 0, 0, 0)) / DAY) + 1;
  }
  c.source = 'user_reported';
  c.confidence = 1;
  await c.save();
  await recomputeAllLengths(req.user._id);
  await TimelineEvent.create({ userId: req.user._id, kind: 'cycle', title: 'Cycle history corrected', detail: `Period ${new Date(before).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} updated by you. Cycle lengths and estimates were recalculated.` });
  await refresh(req.user._id);
  res.json({ ok: true });
});

export const deleteCycle = asyncHandler(async (req, res) => {
  const c = await MenstrualCycle.findOneAndDelete({ _id: ownId(req.params.id), userId: req.user._id });
  if (!c) throw httpError(404, 'Cycle not found');
  await MenstrualSymptom.updateMany({ cycleId: c._id }, { $unset: { cycleId: '' } });
  await recomputeAllLengths(req.user._id);
  await TimelineEvent.create({ userId: req.user._id, kind: 'cycle', title: 'Cycle history corrected', detail: `Period record ${new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} removed by you.` });
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

/** GET /api/me/menstrual/cycles — cycle history with derived lengths (newest first). */
export const listCycles = asyncHandler(async (req, res) => {
  const cycles = recomputeLengths(await MenstrualCycle.find({ userId: req.user._id }).lean()).reverse();
  res.json(cycles.map((c) => ({ id: c._id, startDate: c.startDate, endDate: c.endDate, periodEndDate: c.periodEndDate, cycleLength: c.cycleLength, possibleGap: c.possibleGap, periodLength: c.periodLength, source: c.source, confidence: c.confidence })));
});

/** POST /api/me/menstrual/cycles { startDate, periodEndDate? } — add a previous (or missing) cycle. */
export const addCycle = asyncHandler(async (req, res) => {
  requireTracking(req);
  const doc = await addHistoricalCycle(req.user._id, { start: req.body?.startDate, end: req.body?.periodEndDate || null });
  await refresh(req.user._id);
  res.status(201).json({ id: doc._id });
});

/** GET /api/me/menstrual/current — current cycle estimate with provenance + confidence factors. */
export const currentCycle = asyncHandler(async (req, res) => {
  if (!req.user.cycle?.tracking) return res.json({ tracking: false });
  res.json(cycleContext(req.user.cycle, await MenstrualCycle.find({ userId: req.user._id }).lean()));
});

/** GET /api/me/menstrual/baseline — personal cycle baseline (median length, range, cycles used, confidence). */
export const cycleBaseline = asyncHandler(async (req, res) => {
  if (!req.user.cycle?.tracking) return res.json({ tracking: false });
  res.json(cycleBaselineStats(await MenstrualCycle.find({ userId: req.user._id }).lean()));
});
