// 24-hour monitoring cycle engine (spec §27-C). Pure functions — no database access.
import { describe, round } from './stats.js';

export const REQUIRED_METRICS = ['hr', 'spo2', 'resp', 'temp', 'movement'];
export const DAY_MS = 24 * 3600_000;

/** Local-midnight window containing `date`. */
export function cycleWindow(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

const isNight = (ts) => {
  const h = ts.getHours();
  return h >= 23 || h < 7;
};

/**
 * Summarise one cycle.
 * readings: [{ metric, value, ts: Date, source, confidence }]
 * reported: { sleepHours?, steps? } values the user entered for this cycle (override estimates)
 * Returns aggregates, activity, sleep, completeness, confidence, missing[].
 */
export function summarizeCycle(allReadings, start, end, reported = {}) {
  // sleep/steps entered by the user or written by the missing-data engine arrive as readings too
  const latest = (metric, source) => allReadings.filter((r) => r.metric === metric && r.source === source).sort((a, b) => b.ts - a.ts)[0];
  const repSleep = latest('sleep', 'reported');
  const estSleep = latest('sleep', 'estimated');
  const repSteps = latest('steps', 'reported');
  const estSteps = latest('steps', 'estimated');
  if (reported.sleepHours == null && repSleep) reported = { ...reported, sleepHours: repSleep.value };
  if (reported.steps == null && repSteps) reported = { ...reported, steps: repSteps.value };
  const readings = allReadings.filter((r) => r.source === 'measured' && r.metric !== 'sleep');

  const byMetric = {};
  for (const r of readings) (byMetric[r.metric] ||= []).push(r);

  const hours = Math.max(1, Math.round((Math.min(end, Date.now()) - start) / 3600_000));

  // Aggregates + hourly coverage per metric
  const aggregates = {};
  const coverage = {};
  for (const [metric, rows] of Object.entries(byMetric)) {
    const s = describe(rows.map((r) => r.value));
    const conf = rows.reduce((a, r) => a + (r.confidence ?? 1), 0) / rows.length;
    const sources = new Set(rows.map((r) => r.source));
    const hoursSeen = new Set(rows.map((r) => Math.floor((r.ts - start) / 3600_000)));
    coverage[metric] = Math.min(1, hoursSeen.size / hours);
    aggregates[metric] = {
      mean: round(s.mean, 2), min: round(s.min, 2), max: round(s.max, 2), count: s.n,
      nightMean: round(describe(rows.filter((r) => isNight(r.ts)).map((r) => r.value))?.mean, 2),
      source: sources.size === 1 ? [...sources][0] : 'measured',
      confidence: round(conf, 2),
      coverage: round(coverage[metric], 2),
    };
  }

  // Activity (steps): measured sum, or reported value
  const stepRows = byMetric.steps || [];
  let activity;
  if (reported.steps != null) activity = { steps: reported.steps, source: 'reported', confidence: 1 };
  else if (stepRows.length) activity = { steps: Math.round(stepRows.reduce((a, r) => a + r.value, 0)), source: 'measured', confidence: round((coverage.steps ?? 0) * 0.95, 2) };
  else if (estSteps) activity = { steps: Math.round(estSteps.value), source: 'estimated', confidence: estSteps.confidence };
  else activity = { steps: null, source: null, confidence: 0 };

  // Sleep: reported > estimated from night-time stillness (movement < 0.1)
  let sleep;
  if (reported.sleepHours != null) {
    sleep = { hours: reported.sleepHours, quality: reported.sleepQuality ?? null, source: 'reported', confidence: 1 };
  } else {
    const night = (byMetric.movement || []).filter((r) => isNight(r.ts));
    const nightHours = new Set(night.map((r) => Math.floor((r.ts - start) / 3600_000)));
    if (nightHours.size >= 4) {
      const stillFrac = night.filter((r) => r.value < 0.1).length / night.length;
      // 8 night hours in the window; scale by how much of the night we actually observed
      const hoursEst = round(8 * stillFrac, 1);
      const conf = round(Math.min(0.9, 0.5 + 0.05 * nightHours.size), 2);
      sleep = { hours: hoursEst, quality: null, source: 'estimated', confidence: conf };
    } else if (estSleep) {
      sleep = { hours: estSleep.value, quality: null, source: 'estimated', confidence: estSleep.confidence };
    } else {
      sleep = { hours: null, quality: null, source: null, confidence: 0 };
    }
  }

  // Completeness across required metrics
  const completeness = round(REQUIRED_METRICS.reduce((a, m) => a + (coverage[m] || 0), 0) / REQUIRED_METRICS.length, 2);

  const missing = [];
  for (const m of REQUIRED_METRICS) if ((coverage[m] || 0) < 0.5) missing.push({ field: m, resolution: 'unresolved' });
  if (sleep.hours == null) missing.push({ field: 'sleep', resolution: 'unresolved' });
  if (activity.steps == null) missing.push({ field: 'steps', resolution: 'unresolved' });

  const confs = Object.values(aggregates).map((a) => a.confidence);
  const confidence = confs.length ? round((confs.reduce((a, b) => a + b, 0) / confs.length) * (0.5 + 0.5 * completeness), 2) : 0;

  const events = countNightEvents(readings);

  return { aggregates, activity, sleep, completeness, confidence, missing, events };
}

// Night-time respiratory pauses / SpO2 dips (inputs to the sleep-related risk module).
export const SPO2_DIP = 93;
export const RESP_PAUSE = 7;
export function countNightEvents(readings) {
  const night = readings.filter((r) => isNight(r.ts));
  const spo2Dips = night.filter((r) => r.metric === 'spo2' && r.value <= SPO2_DIP).length;
  const respPauses = night.filter((r) => r.metric === 'resp' && r.value <= RESP_PAUSE).length;
  const spo2Night = night.filter((r) => r.metric === 'spo2').length;
  return { spo2Dips, respPauses, nightSamples: spo2Night };
}
