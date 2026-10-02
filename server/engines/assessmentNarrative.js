// 3-Day Assessment — Layer 2: explanation. Turns the structured assessment (Layer 1) into calm, plain language.
// Deterministic and rule-based: it can only restate findings that are present in the structured input,
// so it cannot invent measurements, symptoms or diagnoses. Returns null if anything goes wrong — the page
// then shows the structured assessment without the narrative.
import { hm } from './assessmentEngine.js';

const HEADLINE = {
  LOW: 'No significant change detected',
  MONITOR: 'Some changes detected',
  MODERATE: 'Moderate change detected',
  HIGH: 'Persistent change detected',
};

const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

export function narrate(a) {
  try {
    if (!a.sufficient) {
      return {
        headline: 'Not enough data yet',
        summary: 'There is not enough recent information for a reliable 3-day assessment. Keep wearing your watch and complete your daily check-ins — the assessment will appear once more data is available.',
        reasoning: [],
        pattern_descriptions: {},
      };
    }
    const c = Object.fromEntries(a.baseline_comparison.map((r) => [r.metric, r]));
    const clauses = [];
    if (c.sleep_duration?.status === 'changed' || c.sleep_duration?.status === 'slight_change') {
      clauses.push(`your sleep was ${c.sleep_duration.direction === 'decreased' ? 'below' : 'above'} your recent personal baseline`);
    }
    const p = Object.fromEntries(a.patterns.map((x) => [x.pattern_id, x]));
    if (p.fatigue_sleep) clauses.push('fatigue increased');
    if (p.sleep_resp) clauses.push(`nighttime breathing irregularities appeared on ${p.sleep_resp.recurrence.days_observed} night${p.sleep_resp.recurrence.days_observed > 1 ? 's' : ''}`);
    if (p.activity_drop) clauses.push(`your activity was ${Math.round(Math.abs(p.activity_drop.change_percent))}% lower than usual`);
    if (p.pain) clauses.push(`pain was reported${p.pain.recurrence.days_observed > 1 ? ` on ${p.pain.recurrence.days_observed} days` : ''}`);
    if (p.resting_hr) clauses.push('your resting heart rate was higher than usual');

    let summary;
    if (!clauses.length) {
      summary = a.baseline_status === 'developing'
        ? 'Over the last three days your readings were recorded, but your personal baseline is still developing, so changes cannot yet be judged reliably.'
        : 'Over the last three days your readings stayed close to your personal baseline and no repeated pattern was found.';
    } else {
      summary = `During the last three days, ${list(clauses)}.`;
      const repeated = a.patterns.filter((x) => x.status === 'repeated');
      if (repeated.length) summary += ' The pattern is worth monitoring because similar changes have been observed repeatedly.';
      else summary += ' These changes were observed once, so more information is needed before they can be called a pattern.';
    }
    if (p.cycle_pattern) summary += ` ${a.cycle_context.pattern?.summary || ''}`.trimEnd();

    const pattern_descriptions = {};
    for (const x of a.patterns) {
      const r = x.recurrence;
      pattern_descriptions[x.pattern_id] = r.cycles_observed
        ? `Seen during cycle days 1–3 in ${r.cycles_observed} of your recent cycles.`
        : `Seen on ${r.days_observed} of ${r.total_days} days${x.change_percent != null ? ` (${x.change_percent}% vs your usual)` : ''}.`;
    }

    const reasoning = [];
    if (c.sleep_duration?.deviation != null && Math.abs(c.sleep_duration.deviation) >= 0.25) reasoning.push(`Sleep ${c.sleep_duration.deviation < 0 ? 'decreased' : 'increased'} ${hm(Math.abs(c.sleep_duration.deviation))} from your personal baseline.`);
    if (p.sleep_resp) reasoning.push(`Breathing irregularities occurred on ${p.sleep_resp.recurrence.days_observed} of ${p.sleep_resp.recurrence.total_days} nights.`);
    if (p.fatigue_sleep) reasoning.push(`Fatigue was reported on ${p.fatigue_sleep.recurrence.days_observed} day${p.fatigue_sleep.recurrence.days_observed > 1 ? 's' : ''}.`);
    if (p.activity_drop) reasoning.push(`Activity decreased ${Math.round(Math.abs(p.activity_drop.change_percent))}%.`);
    if (p.pain) reasoning.push(`Pain up to ${p.pain.max_severity}/10 was reported.`);
    if (p.cycle_pattern) reasoning.push(`A similar symptom pattern appeared in ${p.cycle_pattern.recurrence.cycles_observed} recent menstrual cycles.`);
    reasoning.push(`Overall data confidence was ${Math.round(a.confidence * 100)}%.`);

    return {
      headline: HEADLINE[a.triage_level] || HEADLINE.LOW,
      summary,
      reasoning,
      pattern_descriptions,
      why_it_matters: a.patterns.some((x) => x.status === 'repeated')
        ? 'The recent pattern differs from your personal baseline and has occurred repeatedly. Repeated changes are more informative than a single isolated reading, but the available data cannot determine the underlying medical cause.'
        : 'Single changes are common and often have everyday explanations. HealthSense keeps watching to see whether they repeat; the available data cannot determine any underlying medical cause.',
    };
  } catch {
    return null;
  }
}
