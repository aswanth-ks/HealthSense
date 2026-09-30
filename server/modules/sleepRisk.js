// Sleep-related risk module (spec §27-G1). Pure function.
// Combines respiration, SpO2, heart rate, movement and sleep with user-reported information to detect
// REPEATED night-time patterns associated with increased sleep-apnea risk. This is risk information, not a diagnosis.
import { APNEA_EVENT_NIGHT } from '../engines/questionEngine.js';

const yes = (v) => v === true || v === 'yes' || v === 'Yes';

/**
 * cycles: recent cycles newest first [{ start, events, sleep, completeness, aggregates }]
 * symptoms: recent symptom logs
 * answers: { [questionCode]: answer } (most recent answer per code)
 * baseline: { metrics: { sleep: { mean } } }
 */
export function assessSleepRisk({ cycles, symptoms = [], answers = {}, baseline }) {
  const nights = cycles.slice(0, 7).filter((c) => (c.events?.nightSamples || 0) > 0);
  const disturbed = nights.filter((c) => (c.events.spo2Dips || 0) + (c.events.respPauses || 0) >= APNEA_EVENT_NIGHT);
  const respPauses = disturbed.reduce((a, c) => a + (c.events.respPauses || 0), 0);
  const spo2Dips = disturbed.reduce((a, c) => a + (c.events.spo2Dips || 0), 0);

  const evidence = [];
  let score = 0;

  if (disturbed.length) {
    const w = disturbed.length >= 4 ? 30 : disturbed.length === 3 ? 24 : disturbed.length === 2 ? 16 : 6;
    score += w;
    if (respPauses) evidence.push({ code: 'resp_abnormal', text: `${respPauses} repeated nighttime respiratory abnormalities`, weight: Math.round(w * 0.5) });
    if (spo2Dips) evidence.push({ code: 'spo2_dips', text: `${spo2Dips} associated SpO₂ deviations`, weight: Math.round(w * 0.5) });
    evidence.push({ code: 'nights', text: `Pattern observed across ${disturbed.length} night${disturbed.length > 1 ? 's' : ''}`, weight: 0 });
    // Severity of the dips
    const minSpo2 = Math.min(...disturbed.map((c) => c.aggregates?.spo2?.min ?? 100));
    if (minSpo2 <= 89) {
      score += 8;
      evidence.push({ code: 'spo2_low', text: `Lowest night-time SpO₂ ${minSpo2}%`, weight: 8 });
    }
  }

  // Short sleep vs personal baseline
  const sleeps = cycles.slice(0, 3).map((c) => c.sleep?.hours).filter((h) => h != null);
  if (sleeps.length) {
    const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
    const base = baseline?.metrics?.sleep?.mean;
    if ((base && avg < base - 1) || avg < 6) {
      score += 6;
      evidence.push({ code: 'short_sleep', text: `Average sleep ${avg.toFixed(1)} h${base ? ` (your usual ${base.toFixed(1)} h)` : ''}`, weight: 6 });
    }
  }

  // User-reported context (only meaningful alongside the measured pattern)
  const wokeSudden = yes(answers['sleep.wake_sudden']) || symptoms.some((s) => s.type === 'wake_sudden');
  if (wokeSudden && disturbed.length) {
    score += 12;
    evidence.push({ code: 'wake_sudden', text: 'User reported waking suddenly during sleep', weight: 12 });
  }
  const fatigueAnswer = Number(answers['sleep.daytime_fatigue']);
  const fatigueLogs = symptoms.filter((s) => s.type === 'fatigue').map((s) => s.severity);
  const fatigue = Math.max(Number.isFinite(fatigueAnswer) ? fatigueAnswer : 0, ...fatigueLogs, 0);
  if (fatigue >= 6 && disturbed.length) {
    score += 12;
    evidence.push({ code: 'fatigue', text: 'User reported daytime fatigue', weight: 12 });
  }
  if (yes(answers['sleep.snoring']) && disturbed.length) {
    score += 10;
    evidence.push({ code: 'snoring', text: 'Loud snoring or witnessed breathing pauses reported', weight: 10 });
  }

  // Confidence: how complete the underlying nights were + whether key context was provided
  const completeness = nights.length ? nights.reduce((a, c) => a + (c.completeness ?? 0), 0) / nights.length : 0;
  const context = ['sleep.wake_sudden', 'sleep.daytime_fatigue'].filter((k) => answers[k] !== undefined).length / 2;
  const confidence = +(Math.min(0.97, completeness * 0.8 + context * 0.15 + (disturbed.length >= 3 ? 0.05 : 0))).toFixed(2);

  return {
    module: 'sleepRisk',
    title: 'Sleep-related risk',
    score: Math.min(100, score),
    confidence,
    evidence,
    pattern: { nightsObserved: nights.length, disturbedNights: disturbed.length, respPauses, spo2Dips },
    active: disturbed.length >= 2,
  };
}
