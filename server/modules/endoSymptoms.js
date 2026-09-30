// Endometriosis-associated symptom module (spec §27-G2). Pure function.
// Combines pain/cramp severity, activity, sleep, fatigue, cycle information and physiological trends to detect
// RECURRING symptom patterns that may warrant clinical evaluation. Not a diagnosis.

const DAY = 24 * 3600_000;
const yes = (v) => v === true || v === 'yes' || v === 'Yes';
const dayKey = (d) => new Date(d).toDateString();

/**
 * symptoms: logs from the last ~60 days
 * cycles: recent cycles (for sleep/activity on pain days)
 * user: { cycle: { tracking, lastPeriodStart, avgLengthDays } }
 * answers: { [code]: answer }
 */
export function assessEndoSymptoms({ symptoms = [], cycles = [], user = {}, answers = {} }) {
  const strong = symptoms.filter((s) => ['pain', 'cramp'].includes(s.type) && s.severity >= 6);
  const painDays = [...new Set(strong.map((s) => dayKey(s.ts)))];
  const evidence = [];
  let score = 0;

  if (painDays.length) {
    const maxSev = Math.max(...strong.map((s) => s.severity));
    const w = painDays.length >= 5 ? 26 : painDays.length >= 3 ? 18 : painDays.length === 2 ? 10 : 4;
    score += w;
    evidence.push({ code: 'pain_days', text: `Strong pain or cramps (≥6/10) reported on ${painDays.length} day${painDays.length > 1 ? 's' : ''}, up to ${maxSev}/10`, weight: w });
  }

  // Recurrence around menstruation
  const c = user.cycle || {};
  if (c.lastPeriodStart && painDays.length >= 2) {
    const len = c.avgLengthDays || 28;
    const phase = (d) => {
      const diff = Math.floor((new Date(d) - new Date(c.lastPeriodStart)) / DAY);
      return ((diff % len) + len) % len; // 0 = period day 1
    };
    const perimenstrual = painDays.filter((d) => { const p = phase(d); return p <= 4 || p >= len - 3; }).length;
    if (perimenstrual / painDays.length >= 0.6) {
      score += 12;
      evidence.push({ code: 'cyclic', text: `${perimenstrual} of ${painDays.length} pain days fall around menstruation`, weight: 12 });
    }
  }

  // Impact on activity and sleep on pain days vs other days
  const byDay = new Map(cycles.map((cy) => [dayKey(cy.start), cy]));
  const painCycles = painDays.map((d) => byDay.get(d)).filter(Boolean);
  const otherCycles = cycles.filter((cy) => !painDays.includes(dayKey(cy.start)) && cy.status === 'closed');
  const avg = (arr, f) => { const v = arr.map(f).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const stepsPain = avg(painCycles, (x) => x.activity?.steps);
  const stepsOther = avg(otherCycles, (x) => x.activity?.steps);
  if (stepsPain != null && stepsOther && stepsPain < stepsOther * 0.75) {
    score += 8;
    evidence.push({ code: 'activity_drop', text: `Activity ${Math.round((1 - stepsPain / stepsOther) * 100)}% lower on pain days`, weight: 8 });
  }
  const sleepPain = avg(painCycles, (x) => x.sleep?.hours);
  const sleepOther = avg(otherCycles, (x) => x.sleep?.hours);
  if (sleepPain != null && sleepOther && sleepPain < sleepOther - 0.7) {
    score += 6;
    evidence.push({ code: 'sleep_drop', text: `Sleep ${(sleepOther - sleepPain).toFixed(1)} h shorter on pain days`, weight: 6 });
  }

  const fatigue = symptoms.filter((s) => s.type === 'fatigue' && s.severity >= 6);
  if (fatigue.length >= 2 && painDays.length) {
    score += 6;
    evidence.push({ code: 'fatigue', text: `Fatigue reported on ${fatigue.length} days`, weight: 6 });
  }
  if (yes(answers['endo.activity_impact'])) {
    score += 10;
    evidence.push({ code: 'impact', text: 'Pain stopped usual daily activities', weight: 10 });
  }

  // Confidence: reported symptoms are high-quality but sparse; more days + cycle info → more confidence
  const confidence = +Math.min(0.95, 0.35 + 0.08 * painDays.length + (c.lastPeriodStart ? 0.15 : 0) + (painCycles.length ? 0.1 : 0)).toFixed(2);

  return {
    module: 'endoSymptoms',
    title: 'Symptom pattern (endometriosis-associated)',
    score: Math.min(100, score),
    confidence: painDays.length ? confidence : 0,
    evidence,
    pattern: { painDays: painDays.length, cycleTracking: !!c.lastPeriodStart },
    active: painDays.length >= 2,
  };
}
