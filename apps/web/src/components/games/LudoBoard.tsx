'use client';

import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { NeoButton } from '../ui/NeoButton';

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

// 15x15 Grid Pathing
const PATH_COORDS = [
  { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
  { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 },
  { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
  { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
  { x: 14, y: 7 }, { x: 14, y: 8 }, { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
  { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 },
  { x: 7, y: 14 }, { x: 6, y: 14 }, { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
  { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
  { x: 0, y: 7 }
];

const HOME_STRETCH = {
  green:  [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }],
  yellow: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }],
  blue:   [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }],
  red:    [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }]
};

const BASE_COORDS = {
  green:  [{ x: 2.5, y: 2.5 }, { x: 4.5, y: 2.5 }, { x: 2.5, y: 4.5 }, { x: 4.5, y: 4.5 }],
  yellow: [{ x: 10.5, y: 2.5 }, { x: 12.5, y: 2.5 }, { x: 10.5, y: 4.5 }, { x: 12.5, y: 4.5 }],
  blue:   [{ x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }, { x: 10.5, y: 12.5 }, { x: 12.5, y: 12.5 }],
  red:    [{ x: 2.5, y: 10.5 }, { x: 4.5, y: 10.5 }, { x: 2.5, y: 12.5 }, { x: 4.5, y: 12.5 }]
};

const OFFSETS = { green: 0, yellow: 13, blue: 26, red: 39 };
const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const colorMap = { red: '#ef4444', green: '#16a34a', yellow: '#facc15', blue: '#3b82f6' };
const bgClassMap = { red: 'bg-[#e33529]', green: 'bg-[#009b40]', yellow: 'bg-[#ffcc00]', blue: 'bg-[#1888fd]' };

const MapPinToken = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 36" className="w-full h-full drop-shadow-md">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.52-4.48-10-10-10z" fill={color} stroke="white" strokeWidth="2" />
    <circle cx="12" cy="12" r="5" fill="white" />
    <circle cx="12" cy="12" r="3.5" fill={color} />
  </svg>
);

const Crown = ({ number }: { number: string }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-center">
    <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] drop-shadow-md text-yellow-500" fill="currentColor">
      <path d="M10 80 L90 80 L100 20 L75 50 L50 10 L25 50 L0 20 Z" stroke="#b8860b" strokeWidth="2" />
      <circle cx="0" cy="20" r="6" fill="#ef4444" />
      <circle cx="50" cy="10" r="6" fill="#ef4444" />
      <circle cx="100" cy="20" r="6" fill="#ef4444" />
    </svg>
    <span className="absolute text-black font-black text-4xl sm:text-5xl drop-shadow-sm" style={{ WebkitTextStroke: '2px white' }}>{number}</span>
  </div>
);

const DiceFace = ({ value }: { value: number | null }) => {
  if (!value) return null;
  const poses = {
    1: ['col-start-2 row-start-2'],
    2: ['col-start-1 row-start-1', 'col-start-3 row-start-3'],
    3: ['col-start-1 row-start-1', 'col-start-2 row-start-2', 'col-start-3 row-start-3'],
    4: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
    5: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-2 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
    6: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3']
  };
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-[2px] w-[60%] h-[60%]">
      {poses[value as keyof typeof poses].map((pos, i) => (
        <div key={i} className={`bg-black rounded-full w-full h-full ${pos}`} />
      ))}
    </div>
  );
};

export const LudoBoard: React.FC<{ socket: Socket | null }> = ({ socket }) => {
  const [game, setGame] = useState<LudoState>({
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

  useEffect(() => {
    if (!socket) return;

    const requestState = () => {
      socket.emit('get-ludo-state');
    };

    requestState();
    socket.on('connect', requestState);
    socket.on('ludo-update', (state: LudoState) => {
      if (state) setGame(state);
    });

    return () => {
      socket.off('connect', requestState);
      socket.off('ludo-update');
    };
  }, [socket]);

  const startGame = (count: number) => socket?.emit('ludo-start-game', { playerCount: count });
  const rollDice = () => socket?.emit('ludo-roll-dice');
  const movePiece = (idx: number) => socket?.emit('ludo-move-piece', { pieceIdx: idx });
  const resetGame = () => socket?.emit('ludo-reset');

  if (game.status === 'setup') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#153461] p-4">
        <div className="bg-white border-4 border-black rounded-xl p-8 text-center max-w-sm w-full shadow-2xl">
          <h2 className="text-2xl font-black mb-6 text-neutral-800">Select Players</h2>
          <div className="flex flex-col gap-4">
            <NeoButton colorClass="bg-red-400 text-black" onClick={() => startGame(2)}>2 Players (Red vs Yellow)</NeoButton>
            <NeoButton colorClass="bg-green-400 text-black" onClick={() => startGame(3)}>3 Players</NeoButton>
            <NeoButton colorClass="bg-blue-400 text-black" onClick={() => startGame(4)}>4 Players</NeoButton>
          </div>
        </div>
      </div>
    );
  }

  const getCoordinates = (color: PlayerColor, pos: number, pieceIdx: number) => {
    if (pos === -1) return BASE_COORDS[color][pieceIdx];
    if (pos === 57) return { x: 7, y: 7 };
    if (pos >= 51) return HOME_STRETCH[color][pos - 51];
    return PATH_COORDS[(pos + OFFSETS[color]) % 52];
  };

  const HUDPanel = ({ color, isReversed }: { color: PlayerColor; isReversed?: boolean }) => {
    if (!game.activePlayers.includes(color)) return <div className="w-24 sm:w-32 h-12" />;

    const isTurn = game.turn === color;
    const isMyColor = game.owners[color] === socket?.id;
    const isUnclaimed = game.owners[color] === null;
    const iOwnAnotherColor = (['red', 'green', 'yellow', 'blue'] as PlayerColor[]).some(c => game.owners[c] === socket?.id);
    const canInteract = isTurn && (isMyColor || (isUnclaimed && !iOwnAnotherColor));

    let displayName = `PLAYER ${game.activePlayers.indexOf(color) + 1}`;
    if (isMyColor) displayName = 'YOU';
    else if (isUnclaimed) displayName = (canInteract && isTurn) ? 'CLAIM' : 'WAITING';
    else if (game.owners[color]) displayName = 'PLAYING';

    const [scrambleVal, setScrambleVal] = useState(1);
    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isTurn && game.isRolling) {
        interval = setInterval(() => setScrambleVal(Math.floor(Math.random() * 6) + 1), 80);
      }
      return () => clearInterval(interval);
    }, [isTurn, game.isRolling]);

    return (
      <div className={`flex flex-col gap-1 ${!isReversed ? 'items-end' : ''}`}>
        <div className={`flex items-center gap-1 bg-[#153461] p-1.5 rounded-lg border-2 border-[#5ca4ff] shadow-[0_0_10px_rgba(0,0,0,0.5)] ${isReversed ? 'flex-row-reverse' : ''}`}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#7fb0ff] border-2 border-white rounded flex items-center justify-center p-1 relative">
            <div className="w-5 h-7 sm:w-6 sm:h-8"><MapPinToken color={colorMap[color]} /></div>
          </div>
          <button
            onClick={rollDice}
            disabled={!canInteract || game.hasRolled || game.isRolling}
            className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-100 to-white border-[3px] border-[#d4af37] rounded-md flex items-center justify-center shadow-inner transition-transform ${canInteract && !game.hasRolled && !game.isRolling ? 'animate-pulse scale-105 cursor-pointer ring-2 ring-white' : ''}`}
          >
            {isTurn && game.isRolling ? <DiceFace value={scrambleVal} /> :
              isTurn && game.hasRolled ? <DiceFace value={game.dice} /> :
              (canInteract ? <span className="text-[10px] font-black text-gray-400">ROLL</span> : null)}
          </button>
        </div>
        <span className={`text-[10px] sm:text-xs font-bold text-white uppercase bg-black/50 px-2 py-0.5 rounded ${isMyColor ? 'text-green-300' : ''}`}>
          {displayName}
        </span>
      </div>
    );
  };

  const BaseBox = ({ color, icon }: { color: PlayerColor; icon: 'crown1' | 'crown2' | 'dots' }) => {
    let label = `PLAYER ${game.activePlayers.indexOf(color) + 1}`;
    if (game.owners[color] === socket?.id) label = 'YOU';
    else if (game.owners[color] === null) label = 'WAITING';

    return (
      <div className={`absolute w-[40%] h-[40%] ${bgClassMap[color]} border-[0.5px] border-black flex flex-col items-center justify-between p-1 sm:p-2`}>
        {color === 'green' || color === 'yellow' ? <span className="text-white text-[10px] sm:text-xs font-bold drop-shadow-md z-10">{label}</span> : <div />}

        <div className="w-[70%] h-[70%] bg-white border-2 border-black flex items-center justify-center absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 shadow-inner">
          {icon === 'crown1' && <Crown number="1" />}
          {icon === 'crown2' && <Crown number="2" />}
          {icon === 'dots' && (
            <div className="w-full h-full p-2 grid grid-cols-2 grid-rows-2 gap-2">
              {[1, 2, 3, 4].map(i => <div key={i} className={`w-full h-full rounded-full ${bgClassMap[color]}`} />)}
            </div>
          )}
        </div>

        {color === 'red' || color === 'blue' ? <span className="text-white text-[10px] sm:text-xs font-bold drop-shadow-md z-10">{label}</span> : <div />}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#102a5c] to-[#0a1930] relative overflow-hidden">
      <button onClick={resetGame} className="absolute top-2 right-2 text-white/50 hover:text-white text-xs underline z-50">
        End Game
      </button>

      <div className="w-full max-w-[500px] flex flex-col justify-center px-2 py-4">
        <div className="flex justify-between items-start w-full mb-2 px-1">
          <HUDPanel color="green" />
          <HUDPanel color="yellow" isReversed />
        </div>

        <div className="relative w-full aspect-square bg-white border-4 border-white shadow-2xl">
          {PATH_COORDS.map((coord, idx) => {
            const isSafe = SAFE_ZONES.includes(idx);
            const isStart = [0, 13, 26, 39].includes(idx);
            let bgColor = 'bg-white';
            if (idx === 0) bgColor = bgClassMap.green;
            if (idx === 13) bgColor = bgClassMap.yellow;
            if (idx === 26) bgColor = bgClassMap.blue;
            if (idx === 39) bgColor = bgClassMap.red;

            return (
              <div
                key={`path-${idx}`}
                className={`absolute border-[0.5px] border-black flex items-center justify-center ${bgColor}`}
                style={{ left: `${(coord.x) * (100 / 15)}%`, top: `${(coord.y) * (100 / 15)}%`, width: `${100 / 15}%`, height: `${100 / 15}%` }}
              >
                {isSafe && !isStart && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1" className="w-[80%] h-[80%] opacity-30">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                )}
                {idx === 0 && <span className="text-white font-black text-sm">→</span>}
                {idx === 13 && <span className="text-white font-black text-sm">↓</span>}
                {idx === 26 && <span className="text-white font-black text-sm">←</span>}
                {idx === 39 && <span className="text-white font-black text-sm">↑</span>}
              </div>
            );
          })}

          {(['red', 'green', 'yellow', 'blue'] as const).map(color =>
            HOME_STRETCH[color].map((coord, idx) => (
              <div
                key={`home-${color}-${idx}`}
                className={`absolute border-[0.5px] border-black ${bgClassMap[color]}`}
                style={{ left: `${(coord.x) * (100 / 15)}%`, top: `${(coord.y) * (100 / 15)}%`, width: `${100 / 15}%`, height: `${100 / 15}%` }}
              />
            ))
          )}

          <div className="absolute top-0 left-0" style={{ width: '40%', height: '40%' }}>
            <BaseBox color="green" icon="dots" />
          </div>
          <div className="absolute top-0 right-0" style={{ width: '40%', height: '40%' }}>
            <BaseBox color="yellow" icon="crown1" />
          </div>
          <div className="absolute bottom-0 right-0" style={{ width: '40%', height: '40%' }}>
            <BaseBox color="blue" icon="dots" />
          </div>
          <div className="absolute bottom-0 left-0" style={{ width: '40%', height: '40%' }}>
            <BaseBox color="red" icon="crown2" />
          </div>

          <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] border-[0.5px] border-black overflow-hidden relative">
            <div className="absolute inset-0 bg-[#facc15]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 50%)' }} />
            <div className="absolute inset-0 bg-[#3b82f6]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)' }} />
            <div className="absolute inset-0 bg-[#ef4444]" style={{ clipPath: 'polygon(100% 100%, 0 100%, 50% 50%)' }} />
            <div className="absolute inset-0 bg-[#16a34a]" style={{ clipPath: 'polygon(0 100%, 0 0, 50% 50%)' }} />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[8px] font-black text-white z-10 text-center uppercase drop-shadow-md">Home</div>
          </div>

          {(['red', 'green', 'yellow', 'blue'] as const).map((color) =>
            game.positions[color].map((pos, idx) => {
              if (pos === 57 || !game.activePlayers.includes(color)) return null;

              const { x, y } = getCoordinates(color, pos, idx);
              const isMyColor = game.owners[color] === socket?.id;
              const isSelectable = game.turn === color && game.hasRolled && !game.isRolling;
              const canMove = pos !== -1 || game.dice === 6;
              const isClickable = isSelectable && canMove && isMyColor;

              return (
                <button
                  key={`${color}-${idx}`}
                  onClick={() => isClickable && movePiece(idx)}
                  disabled={!isClickable}
                  className={`absolute w-[6%] h-[8.5%] transform -translate-x-1/2 -translate-y-[80%] transition-all duration-300 ${isClickable ? 'animate-bounce cursor-pointer z-40 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'z-30'}`}
                  style={{ left: `${(x + 0.5) * (100 / 15)}%`, top: `${(y + 0.5) * (100 / 15)}%` }}
                >
                  <MapPinToken color={colorMap[color]} />
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-between items-start w-full mt-2 px-1">
          <HUDPanel color="red" />
          <HUDPanel color="blue" isReversed />
        </div>
      </div>
    </div>
  );
};

export default LudoBoard;
