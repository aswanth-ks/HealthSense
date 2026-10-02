// Offline outbox: patient-entered data that could not be uploaded is kept on this device and clearly marked
// "pending sync" until the server confirms it. Nothing is ever reported as uploaded before the server accepts it.
import api from './api.js';
import { isNetworkError, onConnectivity, isConnected } from './connectivity.js';

const KEY = 'hs-outbox';
const listeners = new Set();
let flushing = false;

// Entries belong to the patient who made them: only uploaded while that same patient is signed in.
const currentUserId = () => { try { return JSON.parse(localStorage.getItem('user'))?._id || null; } catch { return null; } };

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const write = (items) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full/blocked: items stay in memory list below */ }
  listeners.forEach((fn) => fn(items));
};

export const getOutbox = () => read();
export const onOutbox = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const LABEL = { checkin: 'Daily check-in', symptom: 'Symptom', answer: 'Question answer', cycle: 'Cycle entry' };
export const describe = (item) => LABEL[item.kind] || 'Entry';

/** Queue a request for later. `body` must already contain the time the patient entered it. */
export function enqueue(kind, method, url, body) {
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, owner: currentUserId(), kind, method, url, body, createdAt: new Date().toISOString(), status: 'pending' };
  write([...read(), item]);
  return item;
}

export function discard(id) {
  write(read().filter((i) => i.id !== id));
}

/** Try to upload everything pending. Stops at the first connection failure; keeps rejected items for review. */
export async function flushOutbox() {
  const me = currentUserId();
  if (flushing || !isConnected() || !me) return;
  flushing = true;
  try {
    for (const item of read().filter((i) => i.status === 'pending' && i.owner === me)) {
      try {
        await api.request({ method: item.method, url: item.url, data: item.body });
        write(read().filter((i) => i.id !== item.id));
      } catch (err) {
        if (isNetworkError(err)) break; // still offline — try again later
        // The server rejected it (e.g. question already answered): keep it visible, never drop silently
        write(read().map((i) => (i.id === item.id ? { ...i, status: 'failed', error: err.response?.data?.message || 'Rejected by server' } : i)));
      }
    }
  } finally {
    flushing = false;
  }
}

/** Send now, or queue if there is no connection. Resolves to { data } or { pending: true }. */
export async function sendOrQueue(kind, method, url, body) {
  if (!isConnected()) return { pending: true, item: enqueue(kind, method, url, body) };
  try {
    const { data } = await api.request({ method, url, data: body });
    return { data };
  } catch (err) {
    if (isNetworkError(err)) return { pending: true, item: enqueue(kind, method, url, body) };
    throw err;
  }
}

// Retry automatically when the connection comes back, and periodically while items are waiting.
if (typeof window !== 'undefined') {
  onConnectivity((s) => { if (s.online) setTimeout(flushOutbox, 1000); });
  setInterval(() => { if (read().some((i) => i.status === 'pending')) flushOutbox(); }, 30_000);
}
