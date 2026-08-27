import { Server, Socket } from 'socket.io';

// Lobby State
const publicRooms = new Set<string>();

// Ludo State
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
const ludoRooms: Record<string, LudoState> = {};
const createInitialLudoState = (): LudoState => ({
  activePlayers: [],
  turn: 'red',
  dice: null,
  positions: { red: [-1, -1, -1, -1], green: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1], blue: [-1, -1, -1, -1] },
  hasRolled: false,
  isRolling: false,
  status: 'setup',
  owners: { red: null, green: null, yellow: null, blue: null }
});
const OFFSETS = { green: 0, yellow: 13, blue: 26, red: 39 };
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

export const handleRoomEvents = (io: Server, socket: Socket) => {
  // Lobby Setup
  socket.on('get-public-rooms', () => {
    socket.emit('public-rooms-list', Array.from(publicRooms));
  });

  socket.on('create-room', (roomId: string, isPublic: boolean) => {
    if (isPublic) publicRooms.add(roomId);
    io.emit('public-rooms-list', Array.from(publicRooms));
  });

  socket.on('join-room', (roomId: string, username: string) => {
    socket.join(roomId);
    socket.to(roomId).emit('notification', `${username} joined the party!`);

    // Media & Sync
    socket.on('video-play', (time: number) => socket.to(roomId).emit('sync-play', time));
    socket.on('video-pause', (time: number) => socket.to(roomId).emit('sync-pause', time));
    socket.on('video-seek', (time: number) => socket.to(roomId).emit('sync-seek', time));
    socket.on('change-url', (url: string) => socket.to(roomId).emit('sync-url', url));

    socket.on('camera-frame', (frame: string) => socket.to(roomId).emit('receive-camera-frame', { sender: socket.id, frame }));
    socket.on('screen-frame', (frame: string) => socket.to(roomId).emit('receive-screen-frame', frame));
    socket.on('audio-chunk', (chunk: ArrayBuffer) => socket.to(roomId).emit('receive-audio-chunk', { sender: socket.id, chunk }));
    
    socket.on('stop-share', () => socket.to(roomId).emit('share-stopped'));
    socket.on('camera-stopped', () => socket.to(roomId).emit('user-camera-stopped', socket.id));

    // Ludo Engine
    socket.on('get-ludo-state', () => {
      if (!ludoRooms[roomId]) ludoRooms[roomId] = createInitialLudoState();
      io.to(roomId).emit('ludo-update', ludoRooms[roomId]);
    });

    socket.on('ludo-start-game', ({ playerCount }: { playerCount: number }) => {
      const game = createInitialLudoState();
      if (playerCount === 2) game.activePlayers = ['red', 'yellow'];
      else if (playerCount === 3) game.activePlayers = ['red', 'green', 'yellow'];
      else game.activePlayers = ['red', 'green', 'yellow', 'blue'];
      game.turn = game.activePlayers[0];
      game.status = 'playing';
      ludoRooms[roomId] = game;
      io.to(roomId).emit('ludo-update', game);
    });

    socket.on('ludo-roll-dice', () => {
      const game = ludoRooms[roomId];
      if (!game || game.status !== 'playing' || game.hasRolled || game.isRolling) return;
      const color = game.turn;
      const alreadyOwnsAColor = Object.values(game.owners).includes(socket.id);
      
      if (!game.owners[color]) {
        if (alreadyOwnsAColor) return; 
        game.owners[color] = socket.id; 
      } else if (game.owners[color] !== socket.id) {
        return; 
      }
      
      game.isRolling = true;
      game.hasRolled = true; 
      ludoRooms[roomId] = game;
      io.to(roomId).emit('ludo-update', game);
      
      setTimeout(() => {
        const currentGame = ludoRooms[roomId];
        if (!currentGame) return;
        currentGame.isRolling = false;
        currentGame.dice = Math.floor(Math.random() * 6) + 1;
        
        const currentTokens = currentGame.positions[currentGame.turn];
        let hasValidMove = false;
        for (let pos of currentTokens) {
          if (pos === -1 && currentGame.dice === 6) hasValidMove = true;
          if (pos >= 0 && pos + currentGame.dice <= 57) hasValidMove = true;
        }
        
        if (!hasValidMove) {
          io.to(roomId).emit('ludo-update', currentGame);
          setTimeout(() => {
            const latestGame = ludoRooms[roomId];
            if (latestGame && latestGame.status === 'playing' && latestGame.turn === currentGame.turn) {
              const nextIdx = (latestGame.activePlayers.indexOf(latestGame.turn) + 1) % latestGame.activePlayers.length;
              latestGame.turn = latestGame.activePlayers[nextIdx];
              latestGame.hasRolled = false;
              latestGame.dice = null;
              io.to(roomId).emit('ludo-update', latestGame);
            }
          }, 1500);
        } else {
          io.to(roomId).emit('ludo-update', currentGame);
        }
      }, 500);
    });

    socket.on('ludo-move-piece', ({ pieceIdx }: { pieceIdx: number }) => {
      const game = ludoRooms[roomId];
      if (!game || game.status !== 'playing' || !game.hasRolled || game.isRolling || game.dice === null) return;
      const color = game.turn;
      if (game.owners[color] !== socket.id) return;
      
      const currentPos = game.positions[color][pieceIdx];
      let newPos = currentPos;
      let extraTurn = false;
      
      if (currentPos === -1 && game.dice === 6) newPos = 0;
      else if (currentPos >= 0) {
        newPos = currentPos + game.dice;
        if (newPos > 57) return; 
      } else return;
      
      if (newPos >= 0 && newPos <= 50) {
        const myAbsolutePos = (newPos + OFFSETS[color]) % 52;
        if (!SAFE_ZONES.includes(myAbsolutePos)) {
          for (const oppColor of game.activePlayers) {
            if (oppColor !== color) {
              game.positions[oppColor].forEach((oppPos, oppIdx) => {
                if (oppPos >= 0 && oppPos <= 50) {
                  const oppAbsolutePos = (oppPos + OFFSETS[oppColor]) % 52;
                  if (myAbsolutePos === oppAbsolutePos) {
                    game.positions[oppColor][oppIdx] = -1;
                    extraTurn = true; 
                  }
                }
              });
            }
          }
        }
      }
      
      game.positions[color][pieceIdx] = newPos;
      if (game.dice === 6 || newPos === 57) extraTurn = true; 
      
      if (!extraTurn) {
        const nextIdx = (game.activePlayers.indexOf(game.turn) + 1) % game.activePlayers.length;
        game.turn = game.activePlayers[nextIdx];
      }
      game.dice = null;
      game.hasRolled = false;
      ludoRooms[roomId] = game;
      io.to(roomId).emit('ludo-update', game);
    });

    socket.on('ludo-reset', () => {
      ludoRooms[roomId] = createInitialLudoState();
      io.to(roomId).emit('ludo-update', ludoRooms[roomId]);
    });

    // Chat
    socket.on('send-message', (message: string) => {
      io.to(roomId).emit('receive-message', { sender: username, text: message, timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-camera-stopped', socket.id);
      socket.to(roomId).emit('user-disconnected', socket.id);
      
      const game = ludoRooms[roomId];
      if (game) {
        for (const color of ['red', 'green', 'yellow', 'blue'] as PlayerColor[]) {
          if (game.owners[color] === socket.id) {
            game.owners[color] = null;
            io.to(roomId).emit('ludo-update', game);
          }
        }
      }

      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room || room.size === 0) {
        publicRooms.delete(roomId);
        io.emit('public-rooms-list', Array.from(publicRooms));
      }
    });
  });
};