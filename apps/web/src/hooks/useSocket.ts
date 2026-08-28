import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Hardcoded direct URL to your live Render backend
const BACKEND_URL = 'https://watchparty-wqd2.onrender.com';

export const useSocket = (roomId: string, username: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketIo = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: false
    });

    setSocket(socketIo);

    socketIo.on('connect', () => {
      console.log('Connected to backend:', socketIo.id);
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
