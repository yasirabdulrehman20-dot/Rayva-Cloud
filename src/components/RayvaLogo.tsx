import React, { useState } from 'react';
import rayvaLogo from '../assets/images/rayva_favicon_logo_1786891508680.jpg';

interface RayvaLogoProps {
  className?: string;
  size?: number;
}

export const RayvaLogo: React.FC<RayvaLogoProps> = ({ className = 'h-7 w-auto', size = 28 }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`bg-[#0A0B0E] border border-[#38BDF8]/40 rounded-lg flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(56,189,248,0.2)] ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 64 64" className="w-4/5 h-4/5" fill="none">
          <defs>
            <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="rGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>
          {/* Cloud Outline */}
          <path
            d="M 18 43 C 12.5 43 9 38.5 9 33.5 C 9 28.5 13 24.8 17.8 24.2 C 19.5 17.5 25.5 13 32.5 13 C 40 13 46 17.8 47.5 24.8 C 51.5 25.8 55 29.5 55 34.5 C 55 40 50.5 43 45 43 Z"
            stroke="url(#cloudGrad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Stylized 'R' Inside Cloud */}
          <line x1="26" y1="22" x2="26" y2="37" stroke="url(#rGrad)" strokeWidth="3.2" strokeLinecap="round" />
          <path
            d="M 26 22 L 33.5 22 C 37 22 39 24 39 27 C 39 30 37 32 33.5 32 L 26 32"
            stroke="url(#rGrad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1="32.5" y1="32" x2="38.5" y2="37" stroke="url(#rGrad)" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="45" cy="34" r="1.5" fill="#38BDF8" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={rayvaLogo}
      alt="Rayva Cloud Logo"
      onError={() => setHasError(true)}
      className={`object-cover rounded-lg border border-[#38BDF8]/30 shadow-[0_0_10px_rgba(56,189,248,0.2)] shrink-0 ${className}`}
      style={{ height: `${size}px`, width: `${size}px` }}
      referrerPolicy="no-referrer"
    />
  );
};


