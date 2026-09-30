import React from 'react';
import { CurrencyCode, CurrencyStrengthScore, TimeframeKey } from '../types/forex';
import { CURRENCIES, formatScore, TIMEFRAME_CONFIGS } from '../services/currencyStrengthEngine';

interface CurrencyStandingsBarProps {
  rankings: CurrencyStrengthScore[];
  selectedCurrencies: Set<CurrencyCode>;
  onToggleCurrency: (code: CurrencyCode) => void;
  onSoloCurrency: (code: CurrencyCode) => void;
  focusedCurrency: CurrencyCode | null;
  timeframe?: TimeframeKey;
  theme?: 'dark' | 'light';
}

export const CurrencyStandingsBar: React.FC<CurrencyStandingsBarProps> = ({
  rankings,
  selectedCurrencies,
  onToggleCurrency,
  onSoloCurrency,
  focusedCurrency,
  timeframe = '1H',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const strongest = rankings[0];
  const weakest = rankings[rankings.length - 1];
  const maxSpread = strongest && weakest ? (strongest.score - weakest.score).toFixed(2) : '0.00';
  const tfConfig = TIMEFRAME_CONFIGS[timeframe];

  return (
    <div
      className={`w-full rounded-xl p-3.5 space-y-3 transition-colors duration-200 border ${
        isDark
          ? 'bg-[#11141D] border-white/[0.08] text-white'
          : 'bg-white border-zinc-200 text-zinc-900 shadow-xs'
      }`}
    >
      {/* Top Meta Header: Clean, Unboxed Typography */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className={`font-semibold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Klasemen Kekuatan Mata Uang
          </span>
          <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'} aria-hidden="true">·</span>
          <span
            className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase border ${
              isDark
                ? 'bg-zinc-800 text-zinc-300 border-white/[0.08]'
                : 'bg-zinc-100 text-zinc-700 border-zinc-300'
            }`}
          >
            {tfConfig.categoryLabel} ({timeframe})
          </span>
          <span className={`${isDark ? 'text-zinc-600' : 'text-zinc-400'} hidden sm:inline`} aria-hidden="true">·</span>
          <span className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'} font-mono text-[11px] hidden sm:inline`}>
            Skala 0.00 – 10.00
          </span>
        </div>

        <div className={`flex items-center gap-3 text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          <span>
            Terkuat: <strong className="text-emerald-500 font-medium">{strongest?.code} ({formatScore(strongest?.score)})</strong>
          </span>
          <span className={isDark ? 'text-zinc-700' : 'text-zinc-300'} aria-hidden="true">·</span>
          <span>
            Terlemah: <strong className="text-rose-500 font-medium">{weakest?.code} ({formatScore(weakest?.score)})</strong>
          </span>
          <span className={`${isDark ? 'text-zinc-700' : 'text-zinc-300'} hidden md:inline`} aria-hidden="true">·</span>
          <span className={`hidden md:inline ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
            Spread Δ{maxSpread}
          </span>
        </div>
      </div>

      {/* 8 Currencies Ribbon: Responsive & Unified Across All Devices */}
      <div className="grid grid-flow-col auto-cols-[110px] sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-4 lg:grid-cols-8 gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none snap-x">
        {rankings.map((item) => {
          const conf = CURRENCIES[item.code];
          const isSelected = selectedCurrencies.has(item.code);
          const isFocused = focusedCurrency === item.code;
          const isStrong = item.score >= 6.5;
          const isWeak = item.score <= 3.5;

          const scoreColor = isStrong
            ? 'text-emerald-500 font-bold'
            : isWeak
            ? 'text-rose-500 font-bold'
            : isDark ? 'text-zinc-200' : 'text-zinc-800';

          const scorePercent = Math.min(100, Math.max(0, (item.score / 10) * 100));

          return (
            <div
              key={item.code}
              onClick={() => onToggleCurrency(item.code)}
              onDoubleClick={() => onSoloCurrency(item.code)}
              className={`p-2.5 rounded-lg border transition-all duration-200 cursor-pointer group select-none snap-start min-w-[110px] sm:min-w-0 hover:-translate-y-0.5 ${
                isDark
                  ? isFocused
                    ? 'bg-zinc-800/90 border-white/40 ring-1 ring-white/20'
                    : isSelected
                    ? 'bg-[#161B26] border-white/[0.09] hover:border-white/20 hover:bg-[#1A202E]'
                    : 'bg-[#0E1017] border-white/[0.04] opacity-50 hover:opacity-80'
                  : isFocused
                  ? 'bg-zinc-100 border-zinc-400 ring-1 ring-zinc-400/20 shadow-xs'
                  : isSelected
                  ? 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100 shadow-2xs'
                  : 'bg-zinc-100/50 border-zinc-200 opacity-50 hover:opacity-80'
              }`}
            >
              {/* Header: Rank + Flag + Code */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500 font-bold">
                    #{item.rank}
                  </span>
                  <span className="text-xs opacity-90">{conf.flag}</span>
                  <span className={`font-semibold text-xs tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {item.code}
                  </span>
                </div>

                {/* Score */}
                <span className={`text-xs font-mono tabular-nums transition-colors duration-300 ${scoreColor}`}>
                  {formatScore(item.score)}
                </span>
              </div>

              {/* Strength Meter: Clean Minimal Bar */}
              <div className={`w-full h-1 rounded-full overflow-hidden mb-1.5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isStrong ? 'bg-emerald-500' : isWeak ? 'bg-rose-500' : 'bg-zinc-400'
                  }`}
                  style={{ width: `${scorePercent}%` }}
                />
              </div>

              {/* Delta & Classification Footer */}
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="truncate text-zinc-500">
                  {isStrong ? 'Kuat' : isWeak ? 'Lemah' : 'Netral'}
                </span>

                <span
                  className={`tabular-nums font-medium ${
                    item.delta > 0
                      ? 'text-emerald-500'
                      : item.delta < 0
                      ? 'text-rose-500'
                      : 'text-zinc-500'
                  }`}
                >
                  {item.delta > 0 ? `+${item.delta.toFixed(2)}` : item.delta.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
