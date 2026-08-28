import { Server, Socket } from 'socket.io';

type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

interface LudoState {
  activePlayers: PlayerColor[];
  turn: PlayerColor;
  dice: number | null;
  positions: Record<PlayerColor, number[]>;
  hasRolled: boolean;
  isRolling: boolean;
  status: 'setup' | 'playing';
  owners: Record<PlayerColor, string | null>;
}

interface RoomInfo {
  roomId: string;
  isPublic: boolean;
  userCount: number;
}

const createDefaultLudoState = (): LudoState => ({
  activePlayers: ['red', 'yellow'],
  turn: 'red',
  dice: null,
  positions: {
    red: [-1, -1, -1, -1],
    green: [-1, -1, -1, -1],
    yellow: [-1, -1, -1, -1],
    blue: [-1, -1, -1, -1],
  },
  hasRolled: false,
  isRolling: false,
  status: 'setup',
  owners: {
    red: null,
    green: null,
    yellow: null,
    blue: null,
  },
});

// In-memory room store & game state
const rooms = new Map<string, { isPublic: boolean; users: Map<string, string> }>();
const roomLudoGames = new Map<string, LudoState>();

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

    // Initialize room game state if not present
    if (!roomLudoGames.has(roomId)) {
      roomLudoGames.set(roomId, createDefaultLudoState());
    }

    io.to(roomId).emit('notification', `${username || 'A player'} joined the room`);

    if (room.isPublic) {
      io.emit('public-rooms-update', getPublicRooms());
    }
  });

  // 3. Ludo Engine Handlers
  socket.on('get-ludo-state', () => {
    const roomId = (socket as any).roomId;
    if (!roomId) return;
    if (!roomLudoGames.has(roomId)) {
      roomLudoGames.set(roomId, createDefaultLudoState());
    }
    socket.emit('ludo-update', roomLudoGames.get(roomId));
  });

  socket.on('ludo-start-game', ({ playerCount }: { playerCount: number }) => {
    const roomId = (socket as any).roomId;
    if (!roomId) return;

    let activePlayers: PlayerColor[] = ['red', 'yellow'];
    if (playerCount === 3) activePlayers = ['red', 'green', 'yellow'];
    if (playerCount === 4) activePlayers = ['red', 'green', 'yellow', 'blue'];

    const newGame: LudoState = {
      activePlayers,
      turn: activePlayers[0],
      dice: null,
      positions: {
        red: [-1, -1, -1, -1],
        green: [-1, -1, -1, -1],
        yellow: [-1, -1, -1, -1],
        blue: [-1, -1, -1, -1],
      },
      hasRolled: false,
      isRolling: false,
      status: 'playing',
      owners: {
        red: null,
        green: null,
        yellow: null,
        blue: null,
      },
    };

    roomLudoGames.set(roomId, newGame);
    io.to(roomId).emit('ludo-update', newGame);
  });

  socket.on('ludo-roll-dice', () => {
    const roomId = (socket as any).roomId;
    if (!roomId || !roomLudoGames.has(roomId)) return;

    const game = roomLudoGames.get(roomId)!;
    if (game.status !== 'playing' || game.hasRolled || game.isRolling) return;

    // Claim turn color if unowned
    const currentTurnColor = game.turn;
    if (!game.owners[currentTurnColor]) {
      game.owners[currentTurnColor] = socket.id;
    }

    // Trigger rolling state
    game.isRolling = true;
    io.to(roomId).emit('ludo-update', game);

    setTimeout(() => {
      const diceVal = Math.floor(Math.random() * 6) + 1;
      game.dice = diceVal;
      game.isRolling = false;
      game.hasRolled = true;

      // Check if any legal move is possible
      const positions = game.positions[currentTurnColor];
      const hasLegalMove = positions.some((pos) => {
        if (pos === 57) return false;
        if (pos === -1) return diceVal === 6;
        return pos + diceVal <= 57;
      });

      if (!hasLegalMove) {
        // Auto-advance turn if no moves are valid
        setTimeout(() => {
          const currentIndex = game.activePlayers.indexOf(game.turn);
          const nextIndex = (currentIndex + 1) % game.activePlayers.length;
          game.turn = game.activePlayers[nextIndex];
          game.dice = null;
          game.hasRolled = false;
          io.to(roomId).emit('ludo-update', game);
        }, 1000);
      }

      io.to(roomId).emit('ludo-update', game);
    }, 700);
  });

  socket.on('ludo-move-piece', ({ pieceIdx }: { pieceIdx: number }) => {
    const roomId = (socket as any).roomId;
    if (!roomId || !roomLudoGames.has(roomId)) return;

    const game = roomLudoGames.get(roomId)!;
    if (game.status !== 'playing' || !game.hasRolled || !game.dice) return;

    const color = game.turn;
    const currentPos = game.positions[color][pieceIdx];

    let newPos = currentPos;
    if (currentPos === -1 && game.dice === 6) {
      newPos = 0;
    } else if (currentPos >= 0 && currentPos + game.dice <= 57) {
      newPos = currentPos + game.dice;
    } else {
      return; // Invalid move
    }

    game.positions[color][pieceIdx] = newPos;

    // Turn rotation (extra roll on 6)
    if (game.dice !== 6) {
      const currentIndex = game.activePlayers.indexOf(game.turn);
      const nextIndex = (currentIndex + 1) % game.activePlayers.length;
      game.turn = game.activePlayers[nextIndex];
    }

    game.dice = null;
    game.hasRolled = false;

    io.to(roomId).emit('ludo-update', game);
  });

  socket.on('ludo-reset', () => {
    const roomId = (socket as any).roomId;
    if (!roomId) return;
    const defaultState = createDefaultLudoState();
    roomLudoGames.set(roomId, defaultState);
    io.to(roomId).emit('ludo-update', defaultState);
  });

  // 4. Chat System
  socket.on('send-message', (text: string) => {
    const roomId = (socket as any).roomId;
    const username = (socket as any).username || 'Player';
    if (roomId) {
      io.to(roomId).emit('receive-message', { sender: username, text });
    }
  });

  // 5. YouTube Video Sync
  socket.on('change-url', (newUrl: string) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('sync-url', newUrl);
    }
  });

  // 6. Screen Sharing Stream
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

  // 7. Camera Stream
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

  // 8. Audio Stream
  socket.on('audio-chunk', (chunk: any) => {
    const roomId = (socket as any).roomId;
    if (roomId) {
      socket.to(roomId).emit('receive-audio-chunk', { chunk });
    }
  });

  // 9. Cleanup on disconnect
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
        roomLudoGames.delete(roomId);
      }

      if (room.isPublic) {
        io.emit('public-rooms-update', getPublicRooms());
      }
    }
  });
};
