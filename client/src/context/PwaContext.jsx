import { createContext, useContext, useEffect, useState } from 'react';
import { getConnectivity, onConnectivity } from '../services/connectivity.js';
import { getOutbox, onOutbox, flushOutbox } from '../services/outbox.js';

// App-wide PWA state: install prompt, standalone mode, connectivity and the offline outbox.
const PwaContext = createContext(null);

const standaloneNow = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

export function PwaProvider({ children }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(standaloneNow());
  const [conn, setConn] = useState(getConnectivity());
  const [allOutbox, setOutbox] = useState(getOutbox());
  // Only this patient's entries are shown (another account's pending entries stay hidden on the device).
  let me = null;
  try { me = JSON.parse(localStorage.getItem('user'))?._id || null; } catch { /* ignore */ }
  const outbox = allOutbox.filter((i) => i.owner === me);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const offConn = onConnectivity(setConn);
    const offBox = onOutbox(setOutbox);
    flushOutbox();
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      offConn();
      offBox();
    };
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  const value = {
    installed,
    canInstall: !!deferred && !installed,
    isIOS,
    install: async () => {
      if (!deferred) return 'unavailable';
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      return outcome;
    },
    online: conn.online,
    apiReachable: conn.apiReachable,
    connected: conn.online && conn.apiReachable,
    outbox,
    pending: outbox.filter((i) => i.status === 'pending').length,
    failed: outbox.filter((i) => i.status === 'failed').length,
    retry: flushOutbox,
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export const usePwa = () => useContext(PwaContext);
