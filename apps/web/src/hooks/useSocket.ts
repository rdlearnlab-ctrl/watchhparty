import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (roomId: string, username: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Pull the Render URL directly. Fallback to localhost if missing.
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

    // Initialize socket cleanly without prepending extra schemes
    const socketIo = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    setSocket(socketIo);

    socketIo.on('connect', () => {
      console.log('Successfully connected to server:', socketIo.id);
      socketIo.emit('join-room', roomId, username);
    });

    socketIo.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return () => {
      socketIo.disconnect();
    };
  }, [roomId, username]);

  return socket;
};
