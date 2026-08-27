// apps/web/src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://localhost:4000';

export const useSocket = (roomId: string, username: string) => {
  const socket = useRef<Socket | null>(null);

  useEffect(() => {
    socket.current = io(SOCKET_SERVER_URL);

    socket.current.on('connect', () => {
      socket.current?.emit('join-room', roomId, username);
    });

    return () => {
      socket.current?.disconnect();
    };
  }, [roomId, username]);

  return socket.current;
};