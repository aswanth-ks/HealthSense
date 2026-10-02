// Explainable triage engine (spec §27-H) + next-cycle priority (spec §27-E closed loop). Pure functions.

export const LEVELS = ['LOW', 'MONITOR', 'MODERATE', 'HIGH'];
export const DISCLAIMER = 'This is risk/triage information to support a conversation with a clinician. It is not a diagnosis.';

const THRESHOLDS = [
  ['HIGH', 60],
  ['MODERATE', 35],
  ['MONITOR', 15],
  ['LOW', 0],
];

/**
 * modules: [ { module, title, score, confidence, evidence[], active } ]
 * deviations: [{ text, weight }] general out-of-baseline findings
 * returns { level, score, module, reasons[], confidence, disclaimer }
 */
export function triage(modules, deviations = []) {
  const devScore = Math.min(20, deviations.reduce((a, d) => a + d.weight, 0));
  const ranked = [...modules].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const score = Math.min(100, (top?.score || 0) + devScore);

  let level = THRESHOLDS.find(([, t]) => score >= t)[0];
  const confidence = top && top.score > 0 ? top.confidence : 0.9; // "all clear" is well supported when data exists

  // Evidence must be well supported before escalating to HIGH
  if (level === 'HIGH' && confidence < 0.7) level = 'MODERATE';

  const reasons = [];
  if (top && top.score > 0) reasons.push(...top.evidence.map((e) => e.text));
  for (const m of ranked.slice(1)) if (m.score >= 15) reasons.push(`${m.title}: ${m.evidence[0]?.text || 'pattern detected'}`);
  reasons.push(...deviations.map((d) => d.text));
  if (!reasons.length) reasons.push('No repeated abnormal patterns detected', 'Readings are within your personal baseline');
  reasons.push(`Data confidence: ${Math.round(confidence * 100)}%`);

  return { level, score, module: top && top.score > 0 ? top.module : 'general', reasons, confidence: +confidence.toFixed(2), disclaimer: DISCLAIMER };
}

export function levelChange(prev, next) {
  if (!prev) return 'initial';
  const d = LEVELS.indexOf(next) - LEVELS.indexOf(prev);
  return d > 0 ? 'increased' : d < 0 ? 'decreased' : 'unchanged';
}

/**
 * What the NEXT monitoring cycle should prioritise, given what this cycle learned.
 * Returned object is sent to the device (GET /api/device/config) and shown in the UI.
 */
export function nextCyclePriority(result, modules) {
  const sleep = modules.find((m) => m.module === 'sleepRisk');
  const endo = modules.find((m) => m.module === 'endoSymptoms');
  const p = { metrics: [], nightBoost: false, sampleIntervalSec: 5, checkinFocus: [], reason: 'No pattern requires extra attention — standard monitoring continues.' };

  if (sleep?.active) {
    p.metrics.push('resp', 'spo2', 'hr', 'movement');
    p.nightBoost = true;
    p.sampleIntervalSec = result.level === 'HIGH' || result.level === 'MODERATE' ? 2 : 3;
    p.checkinFocus.push('sleep', 'fatigue');
    p.reason = `Repeated night-time respiratory/SpO₂ deviations (${sleep.pattern.disturbedNights} nights) — next cycle prioritises respiration, oxygen and sleep data with faster night-time sampling.`;
  }
  if (endo?.active) {
    p.metrics.push('hr', 'temp', 'steps', 'movement');
    p.checkinFocus.push('pain', 'activity', 'sleep', 'cycle', 'fatigue');
    const r = endo.pattern.cyclesMatched >= 2
      ? `Recurring cycle-associated symptom pattern (${endo.pattern.cyclesMatched} cycles) — next cycle prioritises pain, activity, sleep, heart rate and temperature.`
      : `Recurring pain pattern (${endo.pattern.painDays} days) — next cycle prioritises pain, cycle and activity check-ins.`;
    p.reason = sleep?.active ? `${p.reason} ${r}` : r;
  }
  p.metrics = [...new Set(p.metrics)];
  p.checkinFocus = [...new Set(p.checkinFocus)];
  return p;
}
