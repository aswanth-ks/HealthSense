// Sample 3-day assessment for "Continue with demo data" (no account). Clearly marked as sample data.
const DAY = 86400000;
const d0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function sampleAssessment() {
  const t = d0();
  const day = (n) => new Date(t - n * DAY).toISOString();
  const label = (n) => new Date(t - n * DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return {
    sample: true,
    assessment_id: 'sample',
    period: { start_at: day(2), end_at: new Date().toISOString(), duration_days: 3, days_with_data: 3 },
    sufficient: true,
    baseline_status: 'established',
    triage_level: 'MODERATE',
    confidence: 0.86,
    data_quality: { completeness: 0.91, confidence: 0.86, measured_points: 2160, user_reported_points: 6, historical_points: 12, estimated_points: 3, percentages: { measured: 99, user_reported: 0.3, historical: 0.5, estimated: 0.1 } },
    why: [
      { factor: 'Deviation from personal baseline', value: 'Sleep decreased 38m; Activity decreased 24%' },
      { factor: 'Pattern recurrence', value: 'Repeated nighttime breathing irregularity (2 of 3 days)' },
      { factor: 'Symptom severity', value: 'Highest reported severity 6/10 across 2 entries' },
      { factor: 'Signal correlation', value: 'Night-time disturbance, sleep and fatigue changed together' },
      { factor: 'Data confidence', value: '86% (completeness 91%)' },
    ],
    day_events: [
      { day: 1, date: day(2), label: label(2), completeness: 0.92, items: [{ kind: 'sleep', title: 'Sleep decreased', detail: 'Sleep: 6h 28m (−44m vs your usual)', provenance: 'USER_REPORTED' }, { kind: 'symptom', title: 'Fatigue reported', detail: 'Severity: 5/10', provenance: 'USER_REPORTED' }] },
      { day: 2, date: day(1), label: label(1), completeness: 0.93, items: [{ kind: 'night', title: 'Nighttime breathing irregularity detected', detail: '5 breathing pauses, 3 SpO₂ dips', provenance: 'MEASURED' }, { kind: 'spo2', title: 'SpO₂ fluctuation observed', detail: 'Lowest SpO₂ 91%', provenance: 'MEASURED' }] },
      { day: 3, date: day(0), label: label(0), completeness: 0.88, items: [{ kind: 'night', title: 'Nighttime breathing irregularity detected', detail: '4 breathing pauses, 4 SpO₂ dips', provenance: 'MEASURED' }, { kind: 'symptom', title: 'Fatigue reported', detail: 'Severity: 6/10', provenance: 'USER_REPORTED' }, { kind: 'pattern', title: 'Pattern repeated', detail: 'Breathing irregularity on 2 of 3 nights', provenance: 'SYSTEM' }, { kind: 'question', title: 'Adaptive question triggered', detail: 'Did you wake suddenly during sleep?', provenance: 'SYSTEM' }] },
    ],
    baseline_comparison: [
      { metric: 'sleep_duration', label: 'Sleep', unit: 'hours', baseline: 7.2, recent: 6.57, deviation: -0.63, deviation_percent: -8.8, direction: 'decreased', status: 'slight_change', days_with_data: 3, evidence_ids: ['ev_1'] },
      { metric: 'activity', label: 'Activity', unit: 'steps', baseline: 6400, recent: 4850, deviation: -1550, deviation_percent: -24.2, direction: 'decreased', status: 'changed', days_with_data: 3, evidence_ids: ['ev_2'] },
      { metric: 'resting_hr', label: 'Resting heart rate', unit: 'BPM', baseline: 62, recent: 63.1, deviation: 1.1, deviation_percent: 1.8, direction: 'stable', status: 'typical', days_with_data: 3, evidence_ids: [] },
      { metric: 'spo2', label: 'Blood oxygen (SpO₂)', unit: '%', baseline: 97.8, recent: 97.1, recent_range: [95, 98], deviation: -0.7, deviation_percent: -0.7, direction: 'stable', status: 'slight_change', days_with_data: 3, evidence_ids: [] },
    ],
    patterns: [
      { pattern_id: 'sleep_resp', category: 'sleep', name: 'Repeated nighttime breathing irregularity', status: 'repeated', recurrence: { days_observed: 2, total_days: 3, occurrences: 16 }, confidence: 0.87, history_note: '3 similar nights earlier in your monitoring history.', evidence_ids: ['ev_3', 'ev_4'] },
      { pattern_id: 'fatigue_sleep', category: 'fatigue', name: 'Fatigue increased alongside reduced sleep', status: 'repeated', recurrence: { days_observed: 2, total_days: 3, occurrences: 2 }, confidence: 0.82, evidence_ids: ['ev_5', 'ev_1'] },
      { pattern_id: 'activity_drop', category: 'activity', name: 'Activity decreased compared with your baseline', status: 'observed', change_percent: -24, recurrence: { days_observed: 3, total_days: 3 }, confidence: 0.8, evidence_ids: ['ev_2'] },
    ],
    observed: ['Sleep: 6h 34m on average over 3 days', 'Activity: 4,850 steps on average over 3 days', '5 breathing pauses and 3 SpO₂ dips on the night of ' + label(1), '2 symptom entries reported by you'],
    interpreted: ['Repeated nighttime breathing irregularity (87% confidence)', 'Fatigue increased alongside reduced sleep (82% confidence)', 'Activity decreased compared with your baseline (80% confidence)'],
    unknown: ['The underlying medical cause of these changes — HealthSense identifies patterns, it does not diagnose.', 'Unanswered: “Did you wake suddenly during sleep?”'],
    contributing_factors: [
      { factor: 'reduced_sleep', label: 'Reduced sleep', detail: '38m less than your usual', confidence: 0.8 },
      { factor: 'fatigue', label: 'Increased fatigue', detail: 'Reported on 2 day(s)', confidence: 0.85 },
      { factor: 'reduced_activity', label: 'Reduced activity', detail: '-24% vs your usual', confidence: 0.8 },
      { factor: 'night_disturbance', label: 'Repeated nighttime disturbance', detail: '2 of 3 nights', confidence: 0.87 },
    ],
    cycle_context: null,
    recommended_actions: [{ type: 'question', priority: 'high', text: 'Continue monitoring and complete the requested follow-up questions.', reason: 'Additional information is needed to tell whether the recent pattern is persistent.' }],
    professional_evaluation: { level: 'MODERATE', recommendation: 'consider', headline: 'A recurring pattern has been observed.', text: 'Consider discussing the pattern with a healthcare professional, particularly if symptoms persist or interfere with normal activities.', reason: 'Repeated nighttime breathing irregularity and fatigue across multiple days.', reasons: ['5 repeated nighttime respiratory abnormalities', '3 associated SpO₂ deviations', 'User reported daytime fatigue'], evidence_ids: ['ev_3', 'ev_4', 'ev_5'], not_diagnostic: true },
    next_24h_focus: [
      { metric: 'resp', label: 'Nighttime respiration', reason: 'Repeated breathing irregularities were observed at night.' },
      { metric: 'spo2', label: 'Blood oxygen (SpO₂)', reason: 'Oxygen dips accompanied some of the nighttime events.' },
      { metric: 'movement', label: 'Sleep interruptions & movement', reason: 'Night-time movement helps show how often sleep is interrupted.' },
      { metric: 'fatigue', label: 'Morning fatigue', reason: 'Fatigue was reported following disturbed or short sleep.' },
    ],
    adaptive_monitoring: { generated_from: 'previous 3-day assessment', influenced_by: ['Night-time breathing/SpO₂ pattern across 2 nights'], night_sampling_sec: 2 },
    adaptive_questions: [],
    evidence: [
      { id: 'ev_1', metric: 'sleep_duration', label: 'Sleep', value: 6.47, unit: 'hours', day: label(2), timestamp: day(2), provenance: 'USER_REPORTED', confidence: 1, source: 'user', baseline: 7.2 },
      { id: 'ev_2', metric: 'activity', label: 'Activity', value: 4850, unit: 'steps', day: label(1), timestamp: day(1), provenance: 'MEASURED', confidence: 0.9, source: 'sensor', baseline: 6400 },
      { id: 'ev_3', metric: 'night_events', label: 'Nighttime breathing irregularity', value: 8, unit: 'events', day: label(1), timestamp: day(1), provenance: 'MEASURED', confidence: 0.87, source: 'sensor', note: '5 breathing pauses and 3 SpO₂ dips at night' },
      { id: 'ev_4', metric: 'night_events', label: 'Nighttime breathing irregularity', value: 8, unit: 'events', day: label(0), timestamp: day(0), provenance: 'MEASURED', confidence: 0.86, source: 'sensor', note: '4 breathing pauses and 4 SpO₂ dips at night' },
      { id: 'ev_5', metric: 'symptom_fatigue', label: 'fatigue', value: 6, unit: '/10', day: label(0), timestamp: day(0), provenance: 'USER_REPORTED', confidence: 1, source: 'user' },
    ],
    narrative: {
      headline: 'Moderate change detected',
      summary: 'During the last three days, your sleep was below your recent personal baseline, fatigue increased and nighttime breathing irregularities appeared on 2 nights. The pattern is worth monitoring because similar changes have been observed repeatedly.',
      reasoning: ['Sleep decreased 38m from your personal baseline.', 'Breathing irregularities occurred on 2 of 3 nights.', 'Fatigue was reported on 2 days.', 'Activity decreased 24%.', 'Overall data confidence was 86%.'],
      pattern_descriptions: { sleep_resp: 'Seen on 2 of 3 days.', fatigue_sleep: 'Seen on 2 of 3 days.', activity_drop: 'Seen on 3 of 3 days (-24% vs your usual).' },
      why_it_matters: 'The recent pattern differs from your personal baseline and has occurred repeatedly. Repeated changes are more informative than a single isolated reading, but the available data cannot determine the underlying medical cause.',
    },
    narrative_available: true,
  };
}
