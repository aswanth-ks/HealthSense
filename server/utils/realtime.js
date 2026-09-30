import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

let io = null;

// Browser clients authenticate with their JWT and join a per-user room.
export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL?.split(',') || true } });
  io.use((socket, next) => {
    try {
      const { id } = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      socket.data.userId = id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => socket.join(`user:${socket.data.userId}`));
  return io;
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
