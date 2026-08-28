import { Server, Socket } from 'socket.io';

interface RoomInfo {
  roomId: string;
  isPublic: boolean;
  userCount: number;
}

// In-memory tracking for rooms and lobby
const rooms = new Map<string, { isPublic: boolean; users: Map<string, string> }>();

const getPublicRooms = (): RoomInfo[] => {
  const publicList: RoomInfo[] = [];
  rooms.forEach((data, roomId) => {
    if (data.isPublic && data.users.size > 0) {
      publicList.push({
        roomId,
        isPublic: true,
        userCount: data.users.size,
      });
    }
  });
  return publicList;
};

export const handleRoomEvents = (io: Server, socket: Socket) => {
  // 1. Lobby & Room Management
  socket.on('get-public-rooms', () => {
    socket.emit('public-rooms-update', getPublicRooms());
  });

  socket.on('create-room', ({ roomId, isPublic }: { roomId: string; isPublic: boolean }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { isPublic, users: new Map() });
    }
    if (isPublic) {
      io.emit('public-rooms-update', getPublicRooms());
    }
  });

  // 2. Joining Rooms
  socket.on('join-room', (roomId: string, username: string) => {
    socket.join(roomId);
    (socket as any).roomId = roomId;
    (socket as any).username = username || 'Guest';

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { isPublic: true, users: new Map() });
    }

    const room = rooms.get(roomId)!;
    room.users.set(socket.id, username || 'Guest');

    // System join notification
    io.to(roomId).emit('notification', `${username || 'A player'} joined the room`);

    // Update public lobby list if public
    if (room.isPublic) {
      io.emit('public-rooms-update', getPublicRooms());
    }
  });

  // 3. Chat System
  socket.on('send-message', (text: string) => {
    const roomId = (socket as any).roomId;
    const username = (socket as any).username || 'Player';
    if (roomId) {
      io.to(roomId).emit('receive-message', { sender: username, text });
    }
  });

  // 4. YouTube Video Sync
  socket.on('change-url', (newUrl: string) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('sync-url', newUrl);
    }
  });

  socket.on('video-action', (actionData: any) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('sync-video-action', actionData);
    }
  });

  // 5. Screen Sharing Stream
  socket.on('screen-frame', (frame: string) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('receive-screen-frame', frame);
    }
  });

  socket.on('stop-share', () => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('share-stopped');
    }
  });

  // 6. Camera Stream
  socket.on('camera-frame', (frame: string) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('receive-camera-frame', { sender: socket.id, frame });
    }
  });

  socket.on('camera-stopped', () => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('user-camera-stopped', socket.id);
    }
  });

  // 7. Mic / Audio Streaming
  socket.on('audio-chunk', (chunk: any) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('receive-audio-chunk', { chunk });
    }
  });

  // 8. Ludo & Game Events Relay
  // Relays any moves, rolls, and game state across clients in the room
  socket.on('game-action', (data: any) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('game-action', data);
    }
  });

  socket.on('ludo-action', (data: any) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('ludo-action', data);
    }
  });

  socket.on('ludo-sync', (data: any) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('ludo-sync', data);
    }
  });

  // 9. Disconnect & Cleanup
  socket.on('disconnect', () => {
    const roomId = (socket as any).roomId;
    const username = (socket as any).username;

    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId)!;
      room.users.delete(socket.id);

      socket.to(roomId).emit('user-disconnected', socket.id);
      socket.to(roomId).emit('user-camera-stopped', socket.id);
      
      if (username) {
        socket.to(roomId).emit('notification', `${username} left the room`);
      }

      if (room.users.size === 0) {
        rooms.delete(roomId);
      }

      if (room.isPublic) {
        io.emit('public-rooms-update', getPublicRooms());
      }
    }
  });
};
