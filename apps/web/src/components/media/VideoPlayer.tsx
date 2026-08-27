// apps/web/src/components/media/VideoPlayer.tsx
'use client';

import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Socket } from 'socket.io-client';

interface VideoPlayerProps {
  socket: Socket | null;
  url: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ socket, url }) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  const isInternalChange = useRef(false); // Prevents infinite sync loops

  useEffect(() => {
    if (!socket) return;

    socket.on('sync-play', (time: number) => {
      isInternalChange.current = true;
      playerRef.current?.seekTo(time, 'seconds');
      setPlaying(true);
    });

    socket.on('sync-pause', (time: number) => {
      isInternalChange.current = true;
      playerRef.current?.seekTo(time, 'seconds');
      setPlaying(false);
    });

    socket.on('sync-seek', (time: number) => {
      isInternalChange.current = true;
      playerRef.current?.seekTo(time, 'seconds');
    });

    return () => {
      socket.off('sync-play');
      socket.off('sync-pause');
      socket.off('sync-seek');
    };
  }, [socket]);

  const handlePlay = () => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    setPlaying(true);
    socket?.emit('video-play', playerRef.current?.getCurrentTime());
  };

  const handlePause = () => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    setPlaying(false);
    socket?.emit('video-pause', playerRef.current?.getCurrentTime());
  };

  const handleSeek = (e: number) => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    socket?.emit('video-seek', e);
  };

  return (
    <div className="w-full aspect-video bg-black rounded-b-neo overflow-hidden">
      <ReactPlayer
        ref={playerRef}
        url={url}
        width="100%"
        height="100%"
        playing={playing}
        controls={true}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
      />
    </div>
  );
};