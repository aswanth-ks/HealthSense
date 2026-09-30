import api from './api.js';
import { isDemo } from './healthService.js';

const d = (days, h = 0) => { const x = new Date(); x.setDate(x.getDate() - days); x.setHours(h, 0, 0, 0); return x.toISOString(); };

// Demo data mirrors the hackathon scenario (spec §27-J / §28).
const DEMO_TRIAGE = {
  current: {
    level: 'MODERATE', score: 56, confidence: 0.87, module: 'sleepRisk',
    reasons: [
      '5 repeated nighttime respiratory abnormalities', '3 associated SpO₂ deviations', 'Pattern observed across 4 nights',
      'User reported daytime fatigue', 'Data confidence: 87%',
    ],
    changed: { from: 'MONITOR', to: 'MODERATE', at: d(0, 9) },
  },
  disclaimer: 'This is risk/triage information to support a conversation with a clinician. It is not a diagnosis.',
  modules: [
    { module: 'sleepRisk', title: 'Sleep-related risk', score: 56, confidence: 0.87, active: true, pattern: { nightsObserved: 7, disturbedNights: 4, respPauses: 5, spo2Dips: 3 },
      evidence: [{ text: '5 repeated nighttime respiratory abnormalities' }, { text: '3 associated SpO₂ deviations' }, { text: 'Pattern observed across 4 nights' }, { text: 'User reported waking suddenly during sleep' }, { text: 'User reported daytime fatigue' }] },
    { module: 'endoSymptoms', title: 'Symptom pattern (endometriosis-associated)', score: 0, confidence: 0, active: false, pattern: { painDays: 0, cycleTracking: false }, evidence: [] },
  ],
  deviations: [],
  history: [
    { level: 'MODERATE', prevLevel: 'MONITOR', ts: d(0, 9) },
    { level: 'MONITOR', prevLevel: 'LOW', ts: d(2, 8) },
    { level: 'LOW', prevLevel: null, ts: d(7, 8) },
  ],
  loop: {
    previousCycle: {
      index: 6, start: d(1), completeness: 0.96,
      findings: [{ text: '3 respiratory pauses during the night' }, { text: '2 SpO₂ dips below 93%' }],
      learned: { metrics: ['resp', 'spo2', 'hr', 'movement'], nightBoost: true, sampleIntervalSec: 2, checkinFocus: ['sleep', 'fatigue'], reason: 'Repeated night-time respiratory/SpO₂ deviations (4 nights) — next cycle prioritises respiration, oxygen and sleep data with faster night-time sampling.' },
    },
    currentCycle: { index: 7, start: d(0), completeness: 0.42, applied: { metrics: ['resp', 'spo2', 'hr', 'movement'], nightBoost: true, sampleIntervalSec: 2, checkinFocus: ['sleep', 'fatigue'] } },
    next: { metrics: ['resp', 'spo2', 'hr', 'movement'], nightBoost: true, sampleIntervalSec: 2, checkinFocus: ['sleep', 'fatigue'], reason: 'Repeated night-time respiratory/SpO₂ deviations (4 nights) — next cycle prioritises respiration, oxygen and sleep data with faster night-time sampling.' },
  },
};

const DEMO_TIMELINE = [
  { id: 't8', ts: d(0, 9), kind: 'priority', title: 'Next monitoring cycle re-prioritised', detail: 'Respiration, oxygen and sleep data with faster night-time sampling.' },
  { id: 't7', ts: d(0, 9), kind: 'triage', title: 'Triage level increased: MONITOR → MODERATE', detail: '5 respiratory abnormalities · 3 SpO₂ deviations · 4 nights · daytime fatigue' },
  { id: 't6', ts: d(1, 8), kind: 'answer', title: 'User confirms daytime fatigue', detail: 'How tired have you felt during the day this week? → 7/10' },
  { id: 't5', ts: d(2, 8), kind: 'question', title: 'Targeted question generated', detail: 'You have experienced repeated nighttime disturbances. Did you wake suddenly during sleep?' },
  { id: 't4', ts: d(3, 4), kind: 'deviation', title: 'Repeated respiratory deviation', detail: 'Pattern observed across 3 nights — deviation from personal baseline.' },
  { id: 't3', ts: d(5, 4), kind: 'deviation', title: 'Sleep disturbance detected', detail: '2 respiratory pauses and 2 SpO₂ dips during the night.' },
  { id: 't2', ts: d(7, 8), kind: 'baseline', title: 'Personal baseline established', detail: 'Learned from 3 days of monitoring.' },
  { id: 't1', ts: d(10, 8), kind: 'device', title: 'Monitoring started', detail: 'HealthSense Watch connected.' },
];

export async function getTriage() {
  if (isDemo()) return DEMO_TRIAGE;
  const { data } = await api.get('/me/triage');
  return data;
}

export async function getTimeline(limit = 60) {
  if (isDemo()) return DEMO_TIMELINE;
  const { data } = await api.get('/me/timeline', { params: { limit } });
  return data;
}
