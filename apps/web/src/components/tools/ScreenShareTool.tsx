'use client';

import React, { useState, useRef } from 'react';
import { NeoButton } from '@/components/ui/NeoButton';

const QUALITY_SETTINGS = {
  low: { width: 854, height: 480, frameRate: 15 },
  medium: { width: 1280, height: 720, frameRate: 30 },
  high: { width: 1920, height: 1080, frameRate: 60 }
};

interface ScreenShareProps {
  onShareStart: (stream: MediaStream) => void;
  onShareStop: () => void;
}

export const ScreenShareTool: React.FC<ScreenShareProps> = ({ onShareStart, onShareStop }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [quality, setQuality] = useState<keyof typeof QUALITY_SETTINGS>('medium');
  const streamRef = useRef<MediaStream | null>(null);

  const startShare = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: QUALITY_SETTINGS[quality].width },
          height: { ideal: QUALITY_SETTINGS[quality].height },
          frameRate: { ideal: QUALITY_SETTINGS[quality].frameRate }
        },
        audio: true 
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      streamRef.current = stream;
      
      setIsSharing(true);
      onShareStart(stream); // Send the stream to the big screen

      // Listen for the native "Stop Sharing" button in the browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopShare();
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const stopShare = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsSharing(false);
    onShareStop(); // Tell the big screen to revert to YouTube
  };

  return (
    <div className="flex flex-col gap-4 w-full col-span-2 md:col-span-4">
      <div className="flex items-center gap-4">
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as keyof typeof QUALITY_SETTINGS)}
          disabled={isSharing}
          className="flex-1 p-3 border-2 border-dark rounded-neo outline-none font-bold bg-white"
        >
          <option value="low">Low Quality (480p, 15fps)</option>
          <option value="medium">Medium Quality (720p, 30fps)</option>
          <option value="high">High Quality (1080p, 60fps)</option>
        </select>
        
        <NeoButton
          colorClass={isSharing ? "bg-primary" : "bg-secondary"}
          onClick={isSharing ? stopShare : startShare}
          className="flex-1"
        >
          {isSharing ? 'Stop Sharing' : 'Share Screen'}
        </NeoButton>
      </div>
    </div>
  );
};