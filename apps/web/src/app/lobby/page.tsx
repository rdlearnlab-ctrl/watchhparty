'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { NeoContainer } from '@/components/ui/NeoContainer';
import { NeoButton } from '@/components/ui/NeoButton';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export default function LobbyPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>('Player');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [publicRooms, setPublicRooms] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.displayName || user.email?.split('@')[0] || 'Player');
      } else {
        router.push('/login');
      }
    });

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.emit('get-public-rooms');
    newSocket.on('public-rooms-list', (rooms: string[]) => {
      setPublicRooms(rooms);
    });

    return () => {
      unsubscribe();
      newSocket.disconnect();
    };
  }, [router]);

  const handleCreateRoom = (isPublic: boolean) => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    socket?.emit('create-room', newRoomId, isPublic);
    router.push(`/room/${newRoomId}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomIdInput.trim()) {
      router.push(`/room/${roomIdInput.trim()}`);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <main className="min-h-screen p-6 md:p-12 flex flex-col items-center bg-bgBase">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-dark">Welcome, {username}!</h1>
        <NeoButton colorClass="bg-red-400 py-2 px-4 text-sm" onClick={handleSignOut}>
          Sign Out
        </NeoButton>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-6">
          <NeoContainer title="Create a Room">
            <div className="flex flex-col gap-4">
              <NeoButton colorClass="bg-primary py-3" onClick={() => handleCreateRoom(true)}>
                Create Public Room
              </NeoButton>
              <NeoButton colorClass="bg-secondary py-3" onClick={() => handleCreateRoom(false)}>
                Create Private Room
              </NeoButton>
            </div>
          </NeoContainer>

          <NeoContainer title="Join Private Room">
            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                placeholder="Enter Room Code..."
                className="flex-1 p-2 border-2 border-dark rounded-neo outline-none"
              />
              <NeoButton colorClass="bg-accent py-2 px-4" type="submit">Join</NeoButton>
            </form>
          </NeoContainer>
        </div>

        <NeoContainer title="Active Public Rooms" className="h-[400px] overflow-y-auto">
          {publicRooms.length === 0 ? (
            <p className="text-dark/50 text-center mt-10 font-bold">No public rooms available right now.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {publicRooms.map((room) => (
                <div key={room} className="p-4 border-2 border-dark rounded-neo bg-white flex justify-between items-center">
                  <span className="font-bold">Room: {room}</span>
                  <NeoButton colorClass="bg-primary py-1 px-4 text-xs" onClick={() => router.push(`/room/${room}`)}>
                    Join
                  </NeoButton>
                </div>
              ))}
            </div>
          )}
        </NeoContainer>
      </div>
    </main>
  );
}