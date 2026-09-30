import React from 'react';
import {
  CurrencyCode,
  TimeframeKey,
  CurrencyStrengthScore,
} from '../types/forex';
import { CURRENCIES, CURRENCY_CODES, formatScore } from '../services/currencyStrengthEngine';
import { ArrowUpRight, ArrowDownRight, Layers, Zap, Target, TrendingUp } from 'lucide-react';

interface MultiTimeframeHeatmapProps {
  matrixData: Record<
    CurrencyCode,
    Record<TimeframeKey, { score: number; sentiment: CurrencyStrengthScore['sentiment'] }>
  >;
  selectedCurrencies: Set<CurrencyCode>;
  onToggleCurrency: (code: CurrencyCode) => void;
  onSoloCurrency: (code: CurrencyCode) => void;
  theme?: 'dark' | 'light';
}

export const MultiTimeframeHeatmap: React.FC<MultiTimeframeHeatmapProps> = ({
  matrixData,
  selectedCurrencies,
  onToggleCurrency,
  onSoloCurrency,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  const scalpTfs: TimeframeKey[] = ['5M', '10M', '15M'];
  const intradayTfs: TimeframeKey[] = ['1H', '2H', '3H'];
  const swingTfs: TimeframeKey[] = ['4H', '6H', '8H', '1D'];
  const allTfs: TimeframeKey[] = [...scalpTfs, ...intradayTfs, ...swingTfs];

  const getHeatmapColor = (score: number) => {
    if (score >= 7.5) {
      return isDark
        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
        : 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold';
    }
    if (score >= 5.8) {
      return isDark
        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    if (score >= 4.2) {
      return isDark
        ? 'bg-zinc-800/60 text-zinc-300 border border-white/[0.06]'
        : 'bg-slate-100 text-slate-700 border border-slate-200';
    }
    if (score >= 2.5) {
      return isDark
        ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
        : 'bg-rose-50 text-rose-700 border border-rose-200';
    }
    return isDark
      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold'
      : 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold';
  };

  return (
    <div className="w-full bg-white dark:bg-[#0D1017] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-xs transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
            Multi-Timeframe Strength Matrix
          </h3>
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
          Keselarasan tren: Scalp (5M, 10M, 15M) • Intraday (1H, 2H, 3H) • Swing (4H, 6H, 8H, 1D)
        </div>
      </div>

      {/* Responsive Table / Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left font-mono text-xs">
          <thead>
            {/* Group Categories Row */}
            <tr className="border-b border-slate-200 dark:border-white/[0.06] text-[10px] uppercase font-semibold text-slate-600 dark:text-zinc-400">
              <th rowSpan={2} className="py-2 px-3 font-semibold text-slate-700 dark:text-zinc-300 align-bottom">
                Mata Uang
              </th>
              <th colSpan={3} className="py-1 px-1 text-center bg-amber-500/10 text-amber-700 dark:text-amber-300 border-x border-slate-200 dark:border-white/[0.06] rounded-t">
                ⚡ Scalp (Update 5m)
              </th>
              <th colSpan={3} className="py-1 px-1 text-center bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-r border-slate-200 dark:border-white/[0.06]">
                🎯 Intraday Sesi
              </th>
              <th colSpan={4} className="py-1 px-1 text-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-r border-slate-200 dark:border-white/[0.06]">
                🌊 Swing & Makro
              </th>
              <th rowSpan={2} className="py-2 px-3 text-center font-semibold text-slate-700 dark:text-zinc-300 align-bottom">
                Keselarasan (Confluence)
              </th>
            </tr>
            {/* Sub-Timeframe Row */}
            <tr className="border-b border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-zinc-400 uppercase text-[10px]">
              {allTfs.map((tf) => {
                const isBorderLeft = tf === '1H' || tf === '4H';
                return (
                  <th
                    key={tf}
                    className={`py-1.5 px-1.5 text-center font-medium ${
                      isBorderLeft ? 'border-l border-slate-200 dark:border-white/[0.06]' : ''
                    }`}
                  >
                    {tf}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {CURRENCY_CODES.map((code) => {
              const config = CURRENCIES[code];
              const tfData = matrixData[code] || {};
              const isSelected = selectedCurrencies.has(code);

              // Calculate consensus across all timeframes
              let bullishCount = 0;
              let bearishCount = 0;
              allTfs.forEach((tf) => {
                const s = tfData[tf]?.score ?? 5.0;
                if (s >= 5.5) bullishCount++;
                else if (s <= 4.5) bearishCount++;
              });

              return (
                <tr
                  key={code}
                  className={`group transition-colors ${
                    isSelected ? 'hover:bg-slate-50 dark:hover:bg-white/[0.02]' : 'opacity-35 hover:opacity-80'
                  }`}
                >
                  {/* Currency Name & Badge */}
                  <td className="py-2 px-3 whitespace-nowrap">
                    <button
                      onClick={() => onToggleCurrency(code)}
                      onDoubleClick={() => onSoloCurrency(code)}
                      className="flex items-center gap-2 text-left w-full hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <span className="text-base">{config.flag}</span>
                      <span
                        className="font-semibold text-sm"
                        style={{ color: isSelected ? config.color : '#71717A' }}
                      >
                        {code}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-sans hidden sm:inline">
                        {config.name.split(' ')[0]}
                      </span>
                    </button>
                  </td>

                  {/* Matrix Cells */}
                  {allTfs.map((tf) => {
                    const cell = tfData[tf] ?? { score: 5.0, sentiment: 'neutral' };
                    const cellColor = getHeatmapColor(cell.score);
                    const isBorderLeft = tf === '1H' || tf === '4H';

                    return (
                      <td
                        key={tf}
                        className={`py-1.5 px-1 text-center ${
                          isBorderLeft ? 'border-l border-slate-100 dark:border-white/[0.04]' : ''
                        }`}
                      >
                        <div
                          className={`inline-block w-11 sm:w-12 py-0.5 rounded border tabular-nums text-[11px] transition-transform duration-100 ${cellColor}`}
                        >
                          {formatScore(cell.score)}
                        </div>
                      </td>
                    );
                  })}

                  {/* Confluence Rating */}
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    {bullishCount >= 7 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <ArrowUpRight className="w-3 h-3" />
                        Ultra Bullish ({bullishCount}/10)
                      </span>
                    ) : bullishCount >= 5 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <ArrowUpRight className="w-3 h-3" />
                        Bullish ({bullishCount}/10)
                      </span>
                    ) : bearishCount >= 7 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        <ArrowDownRight className="w-3 h-3" />
                        Ultra Bearish ({bearishCount}/10)
                      </span>
                    ) : bearishCount >= 5 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        <ArrowDownRight className="w-3 h-3" />
                        Bearish ({bearishCount}/10)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800/50">
                        Netral
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend footnote */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mt-3 pt-3 border-t border-slate-200 dark:border-white/[0.06] font-mono flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 dark:text-zinc-500">Skor Kekuatan:</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
            &gt;7.5 Strong Bullish
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/5 text-emerald-600 dark:text-emerald-300 border border-emerald-500/15 text-[10px]">
            5.8–7.4 Moderate
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.06] text-[10px]">
            4.2–5.7 Netral
          </span>
          <span className="px-1.5 py-0.5 rounded bg-rose-500/5 text-rose-600 dark:text-rose-300 border border-rose-500/15 text-[10px]">
            2.5–4.1 Weak
          </span>
          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px]">
            &lt;2.5 Strong Bearish
          </span>
        </div>
        <div className="hidden sm:block text-slate-400 dark:text-zinc-500">
          <span>Klik mata uang untuk filter · Double-klik untuk solo</span>
        </div>
      </div>
    </div>
  );
};
