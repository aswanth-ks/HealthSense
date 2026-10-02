import { useCallback, useEffect, useState } from 'react';
import { getLatestAssessment } from '../services/assessmentApi.js';
import { onLive } from '../services/socket.js';
import { isDemo } from '../services/healthService.js';
import { useInput } from '../context/InputContext.jsx';

// Latest 3-day assessment. Re-fetches after any user input or triage push; the server returns the cached
// assessment unless new data arrived, so this is cheap.
export default function useAssessment() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const { version } = useInput();

  const load = useCallback((opts) => {
    setLoading(true);
    return getLatestAssessment(opts)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, version]);
  useEffect(() => (isDemo() ? undefined : onLive('triage', () => load())), [load]);

  return { data, error, loading, reload: load };
}
