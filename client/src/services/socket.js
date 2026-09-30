import { io } from 'socket.io-client';

let socket = null;

// One shared authenticated connection. Vite proxies /socket.io to the API in dev.
export function getSocket() {
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
