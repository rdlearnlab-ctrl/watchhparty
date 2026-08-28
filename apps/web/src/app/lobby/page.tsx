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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.displayName || user.email?.split('@')[0] || 'Guest');
      } else {
        router.push('/login');
      }
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

  return (
    <div className="min-h-screen bg-[#F4EBE1] p-8 text-neutral-800">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Title and Sign Out Button */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black">Welcome, {username}!</h1>
          <button
            onClick={handleSignOut}
            className="px-5 py-2 bg-[#FF6B6B] hover:bg-[#ff5252] border-2 border-black rounded-xl font-bold shadow-[2px_2px_0px_0px_#000] transition active:translate-x-[1px] active:translate-y-[1px]"
          >
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Room */}
          <div className="bg-[#66C6BA] border-2 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_#000]">
            <h2 className="text-xl font-bold mb-4">Create a Room</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleCreateRoom(true)}
                className="w-full py-3 bg-[#FF6B6B] hover:bg-[#ff5252] border-2 border-black rounded-xl font-bold transition shadow-[2px_2px_0px_0px_#000]"
              >
                Create Public Room
              </button>
              <button
                onClick={() => handleCreateRoom(false)}
                className="w-full py-3 bg-[#4ECDC4] hover:bg-[#3dbdb4] border-2 border-black rounded-xl font-bold transition shadow-[2px_2px_0px_0px_#000]"
              >
                Create Private Room
              </button>
            </div>
          </div>

          {/* Active Public Rooms */}
          <div className="bg-[#66C6BA] border-2 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_#000]">
            <h2 className="text-xl font-bold mb-4">Active Public Rooms</h2>
            <div className="bg-white border-2 border-black rounded-xl p-4 min-h-[160px] max-h-[220px] overflow-y-auto">
              {publicRooms.length === 0 ? (
                <p className="text-neutral-500 text-center py-8 text-sm">
                  No public rooms available right now.
                </p>
              ) : (
                <div className="space-y-2">
                  {publicRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="flex items-center justify-between p-2 bg-neutral-100 border border-black rounded-lg"
                    >
                      <span className="font-mono text-sm font-semibold">
                        Room: {room.roomId} ({room.userCount} online)
                      </span>
                      <button
                        onClick={() => router.push(`/room/${room.roomId}`)}
                        className="px-3 py-1 bg-[#FFE66D] hover:bg-[#ffd93d] border border-black rounded-md text-xs font-bold shadow-[1px_1px_0px_0px_#000]"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Join Private Room */}
        <div className="bg-[#66C6BA] border-2 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_#000]">
          <h2 className="text-xl font-bold mb-4">Join Private Room</h2>
          <form onSubmit={handleJoinPrivate} className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Room Code..."
              value={privateCode}
              onChange={(e) => setPrivateCode(e.target.value)}
              className="flex-1 px-4 py-2 border-2 border-black rounded-xl outline-none"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-[#FFE66D] hover:bg-[#ffd93d] border-2 border-black rounded-xl font-bold shadow-[2px_2px_0px_0px_#000]"
            >
              Join
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
