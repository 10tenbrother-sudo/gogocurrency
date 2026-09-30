import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showBadge?: boolean;
  isLive?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  showBadge = false,
  isLive = true,
  className = '',
}) => {
  const iconSize = size === 'sm' ? 26 : size === 'lg' ? 38 : 30;

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Bespoke Geometric Currency Flow Emblem */}
      <div
        className="relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.18)]"
        style={{
          width: iconSize,
          height: iconSize,
          background: 'linear-gradient(135deg, #181C28 0%, #0E1119 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Subtle inner radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.18),transparent_70%)] pointer-events-none" />

        {/* Precision Dual-Vector Flow SVG (Capital Inflow / Outflow Disparity) */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 w-[72%] h-[72%]"
        >
          <defs>
            {/* Primary Emerald Inflow Vector Gradient */}
            <linearGradient id="flowEmerald" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="60%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#6EE7B7" />
            </linearGradient>

            {/* Secondary Titanium Outflow Vector Gradient */}
            <linearGradient id="flowTitanium" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#10B981" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Upward Bullish Inflow Vector (Rising Momentum Arrow) */}
          <path
            d="M7 21L17 11L21 15L27 9"
            stroke="url(#flowEmerald)"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
          {/* Arrowhead Bullish */}
          <path
            d="M21 9H27V15"
            stroke="url(#flowEmerald)"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Converging Relative Strength Vector (Cross-flow bar) */}
          <path
            d="M5 11L11 17L15 13L25 23"
            stroke="url(#flowTitanium)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.85"
          />

          {/* Focal Convergence Point (Anchor Node) */}
          <circle cx="16" cy="14" r="1.75" fill="#6EE7B7" />
        </svg>
      </div>

      {/* Typography Lockup */}
      {showText && (
        <div className="flex items-center gap-2">
          <div className="leading-tight">
            <span
              className={`font-bold tracking-tight text-white ${
                size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm'
              }`}
            >
              Currency<span className="text-emerald-400 font-extrabold ml-1">Strength</span>
            </span>
          </div>

          {/* Optional Sleek Live Badge */}
          {showBadge && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase flex items-center gap-1.5 transition-all ${
                isLive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                }`}
              />
              <span>{isLive ? 'LIVE' : 'PAUSED'}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
