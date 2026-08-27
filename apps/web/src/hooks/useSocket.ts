import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (roomId: string, username: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Get the raw environment variable
    const rawUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

    // SANITIZER: Automatically strips out accidental typos like double protocols 
    // (e.g., turns "https://https://foo" or "wss://https://foo" into a clean domain)
    const cleanDomain = rawUrl
      .replace(/^wss?:\/\//i, '')
      .replace(/^https?:\/\//i, '');

    // Force standard secure connection for production, HTTP for local
    const socketUrl = cleanDomain.includes('localhost') 
      ? `http://${cleanDomain}` 
      : `https://${cleanDomain}`;

    console.log('Connecting to sanitized socket URL:', socketUrl);

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
