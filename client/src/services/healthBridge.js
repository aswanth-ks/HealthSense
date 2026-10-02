// HealthSense Mobile Bridge — the boundary between this web app and the phone's health platform.
//
// A browser/PWA cannot read Android Health Connect or Apple HealthKit. Those APIs are only available to a
// native app. The HealthSense mobile shell (see /mobile-bridge) hosts this web app in a WebView and injects
// `window.HealthSenseBridge` with the contract below. Without it, this module reports "unavailable" and
// the UI says so. It never pretends that permission was granted.
//
// window.HealthSenseBridge contract (all async, JSON-serialisable):
//   platform(): 'android' | 'ios'
//   isAvailable(): { available: boolean, reason?: 'not_installed' | 'unsupported' }   // e.g. Health Connect app missing
//   requestPermissions(metrics: string[]): { granted: string[], denied: string[] }  // shows the OS permission sheet
//   readDaily(metric: 'steps', fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD'):
//       [{ date: 'YYYY-MM-DD', value: number, source_record_id?: string }]          // daily totals, missing days omitted
//   openSettings(): void                                                            // opens the OS health permission screen

// Only metrics the app currently uses are requested.
export const REQUESTED_METRICS = ['steps'];

const bridge = () => (typeof window !== 'undefined' ? window.HealthSenseBridge : undefined);

/** 'android' | 'ios' | 'other' — from the native bridge if present, otherwise a user-agent guess (for wording only). */
export function detectPlatform() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'other';
}

export const PLATFORM = {
  android: { source: 'HEALTH_CONNECT', name: 'Health Connect', button: 'Connect Health Connect' },
  ios: { source: 'APPLE_HEALTH', name: 'Apple Health', button: 'Connect Apple Health' },
  other: { source: null, name: 'Health Data', button: 'Connect Health Data' },
};

export const hasBridge = () => !!bridge();

export async function bridgePlatform() {
  const b = bridge();
  if (!b) return detectPlatform();
  try { return (await b.platform()) || detectPlatform(); } catch { return detectPlatform(); }
}

export async function bridgeAvailability() {
  const b = bridge();
  if (!b) return { available: false, reason: 'no_bridge' };
  try { return await b.isAvailable(); } catch { return { available: false, reason: 'unsupported' }; }
}

export async function requestPermissions(metrics = REQUESTED_METRICS) {
  const b = bridge();
  if (!b) throw new Error('no_bridge');
  const r = await b.requestPermissions(metrics);
  return { granted: (r?.granted || []).filter((m) => metrics.includes(m)), denied: r?.denied || [] };
}

export async function readDaily(metric, from, to) {
  const b = bridge();
  if (!b) throw new Error('no_bridge');
  return (await b.readDaily(metric, from, to)) || [];
}

export function openHealthSettings() {
  try { bridge()?.openSettings?.(); } catch { /* ignore */ }
}
