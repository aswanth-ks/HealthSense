// Menstrual cycle tracking — database side. Feeds cycle context into the existing engines
// (baseline, questions, triage, next-cycle priority, timeline). Only active when the user enabled tracking.
import MenstrualCycle from '../models/MenstrualCycle.js';
import MenstrualSymptom from '../models/MenstrualSymptom.js';
import CycleBaseline from '../models/CycleBaseline.js';
import SymptomLog from '../models/SymptomLog.js';
import TimelineEvent from '../models/TimelineEvent.js';
import Question from '../models/Question.js';
import Cycle from '../models/Cycle.js';
import User from '../models/User.js';
import { cycleContext, cycleBaselines, recurringPattern, dayContext, cycleDayOf, recomputeLengths, validatePeriod } from '../engines/menstrualEngine.js';

const DAY = 24 * 3600_000;
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fmtDay = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const SYMPTOM_LOG_TYPES = { pain: 'pain', cramp: 'pain', cramps: 'pain', fatigue: 'fatigue', bloating: 'bloating', headache: 'headache', wake_sudden: 'sleep_disturbance', sleep_disturbance: 'sleep_disturbance' };

/** Symptoms from both stores, normalised to { ts, type, severity, activityImpact }. */
export async function cycleSymptoms(userId, since = new Date(Date.now() - 120 * DAY)) {
  const [logs, mens] = await Promise.all([
    SymptomLog.find({ userId, ts: { $gte: since } }).lean(),
    MenstrualSymptom.find({ userId, ts: { $gte: since } }).lean(),
  ]);
  return [
    ...logs.filter((l) => SYMPTOM_LOG_TYPES[l.type]).map((l) => ({ ts: l.ts, type: SYMPTOM_LOG_TYPES[l.type], severity: l.severity, source: 'user_reported' })),
    ...mens.map((m) => ({ ts: m.ts, type: m.symptom === 'cramps' ? 'pain' : m.symptom, severity: m.severity, activityImpact: m.activityImpact, source: m.source })),
  ];
}

async function timelineOnce(userId, key, event) {
  if (await TimelineEvent.exists({ userId, 'refs.key': key })) return;
  await TimelineEvent.create({ userId, kind: 'cycle', ...event, refs: { key } });
}

/**
 * Full cycle analysis for a user (called from the triage pipeline). Returns null when tracking is off,
 * so nothing menstrual is computed or shown for users who haven't opted in.
 */
export async function analyzeMenstrual(userId, user) {
  if (!user?.cycle?.tracking) return null;
  const [cycles, days, symptoms] = await Promise.all([
    MenstrualCycle.find({ userId }).sort({ startDate: 1 }).lean(),
    Cycle.find({ userId, start: { $gte: new Date(Date.now() - 120 * DAY) } }).select('start completeness aggregates activity sleep').lean(),
    cycleSymptoms(userId),
  ]);

  const context = cycleContext(user.cycle, cycles);
  const pattern = recurringPattern({ cycles, symptoms, days });

  // Cycle-aware baselines (only stored when there is enough history)
  const baselines = cycleBaselines(days, cycles);
  const keep = new Set(baselines.map((b) => `${b.cycleContext}:${b.metric}`));
  for (const b of baselines) {
    await CycleBaseline.updateOne({ userId, cycleContext: b.cycleContext, metric: b.metric }, { $set: b }, { upsert: true });
  }
  const stale = (await CycleBaseline.find({ userId }).select('cycleContext metric').lean()).filter((b) => !keep.has(`${b.cycleContext}:${b.metric}`));
  if (stale.length) await CycleBaseline.deleteMany({ _id: { $in: stale.map((s) => s._id) } });

  // Timeline: physiological/activity observations in cycle context + the recurring pattern
  for (const c of pattern.perCycle) {
    if ((c.activityDropPct ?? 0) >= 20) {
      await timelineOnce(userId, `cycle-activity:${new Date(c.startDate).toISOString()}`, {
        ts: new Date(dayStart(c.startDate).getTime() + 2 * DAY + 20 * 3600_000),
        title: `Activity decreased ${c.activityDropPct}%`,
        detail: `During cycle days 1–3 (period starting ${fmtDay(c.startDate)}), compared with your days outside the period.`,
      });
    }
  }
  if (pattern.detected) {
    const first = pattern.perCycle.find((c) => c.matched);
    await timelineOnce(userId, `cycle-pattern:${new Date(first.startDate).toISOString()}:${pattern.cyclesMatched}`, {
      title: 'Recurring cycle-associated symptom pattern identified',
      detail: `${pattern.summary} This is a pattern, not a diagnosis — consider discussing it with a healthcare professional.`,
    });
  }

  return { context, pattern, baselines };
}

/** Cycle-aware baseline for "today", if one exists and today's context is known. */
export async function todaysCycleBaselines(userId, user) {
  if (!user?.cycle?.tracking) return null;
  const cycles = await MenstrualCycle.find({ userId }).lean();
  const ctx = dayContext(new Date(), cycles);
  if (!ctx?.context) return null;
  const rows = await CycleBaseline.find({ userId, cycleContext: ctx.context }).lean();
  return rows.length ? { context: ctx.context, day: ctx.day, metrics: Object.fromEntries(rows.map((r) => [r.metric, r])) } : null;
}

// ---------- Recording ----------

export async function startPeriod(userId, date = new Date(), { source = 'user_reported', silent = false } = {}) {
  const day = dayStart(date);
  const latest = await MenstrualCycle.findOne({ userId }).sort({ startDate: -1 });
  // Same period re-reported (within 10 days of its start): just correct the start date
  if (latest && Math.abs(day - dayStart(latest.startDate)) < 10 * DAY) {
    latest.startDate = day < dayStart(latest.startDate) ? day : latest.startDate;
    await latest.save();
    return latest;
  }
  if (latest && day > dayStart(latest.startDate)) {
    latest.endDate = new Date(day.getTime() - DAY);
    latest.cycleLength = Math.round((day - dayStart(latest.startDate)) / DAY);
    await latest.save();
  }
  const user = await User.findById(userId).select('cycle').lean();
  const cycle = await MenstrualCycle.create({ userId, startDate: day, source, confidence: source === 'user_reported' ? 1 : 0.6, regularity: user?.cycle?.regularity || null });
  await User.updateOne({ _id: userId }, { $set: { 'cycle.lastPeriodStart': day } });
  await Question.updateMany({ userId, code: 'cycle.period_started', status: 'open' }, { $set: { status: 'answered', answer: true, answeredAt: new Date() } });
  if (!silent) {
    await TimelineEvent.create({
      userId, ts: day, kind: 'cycle', title: 'Period start reported',
      detail: `Source: USER_REPORTED.${latest?.cycleLength ? ` Previous cycle length: ${latest.cycleLength} days.` : ' First recorded period.'}`,
    });
  }
  return cycle;
}

export async function endPeriod(userId, date = new Date()) {
  const latest = await MenstrualCycle.findOne({ userId }).sort({ startDate: -1 });
  if (!latest) return null;
  const day = dayStart(date);
  if (day < dayStart(latest.startDate)) return null;
  latest.periodEndDate = day;
  latest.periodLength = Math.round((day - dayStart(latest.startDate)) / DAY) + 1;
  await latest.save();
  await TimelineEvent.create({ userId, ts: day, kind: 'cycle', title: 'Period ended', detail: `Period lasted ${latest.periodLength} days.` });
  return latest;
}

const LABEL = { pain: 'Pain', cramps: 'Cramps', fatigue: 'Fatigue', bloating: 'Bloating', headache: 'Headache', sleep_disturbance: 'Sleep disturbance', activity_impact: 'Activity impact', flow: 'Flow', custom: 'Symptom' };

export async function addCycleSymptom(userId, body) {
  const ts = body.ts && !Number.isNaN(new Date(body.ts).getTime()) && new Date(body.ts) <= new Date() ? new Date(body.ts) : new Date();
  const cycles = await MenstrualCycle.find({ userId }).lean();
  const ctx = dayContext(ts, cycles);
  const doc = await MenstrualSymptom.create({
    userId, cycleId: ctx?.cycleId, ts,
    symptom: body.symptom, label: body.label, severity: body.severity, durationHours: body.durationHours,
    activityImpact: body.activityImpact || null, flow: body.flow || null, notes: body.notes,
    source: 'user_reported', confidence: 1,
  });
  if (body.symptom === 'flow' && ctx?.cycleId && body.flow) {
    await MenstrualCycle.updateOne({ _id: ctx.cycleId }, { $push: { flow: { ts, level: body.flow } } });
  }
  const strong = (body.severity ?? 0) >= 6 || body.activityImpact === 'significant';
  if (strong) {
    const what = body.symptom === 'custom' ? body.label || 'Symptom' : LABEL[body.symptom] || body.symptom;
    await TimelineEvent.create({
      userId, ts, kind: 'cycle',
      title: body.severity != null ? `${what} ${body.severity}/10` : `${what}: significant impact`,
      detail: ctx?.day ? `Cycle day ${ctx.day}.` : 'Recorded in cycle context.',
    });
  }
  return { ...doc.toObject(), cycleDay: ctx?.day ?? null };
}

export async function deleteAllCycleData(userId) {
  await Promise.all([
    MenstrualCycle.deleteMany({ userId }),
    MenstrualSymptom.deleteMany({ userId }),
    CycleBaseline.deleteMany({ userId }),
    TimelineEvent.deleteMany({ userId, kind: 'cycle' }),
    Question.deleteMany({ userId, code: /^cycle\./ }),
  ]);
  await User.updateOne({ _id: userId }, { $unset: { 'cycle.lastPeriodStart': '' } });
}

export { cycleDayOf };

// ---------- Cycle history ----------

const httpErr = (status, message) => Object.assign(new Error(message), { status });

/** Re-derive every cycle's length/end from consecutive starts (after adds, edits, deletes). */
export async function recomputeAllLengths(userId) {
  const cycles = await MenstrualCycle.find({ userId }).lean();
  for (const c of recomputeLengths(cycles)) {
    await MenstrualCycle.updateOne({ _id: c._id }, c.cycleLength != null
      ? { $set: { cycleLength: c.cycleLength, endDate: c.endDate } }
      : { $unset: { cycleLength: '', endDate: '' } });
  }
  const latest = cycles.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
  await User.updateOne({ _id: userId }, latest ? { $set: { 'cycle.lastPeriodStart': latest.startDate } } : { $unset: { 'cycle.lastPeriodStart': '' } });
}

/**
 * Add a (usually previous) cycle reported by the user. Validated; duplicates within 10 days of an existing
 * start are rejected; historical cycles are never overwritten.
 */
export async function addHistoricalCycle(userId, { start, end, confidence = 1, note, silent = false }) {
  const errors = validatePeriod({ start, end });
  if (errors.length) throw httpErr(400, errors[0]);
  const day = dayStart(start);
  const near = await MenstrualCycle.findOne({ userId, startDate: { $gte: new Date(day - 10 * DAY), $lte: new Date(day.getTime() + 10 * DAY) } }).lean();
  if (near) throw httpErr(409, `A period starting ${fmtDay(near.startDate)} is already recorded close to that date.`);
  const doc = await MenstrualCycle.create({
    userId, startDate: day, source: 'user_reported', confidence,
    ...(end ? { periodEndDate: dayStart(end), periodLength: Math.round((dayStart(end) - day) / DAY) + 1 } : {}),
  });
  await recomputeAllLengths(userId);
  if (!silent) {
    await TimelineEvent.create({ userId, kind: 'cycle', title: 'Cycle history added', detail: `Period starting ${fmtDay(day)}${end ? ` – ${fmtDay(end)}` : ''}. Source: USER_REPORTED${confidence < 1 ? ` (approximate, ${Math.round(confidence * 100)}% confidence)` : ''}.${note ? ` ${note}` : ''}` });
  }
  return doc;
}

/** Answer to "Do you remember approximately when your previous period started?" */
export async function applyPreviousStartAnswer(userId, answer) {
  const offsets = { 'About 3–4 weeks before': 25, 'About 5–6 weeks before': 38, 'More than 6 weeks before': 50 };
  if (!offsets[answer]) {
    await User.updateOne({ _id: userId }, { $set: { 'cycle.previousUnknown': true } });
    return null;
  }
  const latest = await MenstrualCycle.findOne({ userId }).sort({ startDate: -1 }).lean();
  if (!latest) return null;
  const start = new Date(dayStart(latest.startDate).getTime() - offsets[answer] * DAY);
  try {
    return await addHistoricalCycle(userId, { start, confidence: 0.6, note: `From your answer “${answer}”.` });
  } catch {
    return null;
  }
}
