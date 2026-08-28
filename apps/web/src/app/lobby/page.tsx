'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const BACKEND_URL = 'https://watchparty-wqd2.onrender.com';

interface PublicRoom {
  roomId: string;
  userCount: number;
}

export default function LobbyPage() {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState('Guest');
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [privateCode, setPrivateCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.displayName || user.email?.split('@')[0] || 'Guest');
      } else {
        router.push('/login');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const socketIo = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
    });

    setSocket(socketIo);

    socketIo.on('connect', () => {
      socketIo.emit('get-public-rooms');
    });

    socketIo.on('public-rooms-update', (rooms: PublicRoom[]) => {
      setPublicRooms(rooms);
    });

    return () => {
      socketIo.disconnect();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleCreateRoom = (isPublic: boolean) => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    if (socket) {
      socket.emit('create-room', { roomId: newRoomId, isPublic });
    }
    router.push(`/room/${newRoomId}`);
  };

  const handleJoinPrivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (privateCode.trim()) {
      router.push(`/room/${privateCode.trim()}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4EBE1] flex items-center justify-center">
        <div className="bg-[#66C6BA] border-4 border-black p-6 rounded-2xl shadow-[6px_6px_0px_0px_#000] font-black text-xl">
          Loading Lobby...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4EBE1] p-4 md:p-10 flex flex-col justify-center items-center text-neutral-900 selection:bg-[#FFE66D]">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* Top App Header */}
        <header className="bg-white border-4 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FFE66D] border-3 border-black rounded-xl flex items-center justify-center text-2xl shadow-[2px_2px_0px_0px_#000]">
              🍿
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                  Welcome, <span className="text-[#FF6B6B]">{username}</span>!
                </h1>
                <span className="bg-[#4ECDC4] border-2 border-black px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase shadow-[1px_1px_0px_0px_#000]">
                  Online
                </span>
              </div>
              <p className="text-xs font-bold text-neutral-500">Pick an active room or start a new party</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="px-5 py-2.5 bg-[#FF6B6B] hover:bg-[#ff5252] border-3 border-black rounded-xl font-black text-sm tracking-wide shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000] transition-all"
          >
            Sign Out
          </button>
        </header>

        {/* Main Grid: Create & Active Rooms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Create Room Container */}
          <div className="bg-[#66C6BA] border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_#000] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-5 border-b-3 border-black">
                <h2 className="text-xl font-black flex items-center gap-2">
                  <span>⚡</span> Create a Room
                </h2>
                <div className="flex gap-1.5">
                  <div className="w-3.5 h-3.5 bg-[#FF6B6B] border-2 border-black rounded-full" />
                  <div className="w-3.5 h-3.5 bg-[#FFE66D] border-2 border-black rounded-full" />
                </div>
              </div>

              <p className="text-xs font-bold text-neutral-800 mb-4 leading-relaxed">
                Host a watch session, play Ludo with friends, or screen share in real-time.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleCreateRoom(true)}
                className="w-full py-3.5 bg-[#FF6B6B] hover:bg-[#ff5555] border-3 border-black rounded-xl font-black text-sm tracking-wide shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all flex items-center justify-center gap-2"
              >
                <span>🌐</span> Create Public Room
              </button>
              
              <button
                onClick={() => handleCreateRoom(false)}
                className="w-full py-3.5 bg-[#FFE66D] hover:bg-[#ffd93d] border-3 border-black rounded-xl font-black text-sm tracking-wide shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all flex items-center justify-center gap-2"
              >
                <span>🔒</span> Create Private Room
              </button>
            </div>
          </div>

          {/* Active Public Rooms Container */}
          <div className="bg-[#66C6BA] border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_#000] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-3 border-black">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">🔥 Active Public Rooms</h2>
                <span className="bg-white border-2 border-black px-2 py-0.5 rounded-full text-xs font-black">
                  {publicRooms.length}
                </span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-3.5 h-3.5 bg-[#FF6B6B] border-2 border-black rounded-full" />
                <div className="w-3.5 h-3.5 bg-[#FFE66D] border-2 border-black rounded-full" />
              </div>
            </div>

            <div className="bg-white border-3 border-black rounded-xl p-3 flex-1 min-h-[190px] max-h-[220px] overflow-y-auto space-y-2">
              {publicRooms.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-6 text-neutral-400">
                  <span className="text-3xl mb-1">🏖️</span>
                  <p className="text-xs font-black">No public rooms active.</p>
                  <p className="text-[11px] font-bold">Be the first to create one!</p>
                </div>
              ) : (
                publicRooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="flex items-center justify-between p-2.5 bg-[#F4EBE1] hover:bg-[#ece2d6] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-green-500 border border-black rounded-full animate-pulse" />
                      <div>
                        <span className="font-mono text-xs font-black block">#{room.roomId}</span>
                        <span className="text-[10px] font-bold text-neutral-600">{room.userCount} player{room.userCount === 1 ? '' : 's'} online</span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/room/${room.roomId}`)}
                      className="px-4 py-1.5 bg-[#4ECDC4] hover:bg-[#3dbdb4] border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#000] transition-all"
                    >
                      Join →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Join Private Room Footer Bar */}
        <div className="bg-[#66C6BA] border-4 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000]">
          <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-black">
            <h2 className="text-lg font-black flex items-center gap-2">
              <span>🔑</span> Join with Code
            </h2>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 bg-[#FF6B6B] border-2 border-black rounded-full" />
              <div className="w-3 h-3 bg-[#FFE66D] border-2 border-black rounded-full" />
            </div>
          </div>

          <form onSubmit={handleJoinPrivate} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Paste 7-character room code (e.g. 7yr4diu)..."
              value={privateCode}
              onChange={(e) => setPrivateCode(e.target.value)}
              className="flex-1 px-4 py-3 bg-white border-3 border-black rounded-xl font-mono text-sm font-bold placeholder:font-sans placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="submit"
              className="px-8 py-3 bg-[#FFE66D] hover:bg-[#ffd93d] border-3 border-black rounded-xl font-black text-sm tracking-wide shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all flex items-center justify-center gap-2 shrink-0"
            >
              Enter Room
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
