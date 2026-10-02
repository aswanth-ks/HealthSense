import { io } from 'socket.io-client';

let socket = null;

// Live push is unavailable on serverless hosting (Vercel): pages fall back to polling.
export const realtimeEnabled = import.meta.env.VITE_REALTIME !== 'off';
export const POLL_MS = 30_000;

// One shared authenticated connection. Vite proxies /socket.io to the API in dev.
export function getSocket() {
  if (!realtimeEnabled) return null;
  let token = null;
  try { token = localStorage.getItem('token'); } catch { /* ignore */ }
  if (!token) return null;
  if (socket && socket.auth?.token === token) return socket;
  socket?.disconnect();
  socket = io(import.meta.env.VITE_SOCKET_URL || '/', { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}

/**
 * Subscribe to a server push event; when push isn't available, call the handler on an interval instead.
 * Returns an unsubscribe function.
 */
export function onLive(event, handler, pollMs = POLL_MS) {
  const socket = getSocket();
  if (socket) {
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }
  const id = setInterval(handler, pollMs);
  return () => clearInterval(id);
}
