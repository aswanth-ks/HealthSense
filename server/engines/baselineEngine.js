// Personal baseline engine (spec §27-D). Pure functions.
import { describe, round } from './stats.js';

export const BASELINE_METRICS = ['hr', 'spo2', 'temp', 'resp', 'steps', 'sleep'];
export const MIN_DAYS = 3;
export const MIN_COMPLETENESS = 0.7;
export const WINDOW_DAYS = 7;

// Minimum SD so a very stable user doesn't get an absurdly narrow band
const MIN_SD = { hr: 2, spo2: 0.5, temp: 0.1, resp: 0.8, steps: 800, sleep: 0.4 };

/** Value that represents a cycle for a baseline metric. */
export function cycleValue(cycle, metric) {
  if (metric === 'steps') return cycle.activity?.steps ?? null;
  if (metric === 'sleep') return cycle.sleep?.hours ?? null;
  return cycle.aggregates?.[metric]?.mean ?? null;
}

/**
 * cycles: closed cycles (newest first or any order) with { completeness, aggregates, activity, sleep }.
 * Uses the last WINDOW_DAYS cycles that meet MIN_COMPLETENESS.
 */
export function buildBaseline(cycles) {
  const usable = cycles
    .filter((c) => (c.completeness ?? 0) >= MIN_COMPLETENESS)
    .sort((a, b) => new Date(b.start) - new Date(a.start))
    .slice(0, WINDOW_DAYS);

  const metrics = {};
  for (const m of BASELINE_METRICS) {
    const s = describe(usable.map((c) => cycleValue(c, m)));
    if (!s) continue;
    const sd = Math.max(s.sd, MIN_SD[m]);
    metrics[m] = { mean: round(s.mean, 2), sd: round(sd, 2), p10: round(s.p10, 2), p90: round(s.p90, 2), n: s.n };
  }
  return { metrics, daysUsed: usable.length, established: usable.length >= MIN_DAYS };
}

export function zScore(value, stat) {
  if (value == null || !stat || !stat.sd) return null;
  return (value - stat.mean) / stat.sd;
}

/**
 * Personal interpretation: the same value can mean different things for different users (§27-D demo).
 * Returns { z, band: 'typical'|'slightly_above'|'above'|'slightly_below'|'below', text }
 */
export function interpret(metric, value, stat, label = metric) {
  const z = zScore(value, stat);
  if (z == null) return { z: null, band: 'unknown', text: `Not enough history yet to judge ${label} against your baseline.` };
  const band = z >= 2 ? 'above' : z >= 1 ? 'slightly_above' : z <= -2 ? 'below' : z <= -1 ? 'slightly_below' : 'typical';
  const words = {
    typical: 'is typical for you',
    slightly_above: 'is slightly higher than usual for you',
    above: 'is well above your usual range',
    slightly_below: 'is slightly lower than usual for you',
    below: 'is well below your usual range',
  }[band];
  return { z: round(z, 2), band, text: `${label} of ${value} ${words} (your baseline ${stat.mean} ± ${stat.sd}).` };
}
