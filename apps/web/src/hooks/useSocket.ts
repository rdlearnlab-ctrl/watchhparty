import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// This explicitly points to your Render backend in production
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export const useSocket = (roomId: string, username: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize the socket connection with the correct transports
    const socketIo = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    setSocket(socketIo);

    // Only join the room once the connection is formally established
    socketIo.on('connect', () => {
      console.log('Successfully connected to Socket server:', socketIo.id);
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
