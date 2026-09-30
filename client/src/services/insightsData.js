// Mock AI insights per period. Replace with GET /api/insights when the backend exists.
const VITALS = [
  {
    key: 'hr', label: 'Heart Rate', unit: 'BPM', value: 79, avg: 76, delta: '+2%', trend: 'up', status: 'Watch',
    range: { min: 40, max: 130, low: 60, high: 100 },
    meaning: 'A little higher than usual, but still comfortably inside the healthy range.',
    series: [74, 76, 75, 78, 77, 80, 79],
  },
  {
    key: 'spo2', label: 'Blood Oxygen', unit: '% SpO₂', value: 98, avg: 98, delta: '0%', trend: 'flat', status: 'Normal',
    range: { min: 85, max: 100, low: 95, high: 100 },
    meaning: 'Your blood is carrying oxygen very well, with no dips detected.',
    series: [97, 98, 98, 97, 98, 98, 98],
  },
  {
    key: 'temp', label: 'Temperature', unit: '°C', value: 36.7, avg: 36.7, delta: '0%', trend: 'flat', status: 'Normal',
    range: { min: 35, max: 39, low: 36.0, high: 37.5 },
    meaning: 'Normal body temperature with no sign of fever.',
    series: [36.5, 36.6, 36.6, 36.7, 36.8, 36.7, 36.7],
  },
  {
    key: 'bp', label: 'Blood Pressure', unit: 'mmHg', value: 120, display: '120 / 80', avg: '119 / 79', delta: '+1%', trend: 'flat', status: 'Normal',
    range: { min: 80, max: 160, low: 90, high: 130 },
    meaning: 'Healthy blood pressure, close to your recent average.',
    series: [118, 119, 121, 120, 119, 121, 120],
  },
];

const PERIODS = {
  Today: { score: 92, readings: 1248, avgLabel: '7-day avg', summary: 'Today looks steady. All four vitals stayed inside their healthy ranges. Your heart rate is running slightly above your usual level — nothing concerning, just something to keep an eye on.' },
  '7D': { score: 90, readings: 8736, avgLabel: '30-day avg', summary: 'A healthy, consistent week. Readings were stable day to day, with heart rate a little higher mid-week before settling back down.' },
  '30D': { score: 91, readings: 37440, avgLabel: '90-day avg', summary: 'Over the past month your vitals have been stable and within range. No unusual patterns or alerts were recorded.' },
};

export const FINDINGS = [
  { type: 'watch', title: 'Heart rate slightly above baseline', text: 'Averaging 79 BPM vs your usual 76 BPM (+2%). Often linked to activity, caffeine or less sleep.' },
  { type: 'good', title: 'Oxygen levels stable all day', text: 'SpO₂ held between 97–99% with no drops below 95%.' },
  { type: 'good', title: 'Blood pressure in the healthy zone', text: 'Readings stayed close to 120/80 mmHg throughout the day.' },
  { type: 'info', title: 'Normal daily temperature rhythm', text: 'Temperature rose slightly in the afternoon and settled overnight, as expected.' },
];

export const PATTERNS = [
  { label: 'Morning', time: '6 AM – 12 PM', hr: 74 },
  { label: 'Afternoon', time: '12 PM – 6 PM', hr: 83 },
  { label: 'Evening', time: '6 PM – 10 PM', hr: 78 },
  { label: 'Night', time: '10 PM – 6 AM', hr: 62 },
];

export const TIPS = [
  { icon: 'droplet', title: 'Stay hydrated', text: 'Drinking enough water can help keep your resting heart rate lower.' },
  { icon: 'moon', title: 'Prioritise sleep', text: 'Aim for 7–9 hours; your heart rate recovers best overnight.' },
  { icon: 'coffee', title: 'Watch afternoon caffeine', text: 'Your heart rate peaks in the afternoon — try limiting caffeine after 2 PM.' },
  { icon: 'watch', title: 'Wear your watch overnight', text: 'Continuous night data makes these insights more accurate.' },
];

export const WEEKLY = [
  { label: 'Heart Rate', now: '79 BPM', prev: '76 BPM', change: '+2%', up: true },
  { label: 'Blood Oxygen', now: '98%', prev: '98%', change: '0%' },
  { label: 'Temperature', now: '36.7 °C', prev: '36.6 °C', change: '+0.3%' },
  { label: 'Blood Pressure', now: '120/80', prev: '119/79', change: '+1%' },
];

export function getInsightsFor(period) {
  return { ...PERIODS[period], vitals: VITALS };
}
