import { useCallback, useEffect, useState } from 'react';
import { getCycle } from '../services/cycleApi.js';
import { useInput } from '../context/InputContext.jsx';

// Cycle context for the signed-in user ({ tracking:false } when not enabled). Refreshes after any input.
export default function useCycle() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const { version } = useInput();
  const load = useCallback(() => getCycle().then((d) => { setData(d); setError(false); }).catch(() => setError(true)), []);
  useEffect(() => { load(); }, [load, version]);
  return { data, error, reload: load };
}
