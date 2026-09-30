import { useEffect, useState } from 'react';
import { getOverview, isDemo } from '../services/healthService.js';
import { getSocket } from '../services/socket.js';

// Loads the overview, then refreshes it (throttled) whenever new live readings arrive.
export default function useOverview() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    let last = 0;
    let timer = null;
    const load = () => getOverview().then((d) => alive && setData(d)).catch(() => {});
    load();
    if (isDemo()) return () => { alive = false; };

    const socket = getSocket();
    const onReadings = () => {
      const wait = Math.max(0, 10_000 - (Date.now() - last));
      if (timer) return;
      timer = setTimeout(() => { timer = null; last = Date.now(); load(); }, wait);
    };
    socket?.on('readings', onReadings);
    return () => {
      alive = false;
      clearTimeout(timer);
      socket?.off('readings', onReadings);
    };
  }, []);
  return data;
}
