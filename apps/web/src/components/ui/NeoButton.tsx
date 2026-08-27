import React from 'react';

interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  colorClass?: string;
}

export const NeoButton: React.FC<NeoButtonProps> = ({ children, colorClass = "bg-primary", ...props }) => (
  <button
    {...props}
    className={`
      ${colorClass} text-dark font-bold py-3 px-6 
      border-2 border-dark rounded-neo
      shadow-neo hover:-translate-y-1 hover:shadow-neo-lg
      active:translate-y-1 active:shadow-neo-pressed
      ${props.className || ''}
    `}
  >
    {children}
  </button>
);