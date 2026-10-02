import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api.js';
import { closeSocket } from '../services/socket.js';
import { isNetworkError } from '../services/connectivity.js';
import { getOutbox, flushOutbox } from '../services/outbox.js';

const AuthContext = createContext(null);

const DEMO_USER = { name: 'Aswanth S.', email: 'demo@healthsense.app', role: 'patient', demo: true };

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };
const readUser = () => { try { return JSON.parse(read('user')); } catch { return null; } };

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cache the profile so the installed app still opens (signed in) when there is no connection.
  const setUser = (u) => { setUserState(u); if (u && !u.demo) write('user', JSON.stringify(u)); };

  useEffect(() => {
    if (read('demo') === '1') { setUserState(DEMO_USER); setLoading(false); return; }
    if (!read('token')) { setLoading(false); return; }
    api.get('/users/me')
      .then(({ data }) => { setUser(data.user); setTimeout(flushOutbox, 500); })
      .catch((err) => {
        if (isNetworkError(err)) {
          // Offline / server unreachable: stay signed in with the cached profile; pages show "Connection unavailable".
          const cached = readUser();
          if (cached) setUserState(cached);
        } else {
          // The server rejected the session (expired/invalid token): sign out.
          write('token', null);
          write('user', null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = ({ token, user: u }) => { write('token', token); write('demo', null); setUser(u); setTimeout(flushOutbox, 500); return u; };

  const value = {
    user,
    loading,
    isDemo: !!user?.demo,
    login: (email, password) => api.post('/auth/login', { email, password }).then(({ data }) => handleAuth(data)),
    register: (payload) => api.post('/auth/register', payload).then(({ data }) => handleAuth(data)),
    enterDemo: () => { write('demo', '1'); write('token', null); setUserState(DEMO_USER); },
    logout: () => {
      const waiting = getOutbox().filter((i) => i.status === 'pending' && i.owner === user?._id).length;
      if (waiting && !window.confirm(`${waiting} ${waiting === 1 ? 'entry has' : 'entries have'} not been uploaded yet. They stay on this device and upload the next time you sign in. Sign out anyway?`)) return;
      closeSocket();
      write('token', null);
      write('demo', null);
      write('user', null);
      setUserState(null);
    },
    updateUser: setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
