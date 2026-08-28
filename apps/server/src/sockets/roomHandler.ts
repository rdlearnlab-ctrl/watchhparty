import { Server, Socket } from 'socket.io';

interface RoomInfo {
  roomId: string;
  isPublic: boolean;
  userCount: number;
}

// In-memory room store
const rooms = new Map<string, { isPublic: boolean; users: Set<string> }>();

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
  // Send active public rooms when client asks on lobby load
  socket.on('get-public-rooms', () => {
    socket.emit('public-rooms-update', getPublicRooms());
  });

  // Client creates a room
  socket.on('create-room', ({ roomId, isPublic }: { roomId: string; isPublic: boolean }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { isPublic, users: new Set() });
    }
    if (isPublic) {
      io.emit('public-rooms-update', getPublicRooms());
    }
  });

  // Client joins a room
  socket.on('join-room', (roomId: string, username: string) => {
    socket.join(roomId);
    (socket as any).roomId = roomId;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { isPublic: false, users: new Set() });
    }

    const room = rooms.get(roomId)!;
    room.users.add(socket.id);

    if (room.isPublic) {
      io.emit('public-rooms-update', getPublicRooms());
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    const roomId = (socket as any).roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId)!;
      room.users.delete(socket.id);

      if (room.users.size === 0) {
        rooms.delete(roomId);
      }

      if (room.isPublic) {
        io.emit('public-rooms-update', getPublicRooms());
      }
    }
  });
};
