// Database side of the cycle + baseline engines.
import mongoose from 'mongoose';
import { waitUntil } from '@vercel/functions';
import Reading from '../models/Reading.js';
import Cycle from '../models/Cycle.js';
import Baseline from '../models/Baseline.js';
import TimelineEvent from '../models/TimelineEvent.js';
import { cycleWindow, summarizeCycle, DAY_MS } from '../engines/cycleEngine.js';
import { buildBaseline } from '../engines/baselineEngine.js';
import { emitToUser } from '../utils/realtime.js';
import { analyzeRecent } from './loopService.js';
import { runTriage } from './triageService.js';

const lastRun = new Map();
const pending = new Map();
const THROTTLE_MS = 30_000;

/** Called after ingest. Runs at most every 30 s per user, always with a trailing run so no data is missed. */
export function scheduleCycleUpdate(userId) {
  const key = String(userId);
  // Serverless (Vercel): a timer would be frozen once the response is sent, so run now and keep the
  // function alive until the analysis finishes. Throttle per warm instance to avoid redundant work.
  if (process.env.VERCEL) {
    if (Date.now() - (lastRun.get(key) || 0) < 10_000) return;
    lastRun.set(key, Date.now());
    waitUntil(updateCycles(userId).catch((e) => console.error('cycle update failed:', e.message)));
    return;
  }
  if (pending.has(key)) return;
  const wait = Math.max(2_000, THROTTLE_MS - (Date.now() - (lastRun.get(key) || 0)));
  pending.set(key, setTimeout(async () => {
    pending.delete(key);
    lastRun.set(key, Date.now());
    try {
      await updateCycles(userId);
    } catch (e) {
      console.error('cycle update failed:', e.message);
    }
  }, wait));
}

export async function upsertCycle(userId, start, end, index, status) {
  const readings = await Reading.find({ userId, ts: { $gte: start, $lt: end } }).select('metric value ts source confidence -_id').lean();
  const summary = summarizeCycle(readings, start, end);
  return Cycle.findOneAndUpdate(
    { userId, start },
    { $set: { ...summary, end, status }, $setOnInsert: { userId, index, start } },
    { upsert: true, new: true }
  );
}

// One update at a time per user (automatic + manual runs would otherwise race on the same cycles).
const chains = new Map();
export function updateCycles(userId, opts = {}) {
  const key = String(userId);
  const run = (chains.get(key) || Promise.resolve()).catch(() => {}).then(() => doUpdateCycles(userId, opts));
  chains.set(key, run);
  run.finally(() => { if (chains.get(key) === run) chains.delete(key); }).catch(() => {});
  return run;
}

/** Build/refresh every cycle from the first reading to today, then recompute the baseline. */
async function doUpdateCycles(userId, { full = false } = {}) {
  const first = await Reading.findOne({ userId }).sort({ ts: 1 }).select('ts').lean();
  if (!first) return null;

  const { start: firstStart } = cycleWindow(first.ts);
  const { start: todayStart } = cycleWindow(new Date());
  const existing = await Cycle.find({ userId }).select('start status updatedAt').lean();
  const closed = new Map(existing.filter((c) => c.status === 'closed').map((c) => [c.start.getTime(), c]));

  let index = 1;
  // Decide which days need (re)computing, then process them in parallel batches (each day is independent).
  const todo = [];
  for (let t = firstStart.getTime(); t <= todayStart.getTime(); t += DAY_MS, index += 1) {
    const isToday = t === todayStart.getTime();
    const done = closed.get(t);
    todo.push({ t, index, isToday, done });
  }
  const needsWork = async ({ t, isToday, done }) => {
    // A closed cycle is only recomputed if readings for its window arrived after it was computed
    // (e.g. the watch uploads buffered data after a Wi-Fi drop). ObjectIds encode insert time.
    if (isToday || !done || full) return true;
    return !!(await Reading.exists({
      userId, ts: { $gte: new Date(t), $lt: new Date(t + DAY_MS) },
      _id: { $gt: mongoose.Types.ObjectId.createFromTime(Math.floor(new Date(done.updatedAt).getTime() / 1000)) },
    }));
  };
  const BATCH = 8;
  for (let i = 0; i < todo.length; i += BATCH) {
    await Promise.all(todo.slice(i, i + BATCH).map(async (d) => {
      if (!(await needsWork(d))) return;
      await upsertCycle(userId, new Date(d.t), new Date(d.t + DAY_MS), d.index, d.isToday ? 'open' : 'closed');
    }));
  }

  const baseline = await recomputeBaseline(userId);
  await analyzeRecent(userId);
  await runTriage(userId);
  emitToUser(userId, 'cycles', { updatedAt: new Date() });
  return baseline;
}

export async function recomputeBaseline(userId) {
  const cycles = await Cycle.find({ userId, status: 'closed' }).sort({ start: -1 }).limit(30).lean();
  const result = buildBaseline(cycles);
  const prev = await Baseline.findOne({ userId });
  const becameEstablished = result.established && !prev?.established;

  const doc = await Baseline.findOneAndUpdate(
    { userId },
    {
      $set: {
        metrics: result.metrics,
        daysUsed: result.daysUsed,
        established: result.established,
        ...(becameEstablished ? { establishedAt: new Date() } : {}),
      },
    },
    { upsert: true, new: true }
  );

  if (becameEstablished) {
    await TimelineEvent.create({
      userId,
      kind: 'baseline',
      title: 'Personal baseline established',
      detail: `Learned from ${result.daysUsed} days of monitoring. Resting heart rate ${result.metrics.hr?.mean ?? '—'} BPM, SpO₂ ${result.metrics.spo2?.mean ?? '—'}%.`,
    });
    emitToUser(userId, 'timeline', { kind: 'baseline' });
  }
  return doc;
}
