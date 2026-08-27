import React from 'react';

interface NeoContainerProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const NeoContainer: React.FC<NeoContainerProps> = ({ title, children, className = '' }) => (
  <div className={`border-2 border-dark rounded-neo shadow-neo bg-white overflow-hidden flex flex-col ${className}`}>
    <div className="bg-secondary border-b-2 border-dark p-3 font-bold flex justify-between items-center">
      <span>{title}</span>
      <div className="flex gap-2">
        <div className="w-3 h-3 rounded-full border-2 border-dark bg-primary"></div>
        <div className="w-3 h-3 rounded-full border-2 border-dark bg-accent"></div>
      </div>
    </div>
    <div className="p-4 flex-1">
      {children}
    </div>
  </div>
);