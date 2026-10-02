// Daily steps engine. Pure, deterministic functions — no database access, no LLM.
// Missing days are never treated as zero: they stay `null` and are excluded from every calculation.
import { round } from './stats.js';

export const SOURCES = ['HEALTH_CONNECT', 'APPLE_HEALTH', 'DEMO'];
export const SOURCE_LABEL = { HEALTH_CONNECT: 'Health Connect', APPLE_HEALTH: 'Apple Health', DEMO: 'Demo data' };
// A real connected platform always wins over demo data for the same day.
const SOURCE_RANK = { HEALTH_CONNECT: 2, APPLE_HEALTH: 2, DEMO: 1 };
export const TREND_MIN_DAYS = 4;
export const TREND_THRESHOLD = 0.1; // ±10% change across the period counts as a trend
export const BASELINE_MIN_DAYS = 3;

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date key, e.g. "2026-10-02". */
export function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const isDayKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Shift a date key by n calendar days (timezone-independent). */
export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Local midnight for a date key. */
export const keyToDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

/**
 * One value per day for the `days` days ending at `todayKey` (oldest → newest).
 * records: [{ date, value, source, syncedAt }]. Days without a record are `steps: null`.
 */
export function buildSeries(records, todayKey, days) {
  const best = new Map();
  for (const r of records) {
    if (r.value == null || !Number.isFinite(r.value) || r.value < 0) continue;
    const cur = best.get(r.date);
    const better = !cur
      || (SOURCE_RANK[r.source] || 0) > (SOURCE_RANK[cur.source] || 0)
      || ((SOURCE_RANK[r.source] || 0) === (SOURCE_RANK[cur.source] || 0) && new Date(r.syncedAt || 0) > new Date(cur.syncedAt || 0));
    if (better) best.set(r.date, r);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(todayKey, -i);
    const r = best.get(date);
    out.push({ date, steps: r ? Math.round(r.value) : null, source: r?.source || null, synced_at: r?.syncedAt || null });
  }
  return out;
}

/**
 * Change between two days. Percentage is only given when the previous day has a real, non-zero value.
 * Returns { available, diff, percent, direction, reason? }
 */
export function compareDays(current, previous) {
  if (current == null) return { available: false, diff: null, percent: null, direction: null, reason: 'no_current' };
  if (previous == null) return { available: false, diff: null, percent: null, direction: null, reason: 'no_previous' };
  const diff = current - previous;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  if (previous === 0) return { available: false, diff, percent: null, direction, reason: 'previous_zero' };
  return { available: true, diff, percent: round((diff / previous) * 100, 1), direction };
}

const valid = (series) => series.filter((d) => d.steps != null);

/** Average of the last `n` days of the series, using valid days only. */
export function average(series, n = series.length) {
  const v = valid(series.slice(-n));
  if (!v.length) return { value: null, valid_days: 0, total_days: Math.min(n, series.length) };
  return { value: Math.round(v.reduce((a, d) => a + d.steps, 0) / v.length), valid_days: v.length, total_days: Math.min(n, series.length) };
}

/**
 * Deterministic trend: least-squares slope over the valid days (gaps keep their true position),
 * expressed as the fitted change across the period relative to the period's average.
 */
export function trend(series) {
  const pts = series.map((d, i) => ({ x: i, y: d.steps })).filter((p) => p.y != null);
  if (pts.length < TREND_MIN_DAYS) {
    return { direction: 'insufficient', change_percent: null, valid_days: pts.length, summary: 'Not enough activity data is available to determine a reliable trend.' };
  }
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const slope = sxx ? pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx : 0;
  const span = pts[pts.length - 1].x - pts[0].x;
  const rel = my ? (slope * span) / my : 0;
  const direction = rel >= TREND_THRESHOLD ? 'increasing' : rel <= -TREND_THRESHOLD ? 'decreasing' : 'stable';
  const summary = {
    increasing: 'Your activity has generally increased over the selected period.',
    decreasing: 'Your activity has generally decreased over the selected period.',
    stable: 'Your activity has remained relatively stable over the selected period.',
  }[direction];
  return { direction, change_percent: round(rel * 100, 1), slope_per_day: Math.round(slope), valid_days: pts.length, summary };
}

/** Average, highest and lowest day, valid-day count. */
export function insights(series) {
  const v = valid(series);
  if (!v.length) return { average: null, highest: null, lowest: null, valid_days: 0, total_days: series.length };
  const hi = v.reduce((a, d) => (d.steps > a.steps ? d : a));
  const lo = v.reduce((a, d) => (d.steps < a.steps ? d : a));
  return {
    average: average(series).value,
    highest: { date: hi.date, steps: hi.steps },
    lowest: { date: lo.date, steps: lo.steps },
    valid_days: v.length,
    total_days: series.length,
  };
}

/**
 * Compare a value with the personal steps baseline (Baseline.metrics.steps from the baseline engine).
 * Never invents a baseline: fewer than BASELINE_MIN_DAYS days → "developing".
 */
export function baselineComparison(value, stat) {
  if (!stat || stat.mean == null || (stat.n ?? 0) < BASELINE_MIN_DAYS) {
    return { status: 'developing', message: 'Your activity baseline is still developing.' };
  }
  const baseline = Math.round(stat.mean);
  if (value == null) return { status: 'no_value', baseline, days_used: stat.n };
  const diff = value - baseline;
  const percent = baseline ? round((diff / baseline) * 100, 1) : null;
  return { status: 'ready', baseline, value, diff, percent, direction: diff > 0 ? 'above' : diff < 0 ? 'below' : 'same', days_used: stat.n };
}

/** Everything the Steps History page needs for one range. */
export function stepsSummary({ records, todayKey, days = 7, baseline = null }) {
  // Fetch a little more than the range so "yesterday" exists for the oldest day's change.
  const longSeries = buildSeries(records, todayKey, Math.max(days, 30) + 1);
  const series = longSeries.slice(-days);
  const today = longSeries[longSeries.length - 1];
  const yesterday = longSeries[longSeries.length - 2];
  const withChange = series.map((d) => {
    const idx = longSeries.indexOf(d);
    return { ...d, change: compareDays(d.steps, longSeries[idx - 1]?.steps ?? null) };
  });
  const prior7 = longSeries.slice(-14, -7);
  const last7 = longSeries.slice(-7);
  const avg7 = average(last7);
  const avgPrev7 = average(prior7);
  return {
    today_key: todayKey,
    days,
    today: { date: today.date, steps: today.steps, source: today.source, synced_at: today.synced_at },
    vs_yesterday: compareDays(today.steps, yesterday.steps),
    averages: {
      d7: avg7,
      d14: average(longSeries, 14),
      d30: average(longSeries, 30),
    },
    week_change: compareDays(avg7.value, avgPrev7.value),
    trend: trend(series),
    insights: insights(series),
    baseline: baselineComparison(today.steps, baseline),
    series: withChange,
  };
}
