import React from 'react';
import { MarketSession } from '../types/forex';
import { Globe, Clock } from 'lucide-react';

interface MarketSessionsProps {
  sessions: MarketSession[];
  theme?: 'dark' | 'light';
}

export const MarketSessions: React.FC<MarketSessionsProps> = ({ sessions, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  return (
    <div className="w-full bg-white dark:bg-[#0D1017] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-xs transition-colors">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
            Forex Trading Sessions & Volatility Windows
          </h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
          Likuiditas puncak saat tumpang tindih London & New York (12:00 – 16:00 UTC / 19:00 – 23:00 WIB)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sessions.map((session) => {
          const isOverlapPeak = session.isOpen && session.volatility === 'Peak';

          return (
            <div
              key={session.name}
              className={`p-3.5 rounded-xl border transition-all ${
                session.isOpen
                  ? isOverlapPeak
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-slate-50 border-slate-200 dark:bg-[#10121A] dark:border-white/[0.06] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      session.isOpen
                        ? isOverlapPeak
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-emerald-500 animate-pulse'
                        : 'bg-slate-400 dark:bg-zinc-600'
                    }`}
                  />
                  <span className="font-semibold text-sm text-slate-900 dark:text-zinc-200">
                    {session.name}
                  </span>
                </div>

                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                    session.isOpen
                      ? isOverlapPeak
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold'
                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700'
                  }`}
                >
                  {session.isOpen ? 'BUKA' : 'TUTUP'}
                </span>
              </div>

              {/* Hours in UTC */}
              <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400 mb-2">
                <span>Jam Sesi (UTC):</span>
                <span className="text-slate-800 dark:text-zinc-200 font-medium">
                  {String(session.openUtc).padStart(2, '0')}:00 -{' '}
                  {String(session.closeUtc).padStart(2, '0')}:00
                </span>
              </div>

              {/* Status & countdown */}
              <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span>Volatilitas:</span>
                </div>
                <span
                  className={`font-semibold ${
                    session.volatility === 'Peak'
                      ? 'text-amber-400'
                      : session.volatility === 'High'
                      ? 'text-emerald-400'
                      : 'text-zinc-400'
                  }`}
                >
                  {session.volatility}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
