import { createContext, useCallback, useContext, useState } from 'react';
import CheckinModal from '../components/input/CheckinModal.jsx';

// Lets any page open the daily check-in (e.g. "Correct this" on an estimated value).
const InputContext = createContext({ openCheckin: () => {}, version: 0 });

export function InputProvider({ children }) {
  const [state, setState] = useState({ open: false, prefill: null });
  const [version, setVersion] = useState(0); // bumps after any saved input so pages can refetch

  const openCheckin = useCallback((prefill = null) => setState({ open: true, prefill }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  return (
    <InputContext.Provider value={{ openCheckin, version, bump: () => setVersion((v) => v + 1) }}>
      {children}
      <CheckinModal open={state.open} prefill={state.prefill} onClose={close} onSaved={() => setVersion((v) => v + 1)} />
    </InputContext.Provider>
  );
}

export const useInput = () => useContext(InputContext);
