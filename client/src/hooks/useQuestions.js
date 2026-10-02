import { useCallback, useEffect, useState } from 'react';
import { getQuestions, onDemoChange } from '../services/inputService.js';
import { isDemo } from '../services/healthService.js';
import { onLive } from '../services/socket.js';

// Open (or answered) adaptive questions; refreshes when the server pushes 'questions' events.
export default function useQuestions(status = 'open') {
  const [questions, setQuestions] = useState(null);
  const reload = useCallback(() => getQuestions(status).then(setQuestions).catch(() => setQuestions([])), [status]);

  useEffect(() => {
    reload();
    if (isDemo()) return onDemoChange(reload);
    return onLive('questions', reload);
  }, [reload]);

  return { questions, reload };
}
