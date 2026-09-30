import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api.js';
import { closeSocket } from '../services/socket.js';

const AuthContext = createContext(null);

const DEMO_USER = { name: 'Aswanth S.', email: 'demo@healthsense.app', role: 'patient', demo: true };

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (read('demo') === '1') { setUser(DEMO_USER); setLoading(false); return; }
    if (!read('token')) { setLoading(false); return; }
    api.get('/users/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => write('token', null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = ({ token, user: u }) => { write('token', token); write('demo', null); setUser(u); return u; };

  const value = {
    user,
    loading,
    isDemo: !!user?.demo,
    login: (email, password) => api.post('/auth/login', { email, password }).then(({ data }) => handleAuth(data)),
    register: (payload) => api.post('/auth/register', payload).then(({ data }) => handleAuth(data)),
    enterDemo: () => { write('demo', '1'); write('token', null); setUser(DEMO_USER); },
    logout: () => { closeSocket(); write('token', null); write('demo', null); setUser(null); },
    updateUser: setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
