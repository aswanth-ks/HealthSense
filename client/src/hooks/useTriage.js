import { useCallback, useEffect, useState } from 'react';
import { getTriage } from '../services/triageService.js';
import { isDemo } from '../services/healthService.js';
import { getSocket } from '../services/socket.js';
import { useInput } from '../context/InputContext.jsx';

// Current triage + closed-loop state; refreshes on 'triage' pushes and after any user input.
export default function useTriage() {
  const [data, setData] = useState(null);
  const { version } = useInput();
  const load = useCallback(() => getTriage().then(setData).catch(() => setData(null)), []);

  useEffect(() => { load(); }, [load, version]);
  useEffect(() => {
    if (isDemo()) return undefined;
    const socket = getSocket();
    socket?.on('triage', load);
    return () => socket?.off('triage', load);
  }, [load]);

  return data;
}
