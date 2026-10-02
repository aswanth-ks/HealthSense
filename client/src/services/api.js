import axios from 'axios';
import { reportApiResult, isNetworkError } from './connectivity.js';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 20_000 });

api.interceptors.request.use((config) => {
  let token = null;
  try { token = localStorage.getItem('token'); } catch { /* ignore */ }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Keep the global "Connection unavailable" state in sync with real request outcomes.
api.interceptors.response.use(
  (res) => { reportApiResult(true); return res; },
  (err) => { reportApiResult(!isNetworkError(err)); return Promise.reject(err); }
);

export default api;
