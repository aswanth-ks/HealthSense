import api from './api.js';
import { sendOrQueue } from './outbox.js';
import { isDemo } from './healthService.js';

// ---- Demo-mode store (no backend) ----
let demoQuestions = [
  {
    id: 'demo-q1', code: 'sleep.wake_sudden', kind: 'yesno', module: 'sleepRisk', status: 'open',
    text: 'You have experienced repeated nighttime disturbances. Did you wake suddenly during sleep?',
    reason: 'Detected 9 breathing/oxygen disturbances across 2 nights. Knowing whether you woke up helps tell a sensor artefact from a real breathing pattern.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-q2', code: 'missing.sleep', field: 'sleep', kind: 'number', unit: 'hours', min: 0, max: 16, step: 0.5, suggested: 7, module: 'missing', status: 'open',
    text: 'How many hours did you sleep last night?',
    reason: 'We could only guess about 7 h (58% confidence), which is too uncertain to use.',
    createdAt: new Date().toISOString(),
  },
];
const demoListeners = new Set();
const notifyDemo = () => demoListeners.forEach((fn) => fn());
export const onDemoChange = (fn) => { demoListeners.add(fn); return () => demoListeners.delete(fn); };

export async function getQuestions(status = 'open') {
  if (isDemo()) return demoQuestions.filter((q) => q.status === status);
  const { data } = await api.get('/me/questions', { params: { status } });
  return data;
}

export async function answerQuestion(id, answer) {
  if (isDemo()) {
    demoQuestions = demoQuestions.map((q) => (q.id === id ? { ...q, status: 'answered', answer, answeredAt: new Date().toISOString() } : q));
    notifyDemo();
    return null;
  }
  const res = await sendOrQueue('answer', 'post', `/me/questions/${id}/answer`, { answer });
  return res.pending ? { pending: true } : res.data;
}

export async function dismissQuestion(id) {
  if (isDemo()) {
    demoQuestions = demoQuestions.map((q) => (q.id === id ? { ...q, status: 'dismissed' } : q));
    notifyDemo();
    return null;
  }
  const { data } = await api.post(`/me/questions/${id}/dismiss`);
  return data;
}

export async function submitCheckin(payload) {
  if (isDemo()) {
    if (payload.sleepHours != null) demoQuestions = demoQuestions.map((q) => (q.field === 'sleep' && q.status === 'open' ? { ...q, status: 'answered', answer: payload.sleepHours } : q));
    notifyDemo();
    return { ok: true, demo: true };
  }
  // The entry keeps the time the patient made it, even if it is uploaded later.
  const res = await sendOrQueue('checkin', 'post', '/me/checkin', { ...payload, date: payload.date || new Date().toISOString() });
  return res.pending ? { pending: true } : res.data;
}

export async function logSymptom(payload) {
  if (isDemo()) return { ok: true, demo: true };
  const res = await sendOrQueue('symptom', 'post', '/me/symptoms', { ...payload, ts: new Date().toISOString() });
  return res.pending ? { pending: true } : res.data;
}

export async function getSymptoms(days = 7) {
  if (isDemo()) return [];
  const { data } = await api.get('/me/symptoms', { params: { days } });
  return data;
}
