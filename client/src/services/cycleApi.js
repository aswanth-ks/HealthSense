// Menstrual cycle tracking API. Entries made offline are kept on the device as "pending sync".
import api from './api.js';
import { sendOrQueue } from './outbox.js';
import { isDemo } from './healthService.js';

export async function getCycle() {
  if (isDemo()) return { tracking: false, sample: true };
  const { data } = await api.get('/me/cycle');
  return data;
}

export const saveCycleSettings = (body) => api.put('/me/cycle/settings', body).then((r) => r.data);
export const editCycle = (id, body) => api.put(`/me/cycle/cycles/${id}`, body).then((r) => r.data);
export const deleteCycle = (id) => api.delete(`/me/cycle/cycles/${id}`).then((r) => r.data);
export const deleteCycleSymptom = (id) => api.delete(`/me/cycle/symptoms/${id}`).then((r) => r.data);
export const deleteAllCycleData = () => api.delete('/me/cycle').then((r) => r.data);

/** Period start/end and symptoms keep the time they were entered, even if uploaded later. */
export async function periodStart(date) {
  const res = await sendOrQueue('cycle', 'post', '/me/cycle/period/start', { date: date || new Date().toISOString() });
  return res.pending ? { pending: true } : res.data;
}
export async function periodEnd(date) {
  const res = await sendOrQueue('cycle', 'post', '/me/cycle/period/end', { date: date || new Date().toISOString() });
  return res.pending ? { pending: true } : res.data;
}
export async function logCycleSymptom(body) {
  const res = await sendOrQueue('cycle', 'post', '/me/cycle/symptoms', { ...body, ts: body.ts || new Date().toISOString() });
  return res.pending ? { pending: true } : res.data;
}

export const addPreviousCycle = (body) => api.post('/me/menstrual/cycles', body).then((r) => r.data);
export const markPreviousUnknown = () => api.put('/me/cycle/settings', { tracking: true, previousUnknown: true }).then((r) => r.data);
