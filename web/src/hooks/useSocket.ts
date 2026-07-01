import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../services/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

export function useSocket(onNotification?: (payload: unknown) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return undefined;

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    if (onNotification) {
      socket.on('notification:new', onNotification);
    }

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken()]);

  return socketRef;
}
