import React from 'react';
import { TrendingUp, TrendingDown, Minus, Eye, Check } from 'lucide-react';
import { CurrencyCode, CurrencyStrengthScore } from '../types/forex';
import { CURRENCIES, formatScore } from '../services/currencyStrengthEngine';

interface StrengthMeterGridProps {
  rankings: CurrencyStrengthScore[];
  selectedCurrencies: Set<CurrencyCode>;
  onToggleCurrency: (code: CurrencyCode) => void;
  onSoloCurrency: (code: CurrencyCode) => void;
  focusedCurrency: CurrencyCode | null;
}

export const StrengthMeterGrid: React.FC<StrengthMeterGridProps> = ({
  rankings,
  selectedCurrencies,
  onToggleCurrency,
  onSoloCurrency,
  focusedCurrency,
}) => {
  return (
    <div className="w-full">
      {/* Section Sub-Header & Threshold Legend */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 bg-[#080b13] p-2.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-400 font-bold">
            Skala Nilai Relatif 0.00 – 10.00
          </span>
          <span className="text-slate-600 font-mono text-xs hidden sm:inline">·</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Klik kartu untuk fokus atau isolasi mata uang
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> &gt;7.0 Kuat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" /> 4.0-6.0 Netral
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> &lt;3.0 Lemah
          </span>
        </div>
      </div>

      {/* Grid of 8 Currency Meters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {rankings.map((item) => {
          const config = CURRENCIES[item.code];
          const isSelected = selectedCurrencies.has(item.code);
          const isFocused = focusedCurrency === item.code;
          const scorePercent = Math.min(100, Math.max(0, (item.score / 10) * 100));

          // Color classification based on score
          const getBarColor = (score: number) => {
            if (score >= 7.5) return 'from-emerald-500 to-emerald-400';
            if (score >= 5.8) return 'from-cyan-500 to-blue-400';
            if (score >= 4.2) return 'from-slate-500 to-slate-400';
            if (score >= 2.5) return 'from-amber-500 to-orange-400';
            return 'from-rose-600 to-rose-400';
          };

          const getSentimentLabel = (sentiment: CurrencyStrengthScore['sentiment']) => {
            switch (sentiment) {
              case 'strong_bullish':
                return { text: 'Ext. Bullish', color: 'text-emerald-400' };
              case 'bullish':
                return { text: 'Bullish', color: 'text-cyan-400' };
              case 'neutral':
                return { text: 'Neutral', color: 'text-slate-400' };
              case 'bearish':
                return { text: 'Bearish', color: 'text-amber-400' };
              case 'strong_bearish':
                return { text: 'Ext. Bearish', color: 'text-rose-400' };
            }
          };

          const sentimentInfo = getSentimentLabel(item.sentiment);

          return (
            <div
              key={item.code}
              className={`relative group flex flex-col justify-between p-3 rounded-lg border transition-all duration-150 ${
                isFocused
                  ? 'bg-slate-800/90 border-cyan-400 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                  : isSelected
                  ? 'bg-[#0f1422] border-slate-800 hover:border-slate-700'
                  : 'bg-[#0a0d16]/70 border-slate-900 opacity-60 hover:opacity-100 hover:border-slate-800'
              }`}
            >
              {/* Top Row: Rank, Code, Quick Toggle */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-500 font-bold">
                    #{item.rank}
                  </span>
                  <span className="text-base" title={config.country}>
                    {config.flag}
                  </span>
                  <span
                    className="font-bold text-sm tracking-tight"
                    style={{ color: isSelected ? config.color : '#94a3b8' }}
                  >
                    {item.code}
                  </span>
                </div>

                {/* Solo/Toggle hover controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSoloCurrency(item.code)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[10px] text-slate-400 hover:text-cyan-300 hover:bg-slate-700/60 rounded transition-all"
                    title={`Solo focus on ${item.code}`}
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onToggleCurrency(item.code)}
                    className={`w-4 h-4 rounded flex items-center justify-center border text-[9px] transition-colors ${
                      isSelected
                        ? 'border-slate-600 bg-slate-700 text-white'
                        : 'border-slate-800 bg-slate-900 text-transparent hover:border-slate-700'
                    }`}
                    title={isSelected ? `Hide ${item.code}` : `Show ${item.code}`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

              {/* Main Metric Value */}
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
                  {formatScore(item.score)}
                </span>
                <div
                  className={`flex items-center gap-0.5 text-xs font-mono tabular-nums ${
                    item.delta > 0
                      ? 'text-emerald-400'
                      : item.delta < 0
                      ? 'text-rose-400'
                      : 'text-slate-500'
                  }`}
                >
                  {item.delta > 0 ? (
                    <TrendingUp className="w-3 h-3 shrink-0" />
                  ) : item.delta < 0 ? (
                    <TrendingDown className="w-3 h-3 shrink-0" />
                  ) : (
                    <Minus className="w-3 h-3 shrink-0" />
                  )}
                  <span>
                    {item.delta > 0 ? `+${item.delta.toFixed(2)}` : item.delta.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Visual Meter Bar */}
              <div className="w-full mb-2">
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${scorePercent}%`,
                      backgroundColor: config.color,
                      boxShadow: `0 0 8px ${config.color}60`,
                    }}
                  />
                </div>
              </div>

              {/* Bottom Row: Sentiment State */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/40">
                <span className="text-slate-500 truncate text-[10px]">
                  {config.name.split(' ')[0]}
                </span>
                <span className={`font-medium ${sentimentInfo.color}`}>
                  {sentimentInfo.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
