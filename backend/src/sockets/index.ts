import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { AccessTokenPayload } from '../middleware/auth';

let io: SocketServer | undefined;

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Missing token'));
      const payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AccessTokenPayload;
    socket.join(`user:${user.sub}`);
    socket.join(`org:${user.organizationId}`);
    logger.debug(`Socket connected: user=${user.sub}`);

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: user=${user.sub}`);
    });
  });

  return io;
}

export function getIo(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToOrganization(organizationId: string, event: string, payload: unknown) {
  io?.to(`org:${organizationId}`).emit(event, payload);
}
