import { useEffect, useState } from 'react';
import { getOverview, isDemo } from '../services/healthService.js';
import { onLive } from '../services/socket.js';
import { useInput } from '../context/InputContext.jsx';

// Loads the overview, then refreshes it (throttled) whenever new live readings arrive.
export default function useOverview() {
  const [data, setData] = useState(null);
  const { version } = useInput();
  useEffect(() => {
    let alive = true;
    let last = 0;
    let timer = null;
    const load = () => getOverview().then((d) => alive && setData(d)).catch(() => alive && setData((cur) => cur || { error: true }));
    load();
    if (isDemo()) return () => { alive = false; };

    const onReadings = () => {
      const wait = Math.max(0, 10_000 - (Date.now() - last));
      if (timer) return;
      timer = setTimeout(() => { timer = null; last = Date.now(); load(); }, wait);
    };
    const unsubscribe = onLive('readings', onReadings);
    return () => {
      alive = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [version]);
  return data;
}
