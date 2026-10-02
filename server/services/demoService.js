// Demo Mode: generates realistic data for the SIGNED-IN user and runs it through the real engines.
// Nothing here bypasses the pipeline — readings go in exactly like sensor data, then cycles → baseline →
// missing data → adaptive questions → triage → next-cycle priority are recomputed normally.
import Reading from '../models/Reading.js';
import Cycle from '../models/Cycle.js';
import Baseline from '../models/Baseline.js';
import Question from '../models/Question.js';
import TriageEvent from '../models/TriageEvent.js';
import TimelineEvent from '../models/TimelineEvent.js';
import SymptomLog from '../models/SymptomLog.js';
import User from '../models/User.js';
import { sample, DEFAULT_PERSONA } from '../sim/generator.js';
import { cycleWindow, DAY_MS } from '../engines/cycleEngine.js';
import { updateCycles } from './cycleService.js';
import MenstrualCycle from '../models/MenstrualCycle.js';
import MenstrualSymptom from '../models/MenstrualSymptom.js';
import CycleBaseline from '../models/CycleBaseline.js';
import Assessment from '../models/Assessment.js';
import { startPeriod } from './menstrualService.js';

const STEP = 5 * 60_000; // 5-minute resolution
const NIGHT_METRICS = ['hr', 'spo2', 'resp', 'movement', 'position'];

function generate(userId, from, to, profile = 'normal', { abnormal = false, only = null, step = STEP, dayIndexOf = null } = {}) {
  const docs = [];
  for (let t = from; t < to; t += step) {
    const s = sample(new Date(t), DEFAULT_PERSONA, profile, { intervalSec: step / 1000, abnormal, dayIndex: dayIndexOf ? dayIndexOf(t) : 0 });
    for (const r of s.readings) {
      if (only && !only.includes(r.metric)) continue;
      docs.push({ userId, metric: r.metric, value: r.value, ts: new Date(t), source: 'measured', confidence: r.quality, deviceId: 'HS-DEMO' });
    }
  }
  return docs;
}

async function insert(docs) {
  for (let i = 0; i < docs.length; i += 5000) await Reading.insertMany(docs.slice(i, i + 5000), { ordered: false });
}

async function markDevice(userId, online) {
  const now = new Date();
  await User.updateOne({ _id: userId }, {
    $set: {
      deviceId: 'HS-DEMO',
      'device.mode': 'simulation',
      'device.battery': 86,
      'device.lastSeen': online ? now : new Date(now - 3 * 3600_000),
      'device.firstSeen': new Date(now - 5 * DAY_MS),
    },
  });
}

// Night window of a cycle = 00:00–07:00 of that day (the end of the previous evening's sleep).
const nightOf = (dayStart) => [dayStart.getTime(), dayStart.getTime() + 7 * 3600_000];

export const SCENARIOS = {
  /** Start over: remove this user's monitoring data. */
  async reset(userId) {
    await Promise.all([Reading, Cycle, Baseline, Question, TriageEvent, TimelineEvent, SymptomLog, MenstrualCycle, MenstrualSymptom, CycleBaseline, Assessment].map((M) => M.deleteMany({ userId })));
    await User.updateOne({ _id: userId }, { $set: { device: { packets: 0 }, deviceId: '', 'cycle.tracking': false }, $unset: { 'cycle.lastPeriodStart': '', 'cycle.setupAt': '' } });
    return 'All monitoring data for this account was cleared.';
  },

  /** Several days of normal 24-hour monitoring → personal baseline. */
  async normal(userId) {
    await SCENARIOS.reset(userId);
    const today = cycleWindow(new Date()).start.getTime();
    await insert(generate(userId, today - 4 * DAY_MS, Date.now(), 'normal'));
    await TimelineEvent.create({ userId, ts: new Date(today - 4 * DAY_MS), kind: 'device', title: 'Monitoring started', detail: 'HealthSense Watch (demo) connected.' });
    await markDevice(userId, true);
    await updateCycles(userId, { full: true });
    return '4 days of normal monitoring generated. Your personal baseline is learned from these days.';
  },

  /** Repeated night-time respiratory pauses + SpO2 dips on the last 3 nights. */
  async sleep(userId) {
    const today = cycleWindow(new Date()).start.getTime();
    if (!(await Reading.exists({ userId }))) await SCENARIOS.normal(userId);
    for (let d = 2; d >= 0; d -= 1) {
      const [from, to] = nightOf(new Date(today - d * DAY_MS));
      const end = Math.min(to, Date.now());
      if (end <= from) continue;
      await Reading.deleteMany({ userId, source: 'measured', metric: { $in: NIGHT_METRICS }, ts: { $gte: new Date(from), $lt: new Date(end) } });
      await insert(generate(userId, from, end, 'apnea', { abnormal: true, only: NIGHT_METRICS }));
    }
    await updateCycles(userId, { full: true });
    return 'Apnea-like events (breathing pauses with SpO₂ dips) were added to the last 3 nights.';
  },

  /** Recurring strong pain/cramps around menstruation, with fatigue. */
  async symptoms(userId) {
    if (!(await Reading.exists({ userId }))) await SCENARIOS.normal(userId);
    const now = Date.now();
    const periodStart = new Date(now - 2 * DAY_MS);
    await User.updateOne({ _id: userId }, { $set: { 'cycle.tracking': true, 'cycle.lastPeriodStart': periodStart, 'cycle.avgLengthDays': 28 } });
    const logs = [
      ['cramp', 8, 2], ['pain', 7, 2], ['fatigue', 7, 2],
      ['cramp', 7, 1], ['pain', 8, 1], ['fatigue', 6, 1],
      ['cramp', 6, 0], ['fatigue', 6, 0],
    ].map(([type, severity, daysAgo]) => ({
      userId, type, severity, source: 'reported', location: type === 'fatigue' ? undefined : 'Lower abdomen',
      ts: new Date(now - daysAgo * DAY_MS - 2 * 3600_000),
    }));
    await SymptomLog.insertMany(logs);
    await TimelineEvent.create({ userId, kind: 'symptom', title: 'Recurring pain reported', detail: 'Strong cramps/pain (6–8/10) with fatigue on 3 consecutive days around menstruation.' });
    await updateCycles(userId, { full: true });
    return 'Pain/cramp and fatigue reports were added for the last 3 days, linked to the menstrual cycle.';
  },

  /**
   * Menstrual cycle tracking: three 28-day cycles where cycle days 1–3 repeatedly bring strong pain, fatigue,
   * reduced activity and a modest HR rise. Shows that cycle data changes how everything else is interpreted.
   */
  async menstrual(userId) {
    await SCENARIOS.reset(userId);
    const today = cycleWindow(new Date()).start.getTime();
    const starts = [today - 57 * DAY_MS, today - 29 * DAY_MS, today - 1 * DAY_MS]; // current period: day 2 today
    const first = starts[0];
    const dayIndexOf = (t) => Math.floor((t - first) / DAY_MS); // generator 'endo' flare = days 0–2 of every 28

    await User.updateOne({ _id: userId }, { $set: {
      'cycle.tracking': true, 'cycle.avgLengthDays': 28, 'cycle.lengthUnknown': false, 'cycle.typicalPeriodLength': 5,
      'cycle.regularity': 'regular', 'cycle.setupAt': new Date(first),
    } });
    // ~2 months of sensor data: 30-min resolution for history, 5-min for the last 4 days
    await insert(generate(userId, first, today - 4 * DAY_MS, 'endo', { abnormal: true, step: 60 * 60_000, dayIndexOf }));
    await insert(generate(userId, today - 4 * DAY_MS, Date.now(), 'endo', { abnormal: true, dayIndexOf }));
    await TimelineEvent.create({ userId, ts: new Date(first), kind: 'device', title: 'Monitoring started', detail: 'HealthSense Watch (demo) connected; menstrual cycle tracking enabled.' });

    // Periods (sequential: each start closes the previous cycle), then all symptoms in one batch
    const symptomDocs = [];
    const events = [];
    for (const [i, s] of starts.entries()) {
      const cyc = await startPeriod(userId, new Date(s));
      if (i < 2) await MenstrualCycle.updateOne({ _id: cyc._id }, { $set: { periodEndDate: new Date(s + 4 * DAY_MS), periodLength: 5 } });
      for (let d = 0; d < 3; d += 1) {
        const ts = new Date(s + d * DAY_MS + 14 * 3600_000);
        if (ts > new Date()) break;
        const add = (symptom, severity, extra = {}) => symptomDocs.push({ userId, cycleId: cyc._id, ts, symptom, severity, source: 'user_reported', confidence: 1, ...extra });
        add('pain', d === 1 ? 8 : 7);
        add('cramps', 7);
        add('fatigue', 6 + (d % 2));
        events.push({ userId, ts, kind: 'cycle', title: `Pain ${d === 1 ? 8 : 7}/10`, detail: `Cycle day ${d + 1}. Cramps 7/10, fatigue ${6 + (d % 2)}/10.` });
        if (d === 1) {
          add('activity_impact', undefined, { activityImpact: 'significant' });
          events.push({ userId, ts, kind: 'cycle', title: 'Activity impact: significant', detail: `Cycle day ${d + 1}.` });
        }
        if (d === 0) {
          symptomDocs.push({ userId, cycleId: cyc._id, ts: new Date(ts.getTime() - 8 * 3600_000), symptom: 'sleep_disturbance', severity: 5, source: 'user_reported', confidence: 1 });
          events.push({ userId, ts: new Date(ts.getTime() - 8 * 3600_000), kind: 'cycle', title: 'Sleep disturbance recorded', detail: 'Cycle day 1.' });
        }
      }
    }
    await MenstrualSymptom.insertMany(symptomDocs);
    await TimelineEvent.insertMany(events);
    await markDevice(userId, true);
    await updateCycles(userId, { full: true });
    return 'Three menstrual cycles generated (with sensor data). Each showed strong pain, fatigue and reduced activity on cycle days 1–3 — the system learns this personal pattern and adapts questions and monitoring.';
  },

  /**
   * 3-Day Sleep Pattern: 4 normal days (baseline) then
   *   day 1 reduced sleep + fatigue · day 2 breathing irregularity + SpO₂ dips · day 3 repeated + fatigue.
   */
  async threeDay(userId) {
    await SCENARIOS.reset(userId);
    const today = cycleWindow(new Date()).start.getTime();
    const d1 = today - 2 * DAY_MS;
    // baseline days + the 3-day window, normal physiology
    await insert(generate(userId, today - 6 * DAY_MS, Date.now(), 'normal'));
    // day 2 and day 3 nights: apnea-like events (00:00–07:00)
    for (const day of [d1 + DAY_MS, today]) {
      const [from, to] = nightOf(new Date(day));
      const endN = Math.min(to, Date.now());
      if (endN <= from) continue;
      await Reading.deleteMany({ userId, source: 'measured', metric: { $in: NIGHT_METRICS }, ts: { $gte: new Date(from), $lt: new Date(endN) } });
      await insert(generate(userId, from, endN, 'apnea', { abnormal: true, only: NIGHT_METRICS }));
    }
    // day 1: reduced sleep (reported) + fatigue; day 3: fatigue again
    await Reading.create({ userId, metric: 'sleep', value: 5.9, ts: new Date(d1 + 7 * 3600_000), source: 'reported', confidence: 1 });
    await SymptomLog.insertMany([
      { userId, type: 'fatigue', severity: 5, ts: new Date(d1 + 15 * 3600_000), source: 'reported' },
      { userId, type: 'fatigue', severity: 6, ts: new Date(Math.min(today + 10 * 3600_000, Date.now() - 60_000)), source: 'reported' },
    ]);
    await TimelineEvent.insertMany([
      { userId, ts: new Date(today - 6 * DAY_MS), kind: 'device', title: 'Monitoring started', detail: 'HealthSense Watch (demo) connected.' },
      { userId, ts: new Date(d1 + 15 * 3600_000), kind: 'symptom', title: 'Fatigue reported', detail: 'Severity 5/10 after a short night (5h 54m).' },
    ]);
    await markDevice(userId, true);
    await updateCycles(userId, { full: true });
    return '3-day sleep pattern generated: reduced sleep and fatigue on day 1, nighttime breathing irregularity with SpO₂ dips on days 2 and 3, fatigue again on day 3. Open the 3-Day Assessment.';
  },

  /** Watch not worn last night: SpO2, breathing and movement missing; no reported sleep. */
  async missing(userId) {
    if (!(await Reading.exists({ userId }))) await SCENARIOS.normal(userId);
    const today = cycleWindow(new Date()).start;
    const [from, to] = nightOf(today);
    await Reading.deleteMany({ userId, ts: { $gte: new Date(from), $lt: new Date(Math.min(to, Date.now())) }, metric: { $in: ['spo2', 'resp', 'movement', 'position'] } });
    await Reading.deleteMany({ userId, metric: { $in: ['sleep', 'steps'] }, source: { $in: ['reported', 'estimated'] }, ts: { $gte: today } });
    await markDevice(userId, false);
    await updateCycles(userId, { full: true });
    return 'Last night\'s SpO₂, breathing and movement data were removed (watch not worn). The system now decides: sensor → estimate → ask you.';
  },
};

export async function demoStatus(userId) {
  const [readings, cycles, baseline, open, current] = await Promise.all([
    Reading.countDocuments({ userId }),
    Cycle.countDocuments({ userId }),
    Baseline.findOne({ userId }).lean(),
    Question.countDocuments({ userId, status: 'open' }),
    Cycle.findOne({ userId }).sort({ start: -1 }).select('assessment nextPriority index missing').lean(),
  ]);
  const mens = current?.assessment?.menstrual;
  return {
    readings,
    cycles,
    baseline: { established: !!baseline?.established, daysUsed: baseline?.daysUsed || 0 },
    openQuestions: open,
    triage: current?.assessment?.result ? { level: current.assessment.result.level, confidence: current.assessment.result.confidence } : null,
    focus: current?.nextPriority?.metrics || [],
    missing: (current?.missing || []).map((m) => `${m.field}:${m.resolution}`),
    cycle: mens ? { day: mens.cycleDay, pattern: !!mens.pattern } : null,
  };
}
