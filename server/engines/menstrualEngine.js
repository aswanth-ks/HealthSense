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
 * Historical cycle lengths from consecutive recorded period starts. Pure.
 * Returns the cycles sorted oldest → newest with cycleLength / endDate derived from the next start.
 */
export function recomputeLengths(cycles) {
  const sorted = [...cycles].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return sorted.map((c, i) => {
    const next = sorted[i + 1];
    const len = next ? daysBetween(c.startDate, next.startDate) : null;
    // > 45 days between recorded starts most likely means a period in between wasn't recorded — flag it, don't use it
    return { ...c, cycleLength: len, possibleGap: len != null && len > 45, endDate: next ? new Date(dayStart(next.startDate).getTime() - DAY) : null };
  });
}

/** Validate a reported period: end may not be before start, dates may not be in the future. */
export function validatePeriod({ start, end, now = new Date() }) {
  const errors = [];
  if (!start || Number.isNaN(new Date(start).getTime())) errors.push('A valid period start date is required.');
  else if (dayStart(start) > dayStart(now)) errors.push('The period start date cannot be in the future.');
  if (end != null && end !== '') {
    if (Number.isNaN(new Date(end).getTime())) errors.push('The period end date is not valid.');
    else if (start && dayStart(end) < dayStart(start)) errors.push('The period end date cannot be before the start date.');
    else if (dayStart(end) > dayStart(now)) errors.push('The period end date cannot be in the future.');
    else if (start && daysBetween(start, end) > 15) errors.push('A period longer than 15 days looks like a typing mistake — please check the dates.');
  }
  return errors;
}

/** Personal cycle baseline from recorded cycle lengths (median preferred). */
export function cycleBaselineStats(cycles) {
  const lengths = recomputeLengths(cycles).filter((c) => !c.possibleGap).map((c) => c.cycleLength).filter((n) => n != null && n >= 15 && n <= 45);
  if (!lengths.length) return { status: 'developing', cycles_used: 0 };
  const s = describe(lengths);
  const sorted = [...lengths].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const sd = sorted.length > 1 ? s.sd : null;
  const regularity = sorted.length < 3 ? null : sd <= 2 ? 'usually_regular' : sd <= 5 ? 'sometimes_irregular' : 'usually_irregular';
  return {
    status: sorted.length >= 3 ? 'established' : 'developing',
    median_cycle_length: round(median, 1),
    average_cycle_length: round(s.mean, 1),
    min_cycle_length: sorted[0],
    max_cycle_length: sorted[sorted.length - 1],
    variation_days: sd != null ? round(sd, 1) : null,
    cycles_used: sorted.length,
    regularity,
    confidence: round(clamp(0.45 + 0.1 * Math.min(sorted.length, 5) - (sd ?? 0) * 0.04, 0.3, 0.95), 2),
  };
}

const REG_FROM_USER = { regular: 'usually_regular', somewhat_irregular: 'sometimes_irregular', very_irregular: 'usually_irregular', unsure: 'not_sure' };

/**
 * Deterministic confidence for the current-cycle estimate (a software data-confidence indicator — not
 * clinically validated). Every factor is listed so the UI can show what the number is based on.
 */
export function cycleConfidence({ latestKnown, latestSource, previousKnown, baseline, lengthSource, regularity, daysSinceLatest, recentlyConfirmed }) {
  if (!latestKnown) return { value: 0, factors: [] };
  const factors = [];
  let v = latestSource === 'user_reported' ? 0.55 : 0.4;
  factors.push({ factor: 'Most recent period start reported', effect: '+' });
  if (previousKnown) { v += 0.1; factors.push({ factor: 'Previous cycle history known', effect: '+' }); }
  if (baseline?.cycles_used >= 2) { v += Math.min(0.15, 0.05 * baseline.cycles_used); factors.push({ factor: `${baseline.cycles_used} historical cycles analysed`, effect: '+' }); }
  if (baseline?.variation_days != null) {
    if (baseline.variation_days <= 2) { v += 0.08; factors.push({ factor: 'Historical cycle lengths are consistent', effect: '+' }); }
    else if (baseline.variation_days > 5) { v -= 0.12; factors.push({ factor: 'Historical cycle lengths vary a lot', effect: '−' }); }
  }
  if (lengthSource === 'user_reported') { v += 0.05; factors.push({ factor: 'Typical cycle length reported by you', effect: '+' }); }
  if (!lengthSource) { v -= 0.1; factors.push({ factor: 'Typical cycle length unknown', effect: '−' }); }
  if (regularity === 'usually_irregular') { v -= 0.1; factors.push({ factor: 'Cycles reported as usually irregular', effect: '−' }); }
  if (recentlyConfirmed) { v += 0.05; factors.push({ factor: 'Period start confirmed recently', effect: '+' }); }
  if (daysSinceLatest > 45) { v -= 0.2; factors.push({ factor: 'Last recorded period was a long time ago', effect: '−' }); }
  return { value: round(clamp(v, 0.1, 0.95), 2), factors };
}

/**
 * Current cycle context. Nothing is assumed: without a reported most-recent period start there is no estimate,
 * and an unknown cycle length is never replaced by a "standard" 28 days.
 * settings: user.cycle ({ tracking, avgLengthDays, lengthUnknown, typicalPeriodLength, regularity, previousUnknown })
 * cycles: MenstrualCycle docs (any order)
 */
export function cycleContext(settings = {}, cycles = [], now = new Date()) {
  if (!settings.tracking) return { tracking: false };

  const sorted = recomputeLengths(cycles.filter((c) => dayStart(c.startDate) <= dayStart(now)));
  const last = sorted[sorted.length - 1];
  const baseline = cycleBaselineStats(sorted);
  const regularityValue = baseline.regularity || REG_FROM_USER[settings.regularity] || 'not_sure';
  const regularity = { value: regularityValue, source: baseline.regularity ? 'historical' : settings.regularity ? 'user_reported' : null, variabilityDays: baseline.variation_days ?? null };

  // Typical cycle length: learned history (median) > user-reported > unknown (never a silent default)
  let length;
  if (baseline.cycles_used >= 1) length = { days: Math.round(baseline.median_cycle_length), source: 'historical', confidence: baseline.confidence, basedOn: `${baseline.cycles_used} recorded cycle${baseline.cycles_used > 1 ? 's' : ''}` };
  else if (!settings.lengthUnknown && settings.avgLengthDays) length = { days: settings.avgLengthDays, source: 'user_reported', confidence: 0.7, basedOn: 'what you told us' };
  else length = { days: null, source: null, confidence: 0, basedOn: 'unknown' };

  const periodLength = (() => {
    const known = sorted.map((c) => c.periodLength).filter(Boolean);
    if (known.length >= 2) return { days: Math.round(known.reduce((a, b) => a + b, 0) / known.length), source: 'historical' };
    if (settings.typicalPeriodLength) return { days: settings.typicalPeriodLength, source: 'user_reported' };
    if (known.length === 1) return { days: known[0], source: 'user_reported' };
    return { days: null, source: null };
  })();

  if (!last) {
    return {
      tracking: true, known: false, status: 'needs_setup', length, regularity, periodLength, baseline, history: 0,
      message: "Tell HealthSense when your most recent period started to estimate your current cycle.",
    };
  }

  const previousKnown = sorted.length >= 2;
  const status = previousKnown || length.source ? 'ready' : 'needs_more';
  const cycleDayRaw = cycleDayOf(now, last.startDate);
  const overdueLimit = length.days ? length.days + (regularityValue === 'usually_irregular' ? 15 : 10) : 45;
  const overdue = cycleDayRaw > overdueLimit;
  const conf = cycleConfidence({
    latestKnown: true, latestSource: last.source, previousKnown, baseline, lengthSource: length.source, regularity: regularityValue,
    daysSinceLatest: cycleDayRaw - 1, recentlyConfirmed: last.source === 'user_reported' && cycleDayRaw <= 7,
  });

  // Period status: observed when an end was recorded; otherwise estimated from period duration (if known)
  let period;
  if (last.periodEndDate && dayStart(now) > dayStart(last.periodEndDate)) period = { status: 'not_on_period', label: 'Not currently on period', source: 'user_reported', confidence: 1 };
  else if (last.periodEndDate) period = { status: 'on_period', label: 'Period ongoing', source: 'user_reported', confidence: 1 };
  else if (periodLength.days && cycleDayRaw <= periodLength.days) period = { status: 'on_period', label: 'Period likely ongoing', source: 'ai_estimated', confidence: round(clamp(0.95 - 0.05 * (cycleDayRaw - 1), 0.5, 0.95), 2) };
  else if (periodLength.days) period = { status: 'not_on_period', label: 'Period likely ended', source: 'ai_estimated', confidence: round(clamp(conf.value, 0.4, 0.9), 2) };
  else if (cycleDayRaw === 1) period = { status: 'on_period', label: 'Period started today', source: 'user_reported', confidence: 1 };
  else period = { status: 'unknown', label: 'Period status unknown', source: null, confidence: 0 };

  // Expected next period — only when a cycle length is known, and always an estimate
  const nextPeriod = length.days ? {
    date: new Date(dayStart(last.startDate).getTime() + length.days * DAY),
    source: length.source === 'historical' ? 'historical' : 'ai_estimated',
    confidence: round(clamp(conf.value - (regularityValue === 'usually_irregular' ? 0.2 : regularityValue === 'sometimes_irregular' ? 0.1 : 0), 0.15, 0.9), 2),
    windowDays: baseline.variation_days != null ? Math.max(2, Math.round(baseline.variation_days * 2)) : regularityValue === 'usually_regular' ? 3 : 7,
  } : null;

  // Broad phase only (no ovulation timing); "uncertain" when confidence is low or the length is unknown
  let phase;
  if (overdue || conf.value < 0.5) phase = { name: 'uncertain', label: 'Uncertain', source: null, confidence: conf.value };
  else if (period.status === 'on_period' || (periodLength.days && cycleDayRaw <= periodLength.days)) phase = { name: 'menstrual', label: 'Menstrual', source: 'ai_estimated', confidence: conf.value };
  else if (!length.days) phase = { name: 'uncertain', label: 'Uncertain', source: null, confidence: conf.value };
  else {
    const f = cycleDayRaw / length.days;
    phase = f <= 0.4 ? { name: 'early_cycle', label: 'Early cycle' } : f <= 0.65 ? { name: 'mid_cycle', label: 'Mid-cycle' } : { name: 'late_cycle', label: 'Late cycle' };
    phase = { ...phase, source: 'ai_estimated', confidence: conf.value };
  }

  const basedOn = ['Most recent reported period', ...(previousKnown ? ['Previous cycle history'] : []), ...(length.source ? [`Typical cycle length (${length.source === 'historical' ? 'from your history' : 'reported by you'})`] : []), ...(baseline.variation_days != null ? ['Historical consistency'] : [])];

  return {
    tracking: true,
    known: true,
    status,
    lastPeriodStart: last.startDate,
    lastPeriodEnd: last.periodEndDate || null,
    startSource: last.source,
    cycleDay: overdue ? null : cycleDayRaw,
    cycleDayRaw,
    cycleDaySource: 'ai_estimated',
    dayConfidence: conf.value,
    overdue,
    period,
    periodLength,
    length,
    regularity,
    nextPeriod,
    phase,
    baseline,
    basedOn,
    confidenceFactors: conf.factors,
    history: baseline.cycles_used,
    confidence: conf.value,
    missing: [
      ...(!previousKnown && !settings.previousUnknown ? ['previous_period_start'] : []),
      ...(!length.source ? ['typical_cycle_length'] : []),
      ...(!periodLength.days ? ['period_duration'] : []),
    ],
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
