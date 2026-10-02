// 3-Day Assessment — Layer 1: structured, deterministic health assessment. Pure functions, no I/O.
//
// Input is the user's real stored data (daily monitoring cycles, personal baseline, symptoms, answers,
// timeline, triage, menstrual context). Output is a structured JSON assessment in which every conclusion
// references evidence. The triage level is taken from the existing triage engine — never invented here.
// Nothing in this file diagnoses a condition.
import { describe, round } from './stats.js';
import { interpret } from './baselineEngine.js';

export const ENGINE_VERSION = 'assessment-engine-1.1.0';
const DAY = 24 * 3600_000;
const LEVELS = ['LOW', 'MONITOR', 'MODERATE', 'HIGH'];
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const avg = (xs) => { const v = xs.filter((x) => x != null && Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const PROV = { measured: 'MEASURED', reported: 'USER_REPORTED', user_reported: 'USER_REPORTED', estimated: 'AI_ESTIMATED', ai_estimated: 'AI_ESTIMATED', historical: 'HISTORICAL' };
const prov = (s) => PROV[s] || 'MEASURED';

const METRICS = {
  sleep_duration: { label: 'Sleep', unit: 'hours', base: 'sleep', get: (d) => d.sleep?.hours, src: (d) => d.sleep },
  activity: { label: 'Activity', unit: 'steps', base: 'steps', get: (d) => d.activity?.steps, src: (d) => d.activity },
  resting_hr: { label: 'Resting heart rate', unit: 'BPM', base: null, get: (d) => d.aggregates?.hr?.nightMean, src: (d) => d.aggregates?.hr },
  spo2: { label: 'Blood oxygen (SpO₂)', unit: '%', base: 'spo2', get: (d) => d.aggregates?.spo2?.mean, src: (d) => d.aggregates?.spo2 },
  respiration: { label: 'Respiration', unit: 'br/min', base: 'resp', get: (d) => d.aggregates?.resp?.mean, src: (d) => d.aggregates?.resp },
  temperature: { label: 'Temperature', unit: '°C', base: 'temp', get: (d) => d.aggregates?.temp?.mean, src: (d) => d.aggregates?.temp },
};

/**
 * @param {object} p
 * @param {Array}  p.days      daily Cycle docs inside the window (any order)
 * @param {Array}  p.history   daily Cycle docs before the window (for historical comparisons)
 * @param {object} p.baseline  { established, daysUsed, metrics: { hr, spo2, temp, resp, steps, sleep } }
 * @param {object} p.triage    current triage result { level, confidence, reasons, module }
 * @param {Array}  p.modules   risk-module outputs (sleepRisk, endoSymptoms)
 * @param {object} p.priority  next-cycle priority from the existing closed loop
 * @param {Array}  p.symptoms  [{ id, ts, type, severity, source }]
 * @param {Array}  p.questions [{ id, code, text, status, answer, answeredAt, createdAt, reason, kind, options }]
 * @param {Array}  p.timeline  [{ id, ts, kind, title, detail }]
 * @param {object} p.menstrual analyzeMenstrual() result or null (tracking disabled)
 * @param {object} p.counts    provenance counts { measured, user_reported, historical, estimated }
 */
export function buildAssessment({ days = [], history = [], baseline = {}, triage = null, modules = [], priority = null, symptoms = [], questions = [], timeline = [], menstrual = null, counts = {}, now = new Date(), start, end }) {
  const window = [...days].sort((a, b) => new Date(a.start) - new Date(b.start));
  const evidence = [];
  const addEv = (e) => { const id = `ev_${evidence.length + 1}`; evidence.push({ id, ...e }); return id; };

  const usableDays = window.filter((d) => (d.completeness ?? 0) >= 0.3);
  const completeness = round(avg(window.map((d) => d.completeness ?? 0)) ?? 0, 2);
  const sufficient = usableDays.length >= 2;
  const baselineReady = !!baseline.established && (baseline.daysUsed ?? 0) >= 3;

  // ---------------- Baseline comparison ----------------
  const histNightHr = describe(history.filter((d) => (d.completeness ?? 0) >= 0.7).map((d) => d.aggregates?.hr?.nightMean));
  const baseStat = (key, m) => {
    if (key === 'resting_hr') return histNightHr && histNightHr.n >= 3 ? { mean: histNightHr.mean, sd: Math.max(histNightHr.sd, 2), n: histNightHr.n, source: 'HISTORICAL' } : null;
    const b = baseline.metrics?.[m.base];
    return b && baselineReady ? { ...b, source: 'HISTORICAL' } : null;
  };

  const baselineComparison = [];
  for (const [key, m] of Object.entries(METRICS)) {
    const vals = window.map((d) => ({ d, v: m.get(d) })).filter((x) => x.v != null);
    if (!vals.length) {
      baselineComparison.push({ metric: key, label: m.label, unit: m.unit, recent: null, baseline: null, status: 'no_data' });
      continue;
    }
    const recent = avg(vals.map((x) => x.v));
    const b = baseStat(key, m);
    const evIds = vals.map(({ d, v }) => addEv({
      metric: key, label: m.label, value: round(v, m.unit === 'steps' ? 0 : 2), unit: m.unit, timestamp: d.start,
      day: fmtDate(d.start), source: prov(m.src(d)?.source) === 'MEASURED' ? 'sensor' : prov(m.src(d)?.source) === 'USER_REPORTED' ? 'user' : 'estimate',
      provenance: prov(m.src(d)?.source), confidence: m.src(d)?.confidence ?? null,
      baseline: b ? round(b.mean, 2) : null,
    }));
    const row = {
      metric: key, label: m.label, unit: m.unit,
      recent: round(recent, m.unit === 'steps' ? 0 : 2),
      recent_range: vals.length > 1 ? [round(Math.min(...vals.map((x) => x.v)), 1), round(Math.max(...vals.map((x) => x.v)), 1)] : null,
      days_with_data: vals.length,
      evidence_ids: evIds,
    };
    if (b) {
      const i = interpret(key, recent, b);
      row.baseline = round(b.mean, m.unit === 'steps' ? 0 : 2);
      row.baseline_range = [round(b.mean - 2 * b.sd, 1), round(b.mean + 2 * b.sd, 1)];
      row.baseline_source = b.source;
      row.deviation = round(recent - b.mean, m.unit === 'steps' ? 0 : 2);
      row.deviation_percent = b.mean ? round(((recent - b.mean) / b.mean) * 100, 1) : null;
      row.direction = Math.abs(row.deviation_percent ?? 0) < 2 ? 'stable' : recent > b.mean ? 'increased' : 'decreased';
      row.band = i.band;
      row.status = ['above', 'below'].includes(i.band) ? 'changed' : ['slightly_above', 'slightly_below'].includes(i.band) ? 'slight_change' : 'typical';
    } else {
      row.status = 'baseline_developing';
    }
    baselineComparison.push(row);
  }
  const cmp = Object.fromEntries(baselineComparison.map((r) => [r.metric, r]));

  // ---------------- Symptoms in the window ----------------
  const winSymptoms = symptoms.map((s) => ({ ...s, evId: addEv({
    metric: `symptom_${s.type}`, label: s.type.replace('_', ' '), value: s.severity ?? null, unit: s.severity != null ? '/10' : null,
    timestamp: s.ts, day: fmtDate(s.ts), source: 'user', provenance: prov(s.source || 'reported'), confidence: 1,
  }) }));
  const byType = (types) => winSymptoms.filter((s) => types.includes(s.type));
  const daysOf = (list) => new Set(list.map((s) => new Date(s.ts).toDateString())).size;

  // ---------------- Patterns ----------------
  const patterns = [];
  const totalDays = window.length || 3;

  // Nighttime breathing irregularity
  const nights = window.filter((d) => ((d.events?.respPauses || 0) + (d.events?.spo2Dips || 0)) >= 3);
  if (nights.length) {
    const evIds = nights.map((d) => addEv({
      metric: 'night_events', label: 'Nighttime breathing irregularity', value: (d.events.respPauses || 0) + (d.events.spo2Dips || 0), unit: 'events',
      timestamp: d.start, day: fmtDate(d.start), source: 'sensor', provenance: 'MEASURED', confidence: d.aggregates?.resp?.confidence ?? null,
      note: `${d.events.respPauses || 0} breathing pauses and ${d.events.spo2Dips || 0} SpO₂ dips at night`,
    }));
    const prevNights = history.filter((d) => ((d.events?.respPauses || 0) + (d.events?.spo2Dips || 0)) >= 3).length;
    patterns.push({
      pattern_id: 'sleep_resp', category: 'sleep', name: 'Repeated nighttime breathing irregularity',
      status: nights.length >= 2 ? 'repeated' : 'observed',
      recurrence: { days_observed: nights.length, total_days: totalDays, occurrences: nights.reduce((a, d) => a + d.events.respPauses + d.events.spo2Dips, 0) },
      history_note: prevNights ? `${prevNights} similar night${prevNights > 1 ? 's' : ''} earlier in your monitoring history.` : 'No similar nights earlier in your monitoring history.',
      confidence: round(Math.min(0.95, 0.55 + 0.15 * nights.length + (avg(nights.map((d) => d.completeness)) ?? 0) * 0.15), 2),
      evidence_ids: evIds,
    });
  }

  // Fatigue alongside reduced sleep
  const fatigue = byType(['fatigue']).filter((s) => (s.severity ?? 0) >= 4);
  const sleepLow = cmp.sleep_duration?.deviation != null && cmp.sleep_duration.deviation < -0.3;
  if (fatigue.length) {
    const fd = daysOf(fatigue);
    patterns.push({
      pattern_id: 'fatigue_sleep', category: 'fatigue',
      name: sleepLow ? 'Fatigue increased alongside reduced sleep' : 'Fatigue reported',
      status: fd >= 2 ? 'repeated' : 'observed',
      recurrence: { days_observed: fd, total_days: totalDays, occurrences: fatigue.length },
      max_severity: Math.max(...fatigue.map((s) => s.severity ?? 0)),
      confidence: round(Math.min(0.9, 0.5 + 0.12 * fd + (sleepLow ? 0.1 : 0)), 2),
      evidence_ids: [...fatigue.map((s) => s.evId), ...(sleepLow ? cmp.sleep_duration.evidence_ids : [])],
    });
  }

  // Activity vs personal baseline
  if (cmp.activity?.deviation_percent != null && cmp.activity.deviation_percent <= -20) {
    patterns.push({
      pattern_id: 'activity_drop', category: 'activity', name: 'Activity decreased compared with your baseline',
      status: 'observed', change_percent: Math.round(cmp.activity.deviation_percent),
      recurrence: { days_observed: cmp.activity.days_with_data, total_days: totalDays },
      confidence: round(Math.min(0.9, 0.5 + 0.1 * cmp.activity.days_with_data), 2),
      evidence_ids: cmp.activity.evidence_ids,
    });
  }

  // Resting heart rate vs history
  if (cmp.resting_hr?.status === 'changed' && cmp.resting_hr.direction === 'increased') {
    patterns.push({
      pattern_id: 'resting_hr', category: 'physiology', name: 'Resting heart rate higher than your usual',
      status: 'observed', change: cmp.resting_hr.deviation,
      recurrence: { days_observed: cmp.resting_hr.days_with_data, total_days: totalDays },
      confidence: 0.7, evidence_ids: cmp.resting_hr.evidence_ids,
    });
  }

  // Pain
  const pain = byType(['pain', 'cramp', 'cramps']).filter((s) => (s.severity ?? 0) >= 5);
  if (pain.length) {
    const pd = daysOf(pain);
    patterns.push({
      pattern_id: 'pain', category: 'symptoms', name: pd >= 2 ? 'Pain reported on several days' : 'Pain reported',
      status: pd >= 2 ? 'repeated' : 'observed',
      recurrence: { days_observed: pd, total_days: totalDays, occurrences: pain.length },
      max_severity: Math.max(...pain.map((s) => s.severity ?? 0)),
      confidence: round(Math.min(0.9, 0.55 + 0.12 * pd), 2), evidence_ids: pain.map((s) => s.evId),
    });
  }

  // Cycle-associated pattern (only when cycle tracking is enabled)
  if (menstrual?.pattern?.detected) {
    const evIds = menstrual.pattern.perCycle.filter((c) => c.matched).map((c) => addEv({
      metric: 'cycle_days_1_3', label: 'Cycle days 1–3', value: c.pain, unit: '/10 max pain', timestamp: c.startDate, day: fmtDate(c.startDate),
      source: 'user', provenance: 'HISTORICAL', confidence: 1,
      note: `Pain ${c.pain}/10, fatigue ${c.fatigue}/10${c.activityDropPct != null ? `, activity −${Math.max(0, c.activityDropPct)}%` : ''}`,
    }));
    patterns.push({
      pattern_id: 'cycle_pattern', category: 'cycle', name: 'Recurring cycle-associated symptom pattern',
      status: 'repeated', recurrence: { cycles_observed: menstrual.pattern.cyclesMatched, cycles_examined: menstrual.pattern.cyclesExamined },
      confidence: round(Math.min(0.92, 0.5 + 0.12 * menstrual.pattern.cyclesMatched), 2), evidence_ids: evIds,
    });
  }

  // ---------------- What happened (day by day) ----------------
  const dayEvents = window.map((d, i) => {
    const dayStart = new Date(d.start).getTime();
    const inDay = (t) => { const x = new Date(t).getTime(); return x >= dayStart && x < dayStart + DAY; };
    const items = [];
    const bSleep = cmp.sleep_duration?.baseline;
    if (d.sleep?.hours != null) {
      const diff = bSleep != null ? d.sleep.hours - bSleep : null;
      items.push({ kind: 'sleep', title: diff != null && diff < -0.4 ? 'Sleep decreased' : 'Sleep recorded', detail: `Sleep: ${hm(d.sleep.hours)}${diff != null ? ` (${diff >= 0 ? '+' : '−'}${hm(Math.abs(diff))} vs your usual)` : ''}`, provenance: prov(d.sleep.source), confidence: d.sleep.confidence });
    }
    const ev = (d.events?.respPauses || 0) + (d.events?.spo2Dips || 0);
    if (ev >= 3) items.push({ kind: 'night', title: 'Nighttime breathing irregularity detected', detail: `${d.events.respPauses} breathing pauses, ${d.events.spo2Dips} SpO₂ dips`, provenance: 'MEASURED' });
    if ((d.events?.spo2Dips || 0) >= 3) items.push({ kind: 'spo2', title: 'SpO₂ fluctuation observed', detail: `Lowest SpO₂ ${d.aggregates?.spo2?.min ?? '—'}%`, provenance: 'MEASURED' });
    for (const s of winSymptoms.filter((x) => inDay(x.ts))) {
      items.push({ kind: 'symptom', title: `${cap(s.type.replace('_', ' '))} reported`, detail: s.severity != null ? `Severity: ${s.severity}/10` : null, provenance: prov(s.source || 'reported') });
    }
    if (d.activity?.steps != null && cmp.activity?.baseline) {
      const pct = Math.round(((d.activity.steps - cmp.activity.baseline) / cmp.activity.baseline) * 100);
      if (pct <= -20) items.push({ kind: 'activity', title: 'Activity lower than usual', detail: `${d.activity.steps.toLocaleString('en-US')} steps (${pct}%)`, provenance: prov(d.activity.source) });
    }
    // System events that matter to the story (priority changes are shown in "Next 24-hour monitoring focus")
    for (const t of timeline.filter((x) => inDay(x.ts) && ['question', 'answer', 'triage'].includes(x.kind))) {
      const title = t.kind === 'question' ? 'Adaptive question triggered' : t.kind === 'answer' ? 'You answered a question' : t.title;
      items.push({ kind: t.kind, title, detail: t.kind === 'triage' ? null : t.detail, provenance: t.kind === 'answer' ? 'USER_REPORTED' : 'SYSTEM' });
    }
    return { day: i + 1, date: d.start, label: fmtDate(d.start), completeness: d.completeness ?? 0, items };
  });
  if (nights.length >= 2) {
    const last = dayEvents.find((x) => new Date(x.date).getTime() === new Date(nights.at(-1).start).getTime());
    last?.items.push({ kind: 'pattern', title: 'Pattern repeated', detail: `Breathing irregularity on ${nights.length} of ${totalDays} nights`, provenance: 'SYSTEM' });
  }

  // ---------------- Triage (engine-controlled) + why ----------------
  const level = LEVELS.includes(triage?.level) ? triage.level : 'LOW';
  const changedRows = baselineComparison.filter((r) => r.status === 'changed' || r.status === 'slight_change');
  const repeated = patterns.filter((p) => p.status === 'repeated');
  const maxSeverity = Math.max(0, ...winSymptoms.map((s) => s.severity ?? 0));
  const confidence = round(Math.min(0.97, (triage?.confidence ?? 0.6) * (0.55 + 0.45 * completeness) + (baselineReady ? 0.05 : -0.1)), 2);
  const why = [
    { factor: 'Deviation from personal baseline', value: changedRows.length ? changedRows.map((r) => `${r.label} ${r.direction} ${fmtDelta(r)}`).join('; ') : baselineReady ? 'No meaningful deviation' : 'Baseline still developing' },
    { factor: 'Pattern recurrence', value: repeated.length ? repeated.map((p) => `${p.name} (${recText(p)})`).join('; ') : 'No repeated pattern in this period' },
    { factor: 'Symptom severity', value: winSymptoms.length ? `Highest reported severity ${maxSeverity}/10 across ${winSymptoms.length} entr${winSymptoms.length === 1 ? 'y' : 'ies'}` : 'No symptoms reported' },
    { factor: 'Signal correlation', value: correlationText(patterns) },
    { factor: 'Data confidence', value: `${Math.round(confidence * 100)}% (completeness ${Math.round(completeness * 100)}%)` },
  ];

  // ---------------- Observed / interpreted / unknown ----------------
  const observed = [
    ...baselineComparison.filter((r) => r.recent != null).map((r) => `${r.label}: ${fmtVal(r.recent, r.unit)} on average over ${r.days_with_data} day${r.days_with_data > 1 ? 's' : ''}`),
    ...nights.map((d) => `${d.events.respPauses} breathing pauses and ${d.events.spo2Dips} SpO₂ dips on the night of ${fmtDate(d.start)}`),
    ...(winSymptoms.length ? [`${winSymptoms.length} symptom entr${winSymptoms.length === 1 ? 'y' : 'ies'} reported by you`] : []),
  ];
  const interpreted = patterns.map((p) => `${p.name} (${Math.round(p.confidence * 100)}% confidence)`);
  const missingFields = [...new Set(window.flatMap((d) => (d.missing || []).filter((m) => m.resolution !== 'estimated' && m.resolution !== 'resolved').map((m) => m.field)))];
  const unknown = [
    'The underlying medical cause of these changes — HealthSense identifies patterns, it does not diagnose.',
    ...(missingFields.length ? [`Missing or incomplete data: ${missingFields.join(', ')}.`] : []),
    ...(!baselineReady ? ['Your personal baseline is still developing, so comparisons are less reliable.'] : []),
    ...questions.filter((q) => q.status === 'open').map((q) => `Unanswered: “${q.text}”`),
  ];

  // ---------------- Contributing factors (no causation) ----------------
  const contributing = [];
  if (sleepLow) contributing.push({ factor: 'reduced_sleep', label: 'Reduced sleep', detail: `${hm(Math.abs(cmp.sleep_duration.deviation))} less than your usual`, confidence: 0.8, evidence_ids: cmp.sleep_duration.evidence_ids });
  if (fatigue.length) contributing.push({ factor: 'fatigue', label: 'Increased fatigue', detail: `Reported on ${daysOf(fatigue)} day(s)`, confidence: 0.85, evidence_ids: fatigue.map((s) => s.evId) });
  const act = patterns.find((p) => p.pattern_id === 'activity_drop');
  if (act) contributing.push({ factor: 'reduced_activity', label: 'Reduced activity', detail: `${act.change_percent}% vs your usual`, confidence: act.confidence, evidence_ids: act.evidence_ids });
  if (pain.length) contributing.push({ factor: 'pain', label: 'Reported pain', detail: `Up to ${Math.max(...pain.map((s) => s.severity))}/10`, confidence: 0.9, evidence_ids: pain.map((s) => s.evId) });
  if (nights.length) contributing.push({ factor: 'night_disturbance', label: 'Repeated nighttime disturbance', detail: `${nights.length} of ${totalDays} nights`, confidence: patterns[0]?.confidence ?? 0.7, evidence_ids: patterns.find((p) => p.pattern_id === 'sleep_resp')?.evidence_ids || [] });
  if (menstrual?.context?.tracking && menstrual.context.cycleDay) contributing.push({ factor: 'cycle_context', label: 'Menstrual cycle context', detail: `Cycle day ${menstrual.context.cycleDay}${menstrual.context.period?.status === 'on_period' ? ' (period)' : ''}`, confidence: menstrual.context.dayConfidence, evidence_ids: [] });

  // ---------------- Cycle context (only if enabled) ----------------
  const mc = menstrual?.context;
  const cycleContext = mc?.tracking ? {
    enabled: true,
    status: mc.status,
    cycle_day: mc.cycleDay ?? null,
    data_source: 'AI_ESTIMATED',
    confidence: mc.confidence ?? null,
    cycle_started: mc.lastPeriodStart ?? null,
    typical_cycle_length: mc.length?.days ?? null,
    typical_cycle_length_source: mc.length?.source ? prov(mc.length.source) : null,
    period_status: mc.period?.status ?? null,
    period_label: mc.period?.label ?? null,
    period_source: mc.period?.source ? prov(mc.period.source) : null,
    phase: mc.phase ? { name: mc.phase.name, label: mc.phase.label, source: 'AI_ESTIMATED', confidence: mc.phase.confidence } : null,
    cycles_analyzed: mc.baseline?.cycles_used ?? 0,
    recent_cycles: (menstrual.pattern?.perCycle || []).map((c) => ({ start: c.startDate, pain: c.pain, fatigue: c.fatigue, activity_drop_percent: c.activityDropPct, sleep_hours: c.sleepHours, matched: c.matched })),
    pattern: menstrual.pattern?.detected ? { summary: menstrual.pattern.summary, statement: menstrual.pattern.statement, cycles_matched: menstrual.pattern.cyclesMatched } : null,
  } : null;

  // ---------------- Actions / professional evaluation / next focus ----------------
  const openQs = questions.filter((q) => q.status === 'open');
  const recommendedActions = openQs.length
    ? [{ type: 'question', priority: 'high', text: 'Continue monitoring and complete the requested follow-up questions.', reason: 'Additional information is needed to tell whether the recent pattern is persistent.', question_ids: openQs.map((q) => q.id) }]
    : [{ type: 'monitor', priority: 'medium', text: 'Continue monitoring.', reason: patterns.length ? 'HealthSense will keep watching the patterns found in this period.' : 'No pattern needing extra attention was found.' }];

  const evalByLevel = {
    LOW: { recommendation: 'none', headline: 'No persistent pattern requiring escalation was identified from the available data.', text: 'Continue monitoring.' },
    MONITOR: { recommendation: 'monitor', headline: 'A change was observed, but more information is needed.', text: 'Continue monitoring and complete the requested questions.' },
    MODERATE: { recommendation: 'consider', headline: 'A recurring pattern has been observed.', text: 'Consider discussing the pattern with a healthcare professional, particularly if symptoms persist or interfere with normal activities.' },
    HIGH: { recommendation: 'recommend', headline: 'A persistent pattern requiring professional evaluation has been identified.', text: 'Professional evaluation is recommended. This is not a diagnosis.' },
  };
  const professional = {
    level,
    ...evalByLevel[level],
    reason: repeated.length ? `${repeated.map((p) => p.name.toLowerCase()).join(' and ')} across multiple days or cycles.` : patterns.length ? 'A change from your baseline was observed in this period.' : 'No recurring pattern was found.',
    evidence_ids: [...new Set(repeated.flatMap((p) => p.evidence_ids))].slice(0, 12),
    reasons: (triage?.reasons || []).filter((r) => !r.startsWith('Data confidence')),
    not_diagnostic: true,
  };

  const FOCUS = {
    resp: { label: 'Nighttime respiration', reason: 'Repeated breathing irregularities were observed at night.' },
    spo2: { label: 'Blood oxygen (SpO₂)', reason: 'Oxygen dips accompanied some of the nighttime events.' },
    movement: { label: 'Sleep interruptions & movement', reason: 'Night-time movement helps show how often sleep is interrupted.' },
    hr: { label: 'Heart rate', reason: 'Heart rate is compared with your baseline to see if changes persist.' },
    temp: { label: 'Temperature', reason: 'Temperature is tracked alongside symptoms in their context.' },
    steps: { label: 'Activity', reason: 'Activity changed compared with your usual level.' },
    sleep: { label: 'Sleep duration', reason: 'Sleep was below your usual during this period.' },
    fatigue: { label: 'Morning fatigue', reason: 'Fatigue was reported following disturbed or short sleep.' },
    pain: { label: 'Pain', reason: 'Pain was reported repeatedly.' },
    activity: { label: 'Daily activity', reason: 'Reduced activity was observed.' },
    cycle: { label: 'Cycle context', reason: 'Symptoms are being compared with your cycle pattern.' },
  };
  const focusKeys = [...(priority?.metrics || []), ...(priority?.checkinFocus || [])];
  const nextFocus = [...new Set(focusKeys)].map((k) => ({ metric: k, ...(FOCUS[k] || { label: k, reason: 'Prioritised by the previous assessment.' }) }));

  return {
    assessment_type: '3_day',
    assessment_period: '72_hours',
    period: { start_at: start || window[0]?.start || null, end_at: end || now, duration_days: 3, days_with_data: usableDays.length },
    sufficient,
    insufficient_reason: sufficient ? null : 'Insufficient data for a reliable 3-day assessment.',
    baseline_status: baselineReady ? 'established' : 'developing',
    data_quality: dataQuality({ counts, completeness, confidence }),
    triage_level: level,
    triage_is_prototype: true,
    confidence,
    why,
    day_events: dayEvents,
    baseline_comparison: baselineComparison,
    changes: changedRows.map((r) => ({ metric: r.metric, label: r.label, direction: r.direction, magnitude: r.deviation, deviation_percent: r.deviation_percent, unit: r.unit, evidence_ids: r.evidence_ids })),
    patterns,
    observed, interpreted, unknown,
    contributing_factors: contributing,
    cycle_context: cycleContext,
    recommended_actions: recommendedActions,
    professional_evaluation: professional,
    next_24h_focus: nextFocus,
    adaptive_monitoring: {
      generated_from: 'previous 3-day assessment',
      influenced_by: priority?.influencedBy || [],
      reason: priority?.reason || null,
      night_sampling_sec: priority?.nightBoost ? priority.sampleIntervalSec : null,
      questions_to_ask: openQs.map((q) => ({ question_id: q.id, text: q.text, reason: q.reason })),
    },
    adaptive_questions: openQs,
    evidence,
    engine_version: ENGINE_VERSION,
    generated_at: now,
  };
}

function dataQuality({ counts, completeness, confidence }) {
  const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0) || 1;
  // one decimal so small shares (e.g. a few answers among thousands of sensor readings) stay visible
  const pct = (n) => { const v = ((n || 0) / total) * 100; return v > 0 && v < 1 ? round(v, 1) : round(v, 0); };
  return {
    completeness, confidence,
    measured_points: counts.measured || 0,
    user_reported_points: counts.user_reported || 0,
    historical_points: counts.historical || 0,
    estimated_points: counts.estimated || 0,
    percentages: { measured: pct(counts.measured), user_reported: pct(counts.user_reported), historical: pct(counts.historical), estimated: pct(counts.estimated) },
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function hm(hours) {
  if (hours == null) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 60 ? `${h + 1}h 0m` : `${h}h ${m}m`;
}
const fmtVal = (v, unit) => (unit === 'hours' ? hm(v) : unit === 'steps' ? `${Math.round(v).toLocaleString('en-US')} steps` : `${v} ${unit}`);
function fmtDelta(r) {
  if (r.unit === 'hours') return `${hm(Math.abs(r.deviation))}`;
  if (r.unit === 'steps') return `${Math.round(Math.abs(r.deviation_percent))}%`;
  return `${Math.abs(r.deviation)} ${r.unit}`;
}
const recText = (p) => (p.recurrence.cycles_observed ? `${p.recurrence.cycles_observed} cycles` : `${p.recurrence.days_observed} of ${p.recurrence.total_days} days`);
function correlationText(patterns) {
  const cats = new Set(patterns.map((p) => p.category));
  if (cats.has('sleep') && cats.has('fatigue')) return 'Night-time disturbance, sleep and fatigue changed together';
  if (cats.has('cycle') && (cats.has('activity') || cats.has('symptoms'))) return 'Symptoms and activity changed together within your cycle';
  if (cats.size >= 2) return 'Several health signals changed together';
  return cats.size ? 'A single signal changed' : 'No related changes';
}
