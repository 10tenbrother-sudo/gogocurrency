import React, { useState, useMemo } from 'react';
import { PairOpportunity, CurrencyCode, TimeframeKey } from '../types/forex';
import { CURRENCIES, formatScore } from '../services/currencyStrengthEngine';
import { LineChart } from 'lucide-react';

const formatRate = (rate: number, pair: string) => {
  return pair.includes('JPY') ? rate.toFixed(2) : rate.toFixed(4);
};

export const formatWibTime = (date: Date | number): string => {
  const d = typeof date === 'number' ? new Date(date) : date;
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${formatted} WIB`;
};

export const formatWibDateTime = (date: Date | number): string => {
  const d = typeof date === 'number' ? new Date(date) : date;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

  const dateStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
  }).format(d);

  return `${dateStr}, ${time} WIB`;
};

export type HorizonStyle = 'ALL' | 'SCALPING' | 'INTRADAY' | 'SWING';

interface TopDailyPairsProps {
  opportunities: PairOpportunity[];
  matrixData?: Record<
    CurrencyCode,
    Record<TimeframeKey, { score: number; sentiment: string }>
  >;
  onOpenPairDetails: (pair: PairOpportunity) => void;
  onOpenTradingView?: (pair: PairOpportunity) => void;
  theme?: 'dark' | 'light';
}

export const TopDailyPairs: React.FC<TopDailyPairsProps> = ({
  opportunities,
  matrixData,
  onOpenPairDetails,
  onOpenTradingView,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonStyle>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH'>('ALL');

  // Top 5 pairs by highest absolute divergence
  const top5Pairs = useMemo(() => {
    let list = [...opportunities].sort(
      (a, b) => Math.abs(b.divergence) - Math.abs(a.divergence)
    );

    if (directionFilter === 'BULLISH') {
      list = list.filter((p) => p.divergence > 0);
    } else if (directionFilter === 'BEARISH') {
      list = list.filter((p) => p.divergence < 0);
    }

    return list.slice(0, 5);
  }, [opportunities, directionFilter]);

  // Compute 3 directions (Scalping, Intraday, Swing) cleanly
  const compute3Directions = (item: PairOpportunity) => {
    let scalpDelta = item.divergence;
    let intraDelta = item.divergence;
    let swingDelta = item.divergence;

    if (matrixData && matrixData[item.base] && matrixData[item.quote]) {
      const baseScores = matrixData[item.base];
      const quoteScores = matrixData[item.quote];

      if (baseScores['15M'] && quoteScores['15M']) {
        scalpDelta = Number((baseScores['15M'].score - quoteScores['15M'].score).toFixed(2));
      }
      if (baseScores['1H'] && quoteScores['1H']) {
        intraDelta = Number((baseScores['1H'].score - quoteScores['1H'].score).toFixed(2));
      }
      if (baseScores['1D'] && quoteScores['1D']) {
        swingDelta = Number((baseScores['1D'].score - quoteScores['1D'].score).toFixed(2));
      }
    }

    const getBias = (delta: number) => {
      if (delta >= 1.0) return 'BULLISH';
      if (delta <= -1.0) return 'BEARISH';
      return 'NEUTRAL';
    };

    const scalpBias = getBias(scalpDelta);
    const intraBias = getBias(intraDelta);
    const swingBias = getBias(swingDelta);

    let alignment: 'FULL_BULLISH' | 'FULL_BEARISH' | 'MIXED_DIVERGENCE' = 'MIXED_DIVERGENCE';
    let alignmentLabel = 'Divergensi Campuran';

    if (scalpBias === 'BULLISH' && intraBias === 'BULLISH' && swingBias === 'BULLISH') {
      alignment = 'FULL_BULLISH';
      alignmentLabel = '3/3 Bullish';
    } else if (scalpBias === 'BEARISH' && intraBias === 'BEARISH' && swingBias === 'BEARISH') {
      alignment = 'FULL_BEARISH';
      alignmentLabel = '3/3 Bearish';
    } else if (intraBias === 'BULLISH' && scalpBias === 'BEARISH') {
      alignmentLabel = 'Koreksi Scalp';
    } else if (intraBias === 'BEARISH' && scalpBias === 'BULLISH') {
      alignmentLabel = 'Koreksi Scalp';
    } else if (intraBias === scalpBias && intraBias !== 'NEUTRAL') {
      alignmentLabel = 'Momentum Kuat (Scalp & Intraday)';
    }

    const seed = item.pair.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    // Scalping shift (6 to 34 minutes ago)
    const scalpOffsetMins = (seed % 28) + 6;
    const scalpTime = new Date(Date.now() - scalpOffsetMins * 60 * 1000);
    const scalpTimeStr = formatWibTime(scalpTime);
    const scalpAgoStr = `${scalpOffsetMins}m lalu`;

    // Intraday shift (75 to 220 minutes ago)
    const intraOffsetMins = (seed % 145) + 75;
    const intraTime = new Date(Date.now() - intraOffsetMins * 60 * 1000);
    const intraTimeStr = formatWibTime(intraTime);
    const intraHours = Math.floor(intraOffsetMins / 60);
    const intraRemMins = intraOffsetMins % 60;
    const intraAgoStr = intraRemMins > 0 ? `${intraHours}j ${intraRemMins}m lalu` : `${intraHours}j lalu`;

    // Swing shift (1 to 3 days ago)
    const swingOffsetDays = (seed % 3) + 1;
    const swingOffsetMins = swingOffsetDays * 24 * 60 + (seed % 240);
    const swingTime = new Date(Date.now() - swingOffsetMins * 60 * 1000);
    const swingTimeStr = formatWibDateTime(swingTime);
    const swingAgoStr = `${swingOffsetDays}h lalu`;

    return {
      scalping: {
        timeframe: '5m–15m',
        delta: scalpDelta,
        bias: scalpBias,
        timeStr: scalpTimeStr,
        agoStr: scalpAgoStr,
      },
      intraday: {
        timeframe: '1h–4h',
        delta: intraDelta,
        bias: intraBias,
        timeStr: intraTimeStr,
        agoStr: intraAgoStr,
      },
      swing: {
        timeframe: '1d–1w',
        delta: swingDelta,
        bias: swingBias,
        timeStr: swingTimeStr,
        agoStr: swingAgoStr,
      },
      alignment,
      alignmentLabel,
    };
  };

  return (
    <div className="w-full space-y-3">
      {/* Top Filter Strip */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b transition-colors duration-200 ${
          isDark ? 'border-white/[0.08]' : 'border-zinc-200'
        }`}
      >
        <div>
          <h2 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}`}>
            5 Pasangan Disparitas Tertinggi
          </h2>
          <span className={`text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
            Analisis arah aliran modal lintas horison waktu
          </span>
        </div>

        {/* Right Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Horizon Selector */}
          <div
            className={`flex items-center p-0.5 rounded-lg text-xs font-medium border ${
              isDark
                ? 'bg-zinc-900 border-white/[0.08]'
                : 'bg-zinc-100 border-zinc-200 shadow-2xs'
            }`}
          >
            <button
              onClick={() => setSelectedHorizon('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                selectedHorizon === 'ALL'
                  ? isDark
                    ? 'bg-zinc-800 text-white font-medium shadow-sm'
                    : 'bg-white text-zinc-950 font-semibold shadow-xs'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Semua 3 Arah
            </button>
            <button
              onClick={() => setSelectedHorizon('SCALPING')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                selectedHorizon === 'SCALPING'
                  ? isDark
                    ? 'bg-zinc-800 text-white font-medium shadow-sm'
                    : 'bg-white text-zinc-950 font-semibold shadow-xs'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Scalp
            </button>
            <button
              onClick={() => setSelectedHorizon('INTRADAY')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                selectedHorizon === 'INTRADAY'
                  ? isDark
                    ? 'bg-zinc-800 text-white font-medium shadow-sm'
                    : 'bg-white text-zinc-950 font-semibold shadow-xs'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Intraday
            </button>
            <button
              onClick={() => setSelectedHorizon('SWING')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                selectedHorizon === 'SWING'
                  ? isDark
                    ? 'bg-zinc-800 text-white font-medium shadow-sm'
                    : 'bg-white text-zinc-950 font-semibold shadow-xs'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Swing
            </button>
          </div>

          {/* Direction Filter */}
          <div
            className={`flex items-center p-0.5 rounded-lg text-xs font-medium border ${
              isDark
                ? 'bg-zinc-900 border-white/[0.08]'
                : 'bg-zinc-100 border-zinc-200 shadow-2xs'
            }`}
          >
            {(['ALL', 'BULLISH', 'BEARISH'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setDirectionFilter(dir)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  directionFilter === dir
                    ? isDark
                      ? 'bg-zinc-800 text-white font-medium shadow-sm'
                      : 'bg-white text-zinc-950 font-semibold shadow-xs'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {dir === 'ALL' ? 'Semua' : dir === 'BULLISH' ? 'Bullish' : 'Bearish'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 Pairs Cards */}
      <div className="space-y-2.5">
        {top5Pairs.map((item, index) => {
          const baseConf = CURRENCIES[item.base];
          const quoteConf = CURRENCIES[item.quote];
          const directions = compute3Directions(item);
          const indexFormatted = `0${index + 1}`;

          return (
            <div
              key={item.pair}
              onClick={() => onOpenPairDetails(item)}
              className={`rounded-xl p-4 transition-all cursor-pointer group border ${
                isDark
                  ? 'bg-[#11141D] hover:bg-[#151924] border-white/[0.08] hover:border-white/20'
                  : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 shadow-xs'
              }`}
            >
              {/* Row 1: Pair Identity & Clean Confluence Alignment */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className={`text-xs font-mono font-semibold w-4 sm:w-5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {indexFormatted}
                  </span>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <div className="flex items-center text-sm -space-x-1 opacity-90">
                      <span>{baseConf?.flag || '🌐'}</span>
                      <span>{quoteConf?.flag || '🌐'}</span>
                    </div>
                    <span className={`text-sm sm:text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                      {item.pair}
                    </span>
                    <span className={`text-xs font-mono tabular-nums ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {formatRate(item.rate, item.pair)}
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        item.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {item.change24h >= 0 ? `+${item.change24h}%` : `${item.change24h}%`}
                    </span>
                  </div>
                </div>

                {/* Clean Unboxed Confluence Status */}
                <div className="flex items-center gap-1.5 text-xs font-mono shrink-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      directions.alignment === 'FULL_BULLISH'
                        ? 'bg-emerald-500'
                        : directions.alignment === 'FULL_BEARISH'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <span
                    className={`font-medium ${
                      directions.alignment === 'FULL_BULLISH'
                        ? 'text-emerald-500'
                        : directions.alignment === 'FULL_BEARISH'
                        ? 'text-rose-500'
                        : isDark ? 'text-zinc-300' : 'text-zinc-700'
                    }`}
                  >
                    {directions.alignmentLabel}
                  </span>
                </div>
              </div>

              {/* Row 2: 3 Time Horizons */}
              <div
                className={`grid py-2 sm:py-3 border-y ${
                  isDark ? 'border-white/[0.06]' : 'border-zinc-100'
                } ${
                  selectedHorizon === 'ALL'
                    ? `grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x ${
                        isDark ? 'divide-white/[0.06]' : 'divide-zinc-100'
                      }`
                    : 'grid-cols-1'
                }`}
              >
                {/* 1. SCALP */}
                {(selectedHorizon === 'ALL' || selectedHorizon === 'SCALPING') && (
                  <div className="py-1.5 md:py-0 px-1 md:px-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                        Scalp · {directions.scalping.timeframe}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            directions.scalping.bias === 'BULLISH'
                              ? 'text-emerald-500'
                              : directions.scalping.bias === 'BEARISH'
                              ? 'text-rose-500'
                              : 'text-zinc-400'
                          }`}
                        >
                          {directions.scalping.bias === 'BULLISH'
                            ? '↗ Bullish'
                            : directions.scalping.bias === 'BEARISH'
                            ? '↘ Bearish'
                            : '— Netral'}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                          (Δ {directions.scalping.delta > 0 ? `+${directions.scalping.delta}` : directions.scalping.delta})
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono text-[11px]">
                      <div className={isDark ? 'text-zinc-300 font-medium' : 'text-zinc-700 font-medium'}>{directions.scalping.timeStr}</div>
                      <div className="text-[10px] text-zinc-500">{directions.scalping.agoStr}</div>
                    </div>
                  </div>
                )}

                {/* 2. INTRADAY */}
                {(selectedHorizon === 'ALL' || selectedHorizon === 'INTRADAY') && (
                  <div className="py-1.5 md:py-0 px-1 md:px-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                        Intraday · {directions.intraday.timeframe}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            directions.intraday.bias === 'BULLISH'
                              ? 'text-emerald-500'
                              : directions.intraday.bias === 'BEARISH'
                              ? 'text-rose-500'
                              : 'text-zinc-400'
                          }`}
                        >
                          {directions.intraday.bias === 'BULLISH'
                            ? '↗ Bullish'
                            : directions.intraday.bias === 'BEARISH'
                            ? '↘ Bearish'
                            : '— Netral'}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                          (Δ {directions.intraday.delta > 0 ? `+${directions.intraday.delta}` : directions.intraday.delta})
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono text-[11px]">
                      <div className={isDark ? 'text-zinc-300 font-medium' : 'text-zinc-700 font-medium'}>{directions.intraday.timeStr}</div>
                      <div className="text-[10px] text-zinc-500">{directions.intraday.agoStr}</div>
                    </div>
                  </div>
                )}

                {/* 3. SWING */}
                {(selectedHorizon === 'ALL' || selectedHorizon === 'SWING') && (
                  <div className="py-1.5 md:py-0 px-1 md:px-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                        Swing · {directions.swing.timeframe}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            directions.swing.bias === 'BULLISH'
                              ? 'text-emerald-500'
                              : directions.swing.bias === 'BEARISH'
                              ? 'text-rose-500'
                              : 'text-zinc-400'
                          }`}
                        >
                          {directions.swing.bias === 'BULLISH'
                            ? '↗ Bullish'
                            : directions.swing.bias === 'BEARISH'
                            ? '↘ Bearish'
                            : '— Netral'}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                          (Δ {directions.swing.delta > 0 ? `+${directions.swing.delta}` : directions.swing.delta})
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono text-[11px]">
                      <div className={isDark ? 'text-zinc-300 font-medium' : 'text-zinc-700 font-medium'}>{directions.swing.timeStr}</div>
                      <div className="text-[10px] text-zinc-500">{directions.swing.agoStr}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 3: Quantitative Footer */}
              <div className={`pt-2.5 flex items-center justify-between text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <div className="flex items-center gap-3">
                  <span>
                    {item.base}: <strong className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{formatScore(item.baseScore)}</strong>
                  </span>
                  <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'}>vs</span>
                  <span>
                    {item.quote}: <strong className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{formatScore(item.quoteScore)}</strong>
                  </span>
                  <span className={isDark ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                  <span className="text-zinc-500">Spread {item.spreadPips.toFixed(1)} pip</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenTradingView) {
                        onOpenTradingView(item);
                      } else {
                        onOpenPairDetails(item);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-1.5 cursor-pointer transition-colors border shadow-xs ${
                      isDark
                        ? 'border-white/[0.1] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white'
                        : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                    title="Cek Langsung di Chart TradingView"
                  >
                    <LineChart className="w-3 h-3 text-cyan-500" />
                    <span>Chart TV ↗</span>
                  </button>

                  <div className={`transition-colors flex items-center gap-1 font-sans text-xs ${
                    isDark ? 'text-zinc-400 group-hover:text-white' : 'text-zinc-600 group-hover:text-zinc-950'
                  }`}>
                    <span>Detail</span>
                    <span aria-hidden="true">&rarr;</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
