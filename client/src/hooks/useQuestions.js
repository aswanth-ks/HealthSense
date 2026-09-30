import { useCallback, useEffect, useState } from 'react';
import { getQuestions, onDemoChange } from '../services/inputService.js';
import { isDemo } from '../services/healthService.js';
import { getSocket } from '../services/socket.js';

// Open (or answered) adaptive questions; refreshes when the server pushes 'questions' events.
export default function useQuestions(status = 'open') {
  const [questions, setQuestions] = useState(null);
  const reload = useCallback(() => getQuestions(status).then(setQuestions).catch(() => setQuestions([])), [status]);

  useEffect(() => {
    reload();
    if (isDemo()) return onDemoChange(reload);
    const socket = getSocket();
    socket?.on('questions', reload);
    return () => socket?.off('questions', reload);
  }, [reload]);

  return { questions, reload };
}
