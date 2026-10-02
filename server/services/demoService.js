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

const STEP = 5 * 60_000; // 5-minute resolution
const NIGHT_METRICS = ['hr', 'spo2', 'resp', 'movement', 'position'];

function generate(userId, from, to, profile = 'normal', { abnormal = false, only = null } = {}) {
  const docs = [];
  for (let t = from; t < to; t += STEP) {
    const s = sample(new Date(t), DEFAULT_PERSONA, profile, { intervalSec: 300, abnormal });
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
    await Promise.all([Reading, Cycle, Baseline, Question, TriageEvent, TimelineEvent, SymptomLog].map((M) => M.deleteMany({ userId })));
    await User.updateOne({ _id: userId }, { $set: { device: { packets: 0 }, deviceId: '', 'cycle.tracking': false }, $unset: { 'cycle.lastPeriodStart': '' } });
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
  return {
    readings,
    cycles,
    baseline: { established: !!baseline?.established, daysUsed: baseline?.daysUsed || 0 },
    openQuestions: open,
    triage: current?.assessment?.result ? { level: current.assessment.result.level, confidence: current.assessment.result.confidence } : null,
    focus: current?.nextPriority?.metrics || [],
    missing: (current?.missing || []).map((m) => `${m.field}:${m.resolution}`),
  };
}
