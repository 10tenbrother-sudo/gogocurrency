import React, { useState, useEffect } from 'react';
import { TimeframeKey } from '../types/forex';
import { TIMEFRAME_CONFIGS, getNext5MinuteCandleSeconds } from '../services/currencyStrengthEngine';
import { Zap, Target, TrendingUp, Clock, Info } from 'lucide-react';

interface TimeframeSelectorProps {
  activeTimeframe: TimeframeKey;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  className?: string;
  showCountdown?: boolean;
}

export const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({
  activeTimeframe,
  onChangeTimeframe,
  className = '',
  showCountdown = true,
}) => {
  const currentConfig = TIMEFRAME_CONFIGS[activeTimeframe];
  const [candleClock, setCandleClock] = useState(() => getNext5MinuteCandleSeconds());

  // Update 5-minute candle close countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCandleClock(getNext5MinuteCandleSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const categories = [
    {
      id: 'scalp',
      name: 'Scalp',
      fullName: 'Scalping (5-15m)',
      icon: Zap,
      timeframes: ['5M', '10M', '15M'] as TimeframeKey[],
      badgeColor: 'text-amber-500 dark:text-amber-400',
      activeRing: 'border-amber-400/40 text-amber-600 dark:text-amber-300',
      description: 'Update per 5 menit • Cek momentum 5m, 10m, atau 15m',
    },
    {
      id: 'intraday',
      name: 'Intraday',
      fullName: 'Intraday (1-3 Jam)',
      icon: Target,
      timeframes: ['1H', '2H', '3H'] as TimeframeKey[],
      badgeColor: 'text-cyan-500 dark:text-cyan-400',
      activeRing: 'border-cyan-400/40 text-cyan-600 dark:text-cyan-300',
      description: 'Tren pergerakan sesi 1 jam, 2 jam, dan 3 jam',
    },
    {
      id: 'swing',
      name: 'Swing',
      fullName: 'Swing (4-8 Jam & 1D)',
      icon: TrendingUp,
      timeframes: ['4H', '6H', '8H', '1D'] as TimeframeKey[],
      badgeColor: 'text-emerald-500 dark:text-emerald-400',
      activeRing: 'border-emerald-400/40 text-emerald-600 dark:text-emerald-300',
      description: 'Gelombang swing 4 jam, 6 jam, 8 jam, dan harian 1D',
    },
  ];

  const isScalping = activeTimeframe === '5M' || activeTimeframe === '10M' || activeTimeframe === '15M';

  return (
    <div className={`flex flex-col xl:flex-row xl:items-center gap-2 select-none ${className}`}>
      {/* Segmented Button Groups */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#0E1119] border border-slate-200 dark:border-white/[0.08] rounded-xl self-start sm:self-auto overflow-x-auto scrollbar-none shadow-xs transition-colors">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          const isCategoryActive = cat.timeframes.includes(activeTimeframe);

          return (
            <div key={cat.id} className="flex items-center">
              {idx > 0 && <div className="w-px h-5 bg-slate-300 dark:bg-white/[0.08] mx-1 sm:mx-1.5" />}

              <div className="flex items-center gap-0.5 sm:gap-1">
                {/* Category label indicator */}
                <div
                  title={cat.description}
                  className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider font-semibold ${
                    isCategoryActive ? cat.badgeColor : 'text-slate-400 dark:text-zinc-600'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{cat.name}</span>
                </div>

                {/* Timeframe Buttons */}
                {cat.timeframes.map((tf) => {
                  const isActive = activeTimeframe === tf;
                  const cfg = TIMEFRAME_CONFIGS[tf];

                  return (
                    <button
                      key={tf}
                      onClick={() => onChangeTimeframe(tf)}
                      title={`${cfg.categoryLabel} (${tf} - ${cfg.minutes < 60 ? `${cfg.minutes} Menit` : `${cfg.minutes / 60} Jam`}): ${cfg.description}`}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold border border-slate-300 dark:border-white/20 shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      {tf}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scalp 5-Minute Candle Clock & Update Status */}
      {showCountdown && (
        <div
          title="Data Currency Strength diperbarui per interval 5 menit (:00, :05, :10, dst). Scalping mengecek perubahan kekuatan pada setiap waktu yang dipilih."
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors self-start xl:self-auto ${
            isScalping
              ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-400/40 text-amber-700 dark:text-amber-300'
              : 'bg-slate-100 dark:bg-zinc-900/60 border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isScalping ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isScalping ? 'bg-amber-500' : 'bg-cyan-500'
                }`}
              />
            </span>
            <span className="text-[11px] font-semibold">
              {isScalping ? `Scalp ${activeTimeframe}` : activeTimeframe}
            </span>
          </div>

          <span className="text-slate-300 dark:text-white/20">|</span>

          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 opacity-70" />
            <span className="text-[11px] font-bold tracking-wider">
              {candleClock.formatted}
            </span>
            <span className="text-[10px] opacity-75 hidden md:inline">
              (Bar 5m)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

