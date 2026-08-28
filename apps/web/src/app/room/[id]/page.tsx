'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useSocket } from '@/hooks/useSocket';
import { NeoContainer } from '@/components/ui/NeoContainer';
import { NeoButton } from '@/components/ui/NeoButton';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import LudoBoard from '@/components/games/LudoBoard';

export default function RoomPage({ params }: { params: { roomId?: string; id?: string } }) {
  const router = useRouter();
  const roomId = params?.roomId || params?.id || '';
  const [isMounted, setIsMounted] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.displayName || user.email?.split('@')[0] || 'Player');
        setIsMounted(true);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const socket = useSocket(roomId, username);

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeMedia, setActiveMedia] = useState<'youtube' | 'screenshare' | 'ludo'>('youtube');
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [urlInput, setUrlInput] = useState('');

  const [isSharing, setIsSharing] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const localScreenVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenImgRef = useRef<HTMLImageElement>(null);

  const [isCamOn, setIsCamOn] = useState(false);
  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);
  const localCamVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteCameras, setRemoteCameras] = useState<string[]>([]);
  const lastCamFrames = useRef<Record<string, string>>({});

  const [isMicOn, setIsMicOn] = useState(false);
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [screenRes, setScreenRes] = useState<number>(1080);
  const [screenFps, setScreenFps] = useState<number>(30);

  useEffect(() => {
    if (!socket) return;

    socket.on('receive-message', (msg) => setMessages((prev) => [...prev, msg]));
    socket.on('notification', (text) => setMessages((prev) => [...prev, { sender: 'System', text }]));
    socket.on('sync-url', (newUrl) => { setVideoUrl(newUrl); setActiveMedia('youtube'); });

    socket.on('receive-camera-frame', ({ sender, frame }) => {
      lastCamFrames.current[sender] = frame;
      setRemoteCameras((prev) => (!prev.includes(sender) ? [...prev, sender] : prev));
      const img = document.getElementById(`cam-${sender}`) as HTMLImageElement;
      if (img) img.src = frame;
    });

    socket.on('receive-screen-frame', (frame) => {
      setActiveMedia('screenshare');
      if (remoteScreenImgRef.current) remoteScreenImgRef.current.src = frame;
    });

    socket.on('receive-audio-chunk', ({ chunk }) => {
      const blob = new Blob([chunk], { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().catch(e => console.warn('Audio autoplay blocked', e));
    });

    socket.on('share-stopped', () => setActiveMedia('youtube'));
    socket.on('user-camera-stopped', (userId) => setRemoteCameras((prev) => prev.filter(id => id !== userId)));
    socket.on('user-disconnected', (userId) => setRemoteCameras((prev) => prev.filter(id => id !== userId)));

    return () => {
      socket.off('receive-message');
      socket.off('notification');
      socket.off('sync-url');
      socket.off('receive-camera-frame');
      socket.off('receive-screen-frame');
      socket.off('receive-audio-chunk');
      socket.off('share-stopped');
      socket.off('user-camera-stopped');
      socket.off('user-disconnected');
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isCamOn && localCamVideoRef.current && localCamStream) {
      localCamVideoRef.current.srcObject = localCamStream;
    }
  }, [isCamOn, localCamStream]);

  useEffect(() => {
    if (!isCamOn || !socket) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const interval = setInterval(() => {
      const video = localCamVideoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        socket.emit('camera-frame', canvas.toDataURL('image/jpeg', 0.4));
      }
    }, 150);
    return () => clearInterval(interval);
  }, [isCamOn, socket]);

  const toggleScreenShare = async () => {
    if (isSharing) {
      localScreenStream?.getTracks().forEach(t => t.stop());
      setLocalScreenStream(null);
      setIsSharing(false);
      setActiveMedia('youtube');
      socket?.emit('stop-share');
    } else {
      try {
        const calcWidth = Math.floor((screenRes * 16) / 9);
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: calcWidth }, height: { ideal: screenRes }, frameRate: { ideal: screenFps } }
        });

        setLocalScreenStream(stream);
        setIsSharing(true);
        setActiveMedia('screenshare');

        if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = stream;

        const videoEl = document.createElement('video');
        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.playsInline = true;
        await videoEl.play();

        const canvas = document.createElement('canvas');
        canvas.width = calcWidth;
        canvas.height = screenRes;
        const ctx = canvas.getContext('2d');
        const captureInterval = Math.floor(1000 / screenFps);

        const interval = setInterval(() => {
          if (!stream.active) {
            clearInterval(interval);
            setIsSharing(false);
            setActiveMedia('youtube');
            socket?.emit('stop-share');
            return;
          }
          if (ctx && videoEl.videoWidth) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            socket?.emit('screen-frame', canvas.toDataURL('image/jpeg', 0.6));
          }
        }, captureInterval);

        stream.getVideoTracks()[0].onended = () => {
          clearInterval(interval);
          setIsSharing(false);
          setActiveMedia('youtube');
          socket?.emit('stop-share');
        };
      } catch (err) {
        console.error('Screen share error', err);
      }
    }
  };

  const toggleCamera = async () => {
    if (isCamOn) {
      localCamStream?.getTracks().forEach(t => t.stop());
      setLocalCamStream(null);
      setIsCamOn(false);
      socket?.emit('camera-stopped');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setLocalCamStream(stream);
        setIsCamOn(true);
      } catch (err) {
        alert('Could not access camera.');
      }
    }
  };

  const toggleMic = async () => {
    if (isMicOn) {
      mediaRecorderRef.current?.stop();
      localMicStream?.getTracks().forEach(t => t.stop());
      setLocalMicStream(null);
      setIsMicOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalMicStream(stream);
        setIsMicOn(true);

        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket) {
            socket.emit('audio-chunk', e.data);
          }
        };
        recorder.start(300);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        alert('Could not access microphone.');
      }
    }
  };

  const toggleLudo = () => setActiveMedia(activeMedia === 'ludo' ? 'youtube' : 'ludo');

  useEffect(() => {
    return () => {
      localCamStream?.getTracks().forEach(t => t.stop());
      localScreenStream?.getTracks().forEach(t => t.stop());
      localMicStream?.getTracks().forEach(t => t.stop());
    };
  }, [localCamStream, localScreenStream, localMicStream]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && socket) {
      socket.emit('send-message', chatInput);
      setChatInput('');
    }
  };

  const handleLoadVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      setVideoUrl(urlInput);
      setActiveMedia('youtube');
      if (socket) socket.emit('change-url', urlInput);
      setUrlInput('');
    }
  };

  if (!isMounted) return <main className="min-h-screen p-6 md:p-12 flex flex-col xl:flex-row gap-6"></main>;

  return (
    <main className="min-h-screen p-6 md:p-12 flex flex-col xl:flex-row gap-6 bg-[#F4EBE1]">
      <div className="flex-1 flex flex-col gap-6">
        <NeoContainer title={`Room: ${roomId} | Big Screen`}>
          <form onSubmit={handleLoadVideo} className="flex gap-2 mb-4">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste YouTube link here to watch together..."
              className="flex-1 p-2 border-2 border-dark rounded-neo outline-none"
            />
            <NeoButton colorClass="bg-accent py-2 px-4" type="submit">Play Video</NeoButton>
          </form>

          <div className="w-full aspect-video bg-black rounded-neo border-2 border-dark flex items-center justify-center relative overflow-hidden">
            <div className={`w-full h-full ${activeMedia === 'youtube' ? 'block' : 'hidden'}`}>
              <VideoPlayer socket={socket} url={videoUrl} />
            </div>

            <video
              ref={localScreenVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${activeMedia === 'screenshare' && isSharing ? 'block' : 'hidden'}`}
            />
            <img
              ref={remoteScreenImgRef}
              className={`w-full h-full object-contain ${activeMedia === 'screenshare' && !isSharing ? 'block' : 'hidden'}`}
              alt="Screen Share"
            />

            {activeMedia === 'ludo' && (
              <div className="w-full h-full absolute inset-0 z-10 bg-white">
                <LudoBoard socket={socket} />
              </div>
            )}
          </div>
        </NeoContainer>

        <NeoContainer title="Apps & Games">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-center">
            <select
              value={screenRes}
              onChange={(e) => setScreenRes(Number(e.target.value))}
              className="p-2 border-2 border-dark rounded-neo outline-none bg-white text-sm font-bold"
              disabled={isSharing}
            >
              <option value={480}>480p</option>
              <option value={720}>720p</option>
              <option value={1080}>1080p</option>
              <option value={1440}>1440p</option>
              <option value={2160}>2160p</option>
            </select>

            <select
              value={screenFps}
              onChange={(e) => setScreenFps(Number(e.target.value))}
              className="p-2 border-2 border-dark rounded-neo outline-none bg-white text-sm font-bold"
              disabled={isSharing}
            >
              <option value={15}>15 FPS</option>
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
            </select>

            <NeoButton colorClass={isSharing ? 'bg-primary' : 'bg-secondary'} onClick={toggleScreenShare}>
              {isSharing ? 'Stop Share' : 'Share Screen'}
            </NeoButton>

            <NeoButton colorClass={isCamOn ? 'bg-primary' : 'bg-white'} onClick={toggleCamera}>
              {isCamOn ? 'Camera Off' : 'Camera On'}
            </NeoButton>

            <NeoButton colorClass={isMicOn ? 'bg-primary' : 'bg-white'} onClick={toggleMic}>
              {isMicOn ? 'Mute Mic' : 'Unmute Mic'}
            </NeoButton>

            <NeoButton colorClass={activeMedia === 'ludo' ? 'bg-primary' : 'bg-accent'} onClick={toggleLudo}>
              {activeMedia === 'ludo' ? 'Close Ludo' : 'Ludo'}
            </NeoButton>

            <NeoButton colorClass="bg-primary">Chess</NeoButton>
          </div>
        </NeoContainer>
      </div>

      <div className="w-full xl:w-96 flex flex-col gap-6">
        {(isCamOn || remoteCameras.length > 0) && (
          <NeoContainer title="Cameras" className="shrink-0">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {isCamOn && (
                <div className="relative w-28 h-28 shrink-0 rounded-neo border-2 border-dark overflow-hidden bg-black shadow-neo-pressed">
                  <video ref={localCamVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                  <span className="absolute bottom-1 left-1 bg-dark text-white text-[10px] px-2 py-0.5 rounded-sm font-bold">You</span>
                </div>
              )}
              {remoteCameras.map((sender) => (
                <div key={sender} className="relative w-28 h-28 shrink-0 rounded-neo border-2 border-dark overflow-hidden bg-black shadow-neo-pressed">
                  <img id={`cam-${sender}`} src={lastCamFrames.current[sender] || ''} className="w-full h-full object-cover transform scale-x-[-1]" alt="Peer" />
                  <span className="absolute bottom-1 left-1 bg-dark text-white text-[10px] px-2 py-0.5 rounded-sm font-bold">Peer</span>
                </div>
              ))}
            </div>
          </NeoContainer>
        )}

        <NeoContainer title="Party Chat" className="flex-1 min-h-[400px] flex flex-col">
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {messages.map((m, i) => (
              <div key={i} className={`p-2 rounded-lg border-2 border-dark ${m.sender === 'System' ? 'bg-accent/50 text-sm font-bold' : 'bg-bgBase'}`}>
                <strong className="block text-xs text-primary">{m.sender}</strong>
                <span className="text-sm">{m.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="mt-4 flex gap-2 border-t-2 border-dark pt-4">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-2 border-2 border-dark rounded-neo outline-none"
            />
            <NeoButton colorClass="bg-secondary" type="submit">Send</NeoButton>
          </form>
        </NeoContainer>
      </div>
    </main>
  );
}
