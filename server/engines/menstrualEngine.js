// Menstrual-cycle context engine. Pure functions — no database access.
//
// Principle: every body is different. Cycle-related changes are learned per person and are NOT treated as
// abnormal by default. Estimated information is always labelled with its source and confidence, and nothing
// here is a diagnosis.
import { describe, round } from './stats.js';

const DAY = 24 * 3600_000;
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Day number within a cycle (period start = day 1). */
export const cycleDayOf = (date, start) => daysBetween(start, date) + 1;

/**
 * Current cycle context.
 * settings: user.cycle ({ tracking, lastPeriodStart, avgLengthDays, lengthUnknown, typicalPeriodLength, regularity })
 * cycles: MenstrualCycle docs (any order)
 */
export function cycleContext(settings = {}, cycles = [], now = new Date()) {
  if (!settings.tracking) return { tracking: false };

  const sorted = [...cycles].filter((c) => new Date(c.startDate) <= now).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  let last = sorted[sorted.length - 1];
  if (!last && settings.lastPeriodStart) last = { startDate: settings.lastPeriodStart, source: 'user_reported', confidence: 0.9 };

  // Typical cycle length: learned history > what the user told us > population default (clearly labelled)
  const completed = sorted.map((c) => c.cycleLength).filter((n) => n >= 15 && n <= 60);
  const hist = describe(completed);
  let length;
  if (hist && hist.n >= 2) length = { days: Math.round(hist.mean), source: 'historical', confidence: round(clamp(0.9 - (hist.sd || 0) * 0.04 - (hist.n < 3 ? 0.1 : 0), 0.4, 0.92), 2), basedOn: `${hist.n} recorded cycles` };
  else if (!settings.lengthUnknown && settings.avgLengthDays) length = { days: settings.avgLengthDays, source: 'user_reported', confidence: 0.7, basedOn: 'what you told us' };
  else length = { days: 28, source: 'ai_estimated', confidence: 0.35, basedOn: 'a typical cycle (your length is not known yet)' };

  // Regularity: observed from history when possible
  let regularity;
  if (hist && hist.n >= 3) {
    const r = hist.sd <= 2 ? 'regular' : hist.sd <= 5 ? 'somewhat_irregular' : 'very_irregular';
    regularity = { value: r, source: 'historical', variabilityDays: round(hist.sd, 1) };
  } else {
    regularity = { value: settings.regularity || 'unsure', source: 'user_reported' };
  }

  const periodLength = (() => {
    const known = sorted.map((c) => c.periodLength).filter(Boolean);
    if (known.length >= 2) return { days: Math.round(known.reduce((a, b) => a + b, 0) / known.length), source: 'historical' };
    if (settings.typicalPeriodLength) return { days: settings.typicalPeriodLength, source: 'user_reported' };
    return { days: 5, source: 'ai_estimated' };
  })();

  if (!last) {
    return { tracking: true, known: false, length, regularity, periodLength, history: completed.length, message: 'Record the first day of your period to start cycle context.' };
  }

  const cycleDay = cycleDayOf(now, last.startDate);
  const overdue = cycleDay > length.days + (regularity.value === 'regular' ? 5 : 10);
  const dayConfidence = round(overdue ? 0.3 : last.source === 'user_reported' ? 0.95 : last.confidence ?? 0.6, 2);

  // Period status: observed when the user recorded start/end, otherwise an estimate
  let period;
  if (last.periodEndDate && dayStart(now) > dayStart(last.periodEndDate)) period = { status: 'not_on_period', source: 'user_reported' };
  else if (last.periodEndDate) period = { status: 'on_period', source: 'user_reported' };
  else if (cycleDay <= periodLength.days) period = { status: 'on_period', source: cycleDay <= 1 ? 'user_reported' : 'ai_estimated', note: 'Period end not recorded yet' };
  else period = { status: 'not_on_period', source: 'ai_estimated' };

  // Expected next period — always an estimate
  const nextDate = new Date(dayStart(last.startDate).getTime() + length.days * DAY);
  const variabilityPenalty = regularity.value === 'very_irregular' ? 0.3 : regularity.value === 'somewhat_irregular' ? 0.15 : regularity.value === 'unsure' ? 0.1 : 0;
  const nextPeriod = {
    date: nextDate,
    source: length.source === 'historical' ? 'historical' : 'ai_estimated',
    confidence: round(clamp(length.confidence - variabilityPenalty, 0.15, 0.9), 2),
    windowDays: regularity.value === 'regular' ? 2 : regularity.value === 'somewhat_irregular' ? 4 : 7,
  };

  // Estimated phase — only shown when we're reasonably confident
  let phase = null;
  const phaseConfidence = round(clamp(dayConfidence * length.confidence * (1 - variabilityPenalty), 0, 0.9), 2);
  if (!overdue && phaseConfidence >= 0.45) {
    const ov = length.days - 14;
    const name = cycleDay <= periodLength.days ? 'menstrual' : cycleDay < ov - 1 ? 'follicular' : cycleDay <= ov + 1 ? 'ovulatory (estimated window)' : 'luteal';
    phase = { name, source: 'ai_estimated', confidence: phaseConfidence };
  }

  return {
    tracking: true,
    known: true,
    lastPeriodStart: last.startDate,
    startSource: last.source,
    cycleDay: overdue ? null : cycleDay,
    cycleDayRaw: cycleDay,
    dayConfidence,
    overdue,
    period,
    periodLength,
    length,
    regularity,
    nextPeriod,
    phase,
    history: completed.length,
    confidence: round((dayConfidence + length.confidence) / 2, 2),
  };
}

/** Which cycle context a calendar day belongs to, or null if unknown. */
export function dayContext(date, cycles) {
  const sorted = [...cycles].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const c = sorted[i];
    if (dayStart(date) < dayStart(c.startDate)) continue;
    const next = sorted[i + 1];
    const day = cycleDayOf(date, c.startDate);
    if (next && dayStart(date) >= dayStart(next.startDate)) return null;
    if (!next && day > 45) return null; // too far from any recorded start to know
    return { cycleId: c._id, day, context: day <= 3 ? 'period_days_1_3' : day >= 6 ? 'outside_period' : null };
  }
  return null;
}

const METRIC_VALUE = {
  hr: (d) => d.aggregates?.hr?.mean,
  temp: (d) => d.aggregates?.temp?.mean,
  resp: (d) => d.aggregates?.resp?.mean,
  spo2: (d) => d.aggregates?.spo2?.mean,
  steps: (d) => d.activity?.steps,
  sleep: (d) => d.sleep?.hours,
};
const MIN_SD = { hr: 1.5, temp: 0.08, resp: 0.5, spo2: 0.4, steps: 600, sleep: 0.3 };

/**
 * Cycle-aware baselines from daily (24-hour) monitoring cycles.
 * Only produced when enough history exists: ≥2 menstrual cycles and ≥4 days for "period days 1–3".
 */
export function cycleBaselines(days, cycles) {
  const buckets = { period_days_1_3: [], outside_period: [] };
  const cyclesSeen = { period_days_1_3: new Set(), outside_period: new Set() };
  for (const d of days) {
    if ((d.completeness ?? 0) < 0.6) continue;
    const ctx = dayContext(d.start, cycles);
    if (!ctx?.context) continue;
    buckets[ctx.context].push(d);
    cyclesSeen[ctx.context].add(String(ctx.cycleId));
  }

  const out = [];
  for (const [context, list] of Object.entries(buckets)) {
    const enough = context === 'period_days_1_3' ? list.length >= 4 && cyclesSeen[context].size >= 2 : list.length >= 7;
    if (!enough) continue;
    for (const [metric, get] of Object.entries(METRIC_VALUE)) {
      const s = describe(list.map(get));
      if (!s || s.n < 3) continue;
      const sd = Math.max(s.sd, MIN_SD[metric]);
      const dp = metric === 'steps' ? 0 : metric === 'temp' ? 2 : 1;
      out.push({
        cycleContext: context,
        metric,
        baselineValue: round(s.mean, dp),
        range: { lo: round(s.mean - 1.5 * sd, dp), hi: round(s.mean + 1.5 * sd, dp) },
        n: s.n,
        cyclesUsed: cyclesSeen[context].size,
        confidence: round(clamp((context === 'period_days_1_3' ? 0.35 : 0.5) + 0.06 * s.n + 0.05 * cyclesSeen[context].size, 0.3, 0.92), 2),
      });
    }
  }
  return out;
}

const PAIN = new Set(['pain', 'cramp', 'cramps']);

/**
 * Recurring cycle-associated symptom pattern across cycles (days 1–3 of each cycle).
 * symptoms: normalised [{ ts, type, severity }] from both symptom stores.
 * days: daily monitoring cycles (for activity/sleep comparison).
 */
export function recurringPattern({ cycles, symptoms, days, now = new Date() }) {
  const sorted = [...cycles].filter((c) => new Date(c.startDate) <= now).sort((a, b) => new Date(a.startDate) - new Date(b.startDate)).slice(-4);
  const outside = days.filter((d) => dayContext(d.start, cycles)?.context === 'outside_period');
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const stepsOutside = avg(outside.map((d) => d.activity?.steps).filter((x) => x != null));
  const sleepOutside = avg(outside.map((d) => d.sleep?.hours).filter((x) => x != null));

  const perCycle = sorted.map((c, i) => {
    const s0 = dayStart(c.startDate).getTime();
    const inWin = (t) => { const x = new Date(t).getTime(); return x >= s0 && x < s0 + 3 * DAY; };
    const win = symptoms.filter((s) => inWin(s.ts));
    const max = (types) => Math.max(0, ...win.filter((s) => types.has(s.type)).map((s) => s.severity ?? 0));
    const winDays = days.filter((d) => inWin(d.start));
    const steps = avg(winDays.map((d) => d.activity?.steps).filter((x) => x != null));
    const sleep = avg(winDays.map((d) => d.sleep?.hours).filter((x) => x != null));
    const activityDropPct = steps != null && stepsOutside ? Math.round((1 - steps / stepsOutside) * 100) : null;
    const sleepChange = sleep != null && sleepOutside ? round(sleep - sleepOutside, 1) : null;
    const pain = max(PAIN);
    const fatigue = max(new Set(['fatigue']));
    const sleepDisturbance = win.some((s) => s.type === 'sleep_disturbance' || s.type === 'wake_sudden');
    const activityImpact = win.some((s) => s.type === 'activity_impact' || s.activityImpact === 'significant');
    const matched = pain >= 6 && ((activityDropPct ?? 0) >= 20 || fatigue >= 6 || activityImpact);
    return {
      index: i + 1, startDate: c.startDate, isCurrent: i === sorted.length - 1 && cycleDayOf(now, c.startDate) <= 3,
      pain, fatigue, activityDropPct, sleepHours: sleep != null ? round(sleep, 1) : null, sleepChange, sleepDisturbance, activityImpact, matched,
      symptomsRecorded: win.length,
    };
  });

  const examined = perCycle.filter((c) => c.symptomsRecorded > 0 || c.activityDropPct != null);
  const matched = perCycle.filter((c) => c.matched);
  const detected = matched.length >= 2;
  const parts = [];
  if (matched.every((c) => c.pain >= 6)) parts.push('pain');
  if (matched.filter((c) => c.fatigue >= 6).length >= 2) parts.push('fatigue');
  if (matched.filter((c) => (c.activityDropPct ?? 0) >= 20).length >= 2) parts.push('reduced activity');
  const words = ['', 'one', 'two', 'three', 'four'];

  return {
    detected,
    strength: matched.length >= 3 ? 'strong' : detected ? 'emerging' : 'none',
    cyclesMatched: matched.length,
    cyclesExamined: examined.length,
    window: 'cycle days 1–3',
    perCycle,
    summary: detected
      ? `Similar ${parts.length > 1 ? `increases in ${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : `increases in ${parts[0] || 'symptoms'}`} were observed during the first 3 days of ${matched.length} of your recent cycles.`
      : null,
    statement: detected ? 'Recurring cycle-associated symptom pattern detected. Consider discussing this pattern with a qualified healthcare professional.' : null,
    describedCycles: words[matched.length] || String(matched.length),
  };
}
