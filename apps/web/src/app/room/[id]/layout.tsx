import React from 'react';

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="room-wrapper">
      {children}
    </div>
  );
}