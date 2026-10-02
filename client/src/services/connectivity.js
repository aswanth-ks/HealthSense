// Tracks whether the HealthSense backend is reachable (device offline OR server/database unreachable).
const listeners = new Set();
let state = { online: typeof navigator === 'undefined' ? true : navigator.onLine, apiReachable: true };

const emit = () => listeners.forEach((fn) => fn(state));
const set = (patch) => {
  const next = { ...state, ...patch };
  if (next.online !== state.online || next.apiReachable !== state.apiReachable) {
    state = next;
    emit();
  }
};

export const getConnectivity = () => state;
export const onConnectivity = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const isConnected = () => state.online && state.apiReachable;

/** Called by the API client after every request. */
export function reportApiResult(ok) {
  set({ apiReachable: ok });
  if (!ok) startProbe();
}

// While the backend is unreachable, check every 15 s whether it (and its database) is back.
let probe = null;
function startProbe() {
  if (probe || typeof window === 'undefined') return;
  probe = setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/health-check`, { cache: 'no-store' });
      const body = await res.json();
      if (res.ok && body.db) {
        clearInterval(probe);
        probe = null;
        set({ apiReachable: true });
      }
    } catch { /* still unreachable */ }
  }, 15_000);
}

/** True when an axios error means "no connection" (as opposed to the server answering with an error). */
export const isNetworkError = (err) => !err?.response || err.response.status === 503 || err.response.status === 502 || err.response.status === 504;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
}
