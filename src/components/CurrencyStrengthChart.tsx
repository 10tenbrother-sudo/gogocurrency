import React, { useState, useMemo, useRef } from 'react';
import {
  CurrencyCode,
  TimeframeKey,
  StrengthSnapshot,
  CurrencyStrengthScore,
} from '../types/forex';
import {
  CURRENCIES,
  CURRENCY_CODES,
  formatScore,
  TIMEFRAME_CONFIGS,
  analyzeAllForexPairsCrossHistory,
  analyzePairCrossHistory,
  PairCrossRecord,
  CrossExpansionStatus,
  PAIR_DEFINITIONS,
} from '../services/currencyStrengthEngine';
import {
  Maximize2,
  Minimize2,
  Crosshair,
  Zap,
  Sun,
  Moon,
  RefreshCw,
  Globe,
  Radio,
  Clock,
  ChevronDown,
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  X,
  AlertTriangle,
  Layers,
  Search,
  CheckCircle2,
  Filter,
  Sparkles,
} from 'lucide-react';

interface CurrencyStrengthChartProps {
  history: StrengthSnapshot[];
  rankings: CurrencyStrengthScore[];
  timeframe: TimeframeKey;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  selectedCurrencies: Set<CurrencyCode>;
  onToggleCurrency: (code: CurrencyCode) => void;
  onSoloCurrency: (code: CurrencyCode) => void;
  focusedCurrency: CurrencyCode | null;
  onSetFocusedCurrency: (code: CurrencyCode | null) => void;
  rawWebSeries?: Record<CurrencyCode, [number, number][]> | null;
  isRealWebLive?: boolean;
  onRefreshWebData?: () => void;
  isLoadingWebData?: boolean;
  lastWebSyncTime?: string;
  theme?: 'dark' | 'light';
}

export interface SignificantZeroCross {
  id: string;
  time: string;
  timestamp: number;
  index: number;
  bullish: CurrencyCode;
  bearish: CurrencyCode;
  crossLevel: number;
  currentGap: number;
  maxGap: number;
  bullishVal: number;
  bearishVal: number;
  pairName: string;
}

export const CurrencyStrengthChart: React.FC<CurrencyStrengthChartProps> = ({
  history,
  rankings,
  timeframe,
  onChangeTimeframe,
  selectedCurrencies,
  onToggleCurrency,
  onSoloCurrency,
  focusedCurrency,
  onSetFocusedCurrency,
  rawWebSeries,
  isRealWebLive = false,
  onRefreshWebData,
  isLoadingWebData = false,
  lastWebSyncTime = '',
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedCrossIndex, setSelectedCrossIndex] = useState<number | null>(null);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [crossFilterTab, setCrossFilterTab] = useState<'expanding' | 'chop' | 'all'>('expanding');
  const [searchPairQuery, setSearchPairQuery] = useState<string>('');

  // Scale Mode: 'relative' (-35 s/d +25, persis web asli dengan baseline 0) or 'absolute' (0 s/d 10)
  const [scaleMode, setScaleMode] = useState<'relative' | 'absolute'>('relative');

  // SVG Dimensions
  const width = 1100;
  const height = isFullscreen ? 580 : 420;
  const padding = { top: 40, right: 35, bottom: 44, left: 55 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scale ranges
  const isRelative = scaleMode === 'relative';
  const minY = isRelative ? -35 : 0.0;
  const maxY = isRelative ? 25 : 10.0;

  const toRelativeVal = (score: number, baseAnchor: number = 5.0) => {
    return Number(((score - baseAnchor) * 7.0).toFixed(1));
  };

  const getY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    return padding.top + chartHeight - ((clamped - minY) / (maxY - minY)) * chartHeight;
  };

  // Check if real web series from currency-strength.com is active
  const hasRealWebData = useMemo(() => {
    if (!rawWebSeries) return false;
    const firstCode = CURRENCY_CODES[0];
    return Array.isArray(rawWebSeries[firstCode]) && rawWebSeries[firstCode].length > 0;
  }, [rawWebSeries]);

  const dataLength = useMemo(() => {
    if (hasRealWebData && rawWebSeries) {
      return rawWebSeries.USD?.length || 1;
    }
    return Math.max(1, history.length);
  }, [hasRealWebData, rawWebSeries, history]);

  const getX = (index: number) => {
    if (dataLength <= 1) return padding.left;
    return padding.left + (index / (dataLength - 1)) * chartWidth;
  };

  // Build SVG path
  const generatePath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }
    return path;
  };

  // Generate paths for each currency
  const currencyPaths = useMemo(() => {
    const paths: Record<
      CurrencyCode,
      {
        path: string;
        points: { x: number; y: number; val: number; ts?: number }[];
        lastPoint: { x: number; y: number; val: number };
      }
    > = {} as any;

    CURRENCY_CODES.forEach((code) => {
      let points: { x: number; y: number; val: number; ts?: number }[] = [];

      if (hasRealWebData && rawWebSeries && rawWebSeries[code]) {
        const rawPoints = rawWebSeries[code];
        points = rawPoints.map(([ts, val], index) => {
          const displayVal = isRelative ? val : Math.max(0.5, Math.min(9.8, 5.0 + val / 7.0));
          return {
            x: getX(index),
            y: getY(displayVal),
            val: displayVal,
            ts,
          };
        });
      } else {
        points = history.map((snapshot, index) => {
          const rawScore = snapshot.scores[code] ?? 5.0;
          const displayVal = isRelative ? toRelativeVal(rawScore, 5.0) : rawScore;
          return {
            x: getX(index),
            y: getY(displayVal),
            val: displayVal,
            ts: snapshot.timestamp,
          };
        });
      }

      const lastPoint = points[points.length - 1] || {
        x: padding.left,
        y: getY(isRelative ? 0 : 5.0),
        val: 0,
      };

      paths[code] = {
        path: generatePath(points),
        points,
        lastPoint,
      };
    });

    return paths;
  }, [hasRealWebData, rawWebSeries, history, isRelative, chartWidth, chartHeight]);

  // Format time label for a point
  const getTimeString = (index: number) => {
    if (hasRealWebData && rawWebSeries && rawWebSeries.USD && rawWebSeries.USD[index]) {
      const ts = rawWebSeries.USD[index][0];
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return history[index]?.timeString || '';
  };

  // Construct series points per currency for cross & expansion engine
  const seriesByCurrency = useMemo(() => {
    const map: Record<CurrencyCode, { val: number; ts?: number; time?: string }[]> = {} as any;
    CURRENCY_CODES.forEach((c) => {
      map[c] = (currencyPaths[c]?.points || []).map((pt, idx) => ({
        val: pt.val,
        ts: pt.ts,
        time: getTimeString(idx),
      }));
    });
    return map;
  }, [currencyPaths, dataLength, hasRealWebData, rawWebSeries, history]);

  const timeframeMinutes = TIMEFRAME_CONFIGS[timeframe]?.minutes || 5;

  // Run comprehensive cross and expansion analysis for all 28 forex pairs
  const { allCrosses, expandingCrosses, chopZeroCrosses } = useMemo(() => {
    return analyzeAllForexPairsCrossHistory(seriesByCurrency, timeframeMinutes);
  }, [seriesByCurrency, timeframeMinutes]);

  // Active pair record selected by user or top expanding cross
  const activePairRecord: PairCrossRecord | null = useMemo(() => {
    if (selectedPair) {
      const found = allCrosses.find((p) => p.pair === selectedPair);
      if (found) return found;
    }
    return expandingCrosses[0] || allCrosses[0] || null;
  }, [selectedPair, allCrosses, expandingCrosses]);

  // Focus on the two currencies of a specific pair
  const handleFocusPair = (base: CurrencyCode, quote: CurrencyCode, pairKey?: string) => {
    if (pairKey) setSelectedPair(pairKey);
    CURRENCY_CODES.forEach((c) => {
      const shouldBeActive = c === base || c === quote;
      const isActive = selectedCurrencies.has(c);
      if (shouldBeActive !== isActive) {
        onToggleCurrency(c);
      }
    });
    onSetFocusedCurrency(base);
  };

  // Build SVG polygon points for post-cross divergence / expansion corridor
  const expansionRibbonPoints = useMemo(() => {
    if (!activePairRecord) return null;
    const pBull = currencyPaths[activePairRecord.bullish]?.points;
    const pBear = currencyPaths[activePairRecord.bearish]?.points;
    if (!pBull || !pBear) return null;

    const startIdx = Math.max(0, activePairRecord.lastCrossIndex);
    const endIdx = dataLength - 1;
    if (startIdx >= endIdx) return null;

    const bullCoords: string[] = [];
    const bearCoords: string[] = [];

    for (let i = startIdx; i <= endIdx; i++) {
      if (pBull[i] && pBear[i]) {
        bullCoords.push(`${pBull[i].x.toFixed(1)},${pBull[i].y.toFixed(1)}`);
        bearCoords.unshift(`${pBear[i].x.toFixed(1)},${pBear[i].y.toFixed(1)}`);
      }
    }

    if (bullCoords.length < 2) return null;
    return [...bullCoords, ...bearCoords].join(' ');
  }, [activePairRecord, currencyPaths, dataLength]);

  // Mouse Move for Hover Inspector Crosshair
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * width;

    if (svgX < padding.left || svgX > width - padding.right || dataLength === 0) {
      setHoverIndex(null);
      setHoverX(null);
      return;
    }

    const relativeX = svgX - padding.left;
    const index = Math.min(
      dataLength - 1,
      Math.max(0, Math.round((relativeX / chartWidth) * (dataLength - 1)))
    );

    setHoverIndex(index);
    setHoverX(getX(index));
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoverX(null);
  };

  const activeIndex = hoverIndex !== null ? hoverIndex : dataLength - 1;
  const activeTimeString = getTimeString(activeIndex);

  // Active rankings for hover HUD
  const activeRankings = useMemo(() => {
    return CURRENCY_CODES.map((code) => {
      const point = currencyPaths[code]?.points[activeIndex];
      const val = point ? point.val : 0;
      return {
        code,
        val,
        config: CURRENCIES[code],
      };
    }).sort((a, b) => b.val - a.val);
  }, [currencyPaths, activeIndex]);

  // Y-Grid ticks
  const yTicks = isRelative
    ? [25, 20, 15, 10, 5, 0, -5, -10, -15, -20, -25, -30, -35]
    : [10, 8, 7, 6, 5, 4, 3, 2, 0];

  // Periodic X-axis time marks
  const xTimeIndices = useMemo(() => {
    if (dataLength === 0) return [];
    const count = 12;
    const step = Math.max(1, Math.floor(dataLength / (count - 1)));
    const indices: number[] = [];
    for (let i = 0; i < dataLength; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== dataLength - 1) {
      indices.push(dataLength - 1);
    }
    return indices;
  }, [dataLength]);

  // Styles based on Light / Dark theme
  const isLight = theme === 'light';
  const themeStyles = {
    cardBg: isLight ? 'bg-white' : 'bg-[#0E121D]',
    cardBorder: isLight ? 'border-slate-200' : 'border-white/[0.08]',
    canvasFill: isLight ? '#FFFFFF' : '#090C14',
    canvasBorder: isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.08)',
    zeroLine: isLight ? '#334155' : '#FFFFFF',
    gridLine: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.05)',
    axisText: isLight ? '#64748B' : '#94A3B8',
    axisLabel: isLight ? '#0F172A' : '#F1F5F9',
    legendText: isLight ? '#1E293B' : '#E2E8F0',
    headerTitle: isLight ? 'text-slate-900' : 'text-white',
    subText: isLight ? 'text-slate-500' : 'text-zinc-400',
  };

  return (
    <div
      ref={containerRef}
      className={`w-full ${themeStyles.cardBg} border ${themeStyles.cardBorder} rounded-xl overflow-hidden transition-colors duration-200 shadow-md ${
        isFullscreen ? 'fixed inset-3 z-50 p-4 sm:p-6 flex flex-col' : 'p-3 sm:p-5'
      }`}
    >
      {/* 1. CLEAN TOP HEADER ROW: Title, Live Status & Control Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 pb-2.5 border-b border-zinc-200 dark:border-white/[0.06]">
        {/* Left: Clean Title & Live Status */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className={`text-sm sm:text-base font-bold font-mono uppercase tracking-wider ${themeStyles.headerTitle}`}>
            Currency Strength Chart
          </h3>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
              isRealWebLive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            <Radio className={`w-3 h-3 ${isRealWebLive ? 'animate-pulse text-emerald-500' : ''}`} />
            <span>{isRealWebLive ? 'Live: currency-strength.com' : 'Menyinkronkan...'}</span>
          </div>

          {lastWebSyncTime && (
            <span className="text-[11px] text-zinc-400 font-mono">
              Sync: {lastWebSyncTime}
            </span>
          )}

          {/* Timeframe Mode Pill */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
              TIMEFRAME_CONFIGS[timeframe]?.category === 'scalp'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : TIMEFRAME_CONFIGS[timeframe]?.category === 'intraday'
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            }`}
          >
            {TIMEFRAME_CONFIGS[timeframe]?.categoryLabel || 'Trading'}: {timeframe}
          </span>
        </div>

        {/* Right: Grouped Controls (Scale, Theme, Refresh, Fullscreen) */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {/* Scale Switcher */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono">
            <button
              onClick={() => setScaleMode('relative')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                isRelative
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Relatif (-35..+25)
            </button>
            <button
              onClick={() => setScaleMode('absolute')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                !isRelative
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Skor (0..10)
            </button>
          </div>

          {/* Refresh Button */}
          {onRefreshWebData && (
            <button
              onClick={onRefreshWebData}
              disabled={isLoadingWebData}
              title="Perbarui data terbaru langsung dari server currency-strength.com"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWebData ? 'animate-spin text-cyan-500' : ''}`} />
              <span className="hidden sm:inline">Sinkron Ulang</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. DEDICATED ADVANCED PAIR CROSS & EXPANSION TRACKER RADAR */}
      {activePairRecord ? (
        <div
          className={`relative mb-3 p-3 sm:p-4 rounded-xl border font-mono text-xs transition-all ${
            activePairRecord.isChopNoExpansion
              ? 'bg-rose-500/[0.06] border-rose-500/30'
              : activePairRecord.status === 'STRONG_EXPANSION'
              ? 'bg-gradient-to-r from-emerald-500/[0.08] via-cyan-500/[0.06] to-transparent border-emerald-500/30'
              : 'bg-gradient-to-r from-amber-500/[0.08] via-emerald-500/[0.06] to-transparent border-amber-500/30'
          }`}
        >
          {/* Top Row: Title, Pair Quick Selector & Main Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-white/[0.08]">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 text-white font-bold text-[11px]">
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>RADAR PERSILANGAN & EKSPANSI</span>
              </div>

              {/* Pair Selector Dropdown */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1">
                <span className="text-[11px] text-zinc-500">Pilih Pair:</span>
                <select
                  value={activePairRecord.pair}
                  onChange={(e) => {
                    const chosen = allCrosses.find((c) => c.pair === e.target.value);
                    if (chosen) {
                      handleFocusPair(chosen.base, chosen.quote, chosen.pair);
                    }
                  }}
                  className="bg-transparent font-bold text-slate-800 dark:text-zinc-100 text-xs focus:outline-none cursor-pointer"
                >
                  <optgroup label="🚀 Berekspansi Kuat">
                    {expandingCrosses.map((p) => (
                      <option key={p.pair} value={p.pair} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white">
                        {p.pair} (Δ+{p.currentGap} • {p.lastCrossTime})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="⚠️ Chop di Area 0 (Tanpa Ekspansi)">
                    {chopZeroCrosses.map((p) => (
                      <option key={p.pair} value={p.pair} className="bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400">
                        {p.pair} [Chop 0] ({p.lastCrossTime})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Quick Pills for Top Requested Pairs */}
              <div className="hidden sm:flex items-center gap-1">
                {['GBP/AUD', 'AUD/JPY', 'EUR/USD', 'GBP/JPY', 'USD/CAD'].map((qPair) => {
                  const isCurrent = activePairRecord.pair === qPair;
                  const record = allCrosses.find((c) => c.pair === qPair);
                  return (
                    <button
                      key={qPair}
                      onClick={() => {
                        if (record) {
                          handleFocusPair(record.base, record.quote, record.pair);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors border ${
                        isCurrent
                          ? 'bg-amber-500 text-black border-amber-600'
                          : record?.isChopNoExpansion
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                          : 'bg-slate-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {qPair}
                      {record?.isChopNoExpansion && <span className="ml-1 text-[9px] text-rose-500 font-mono">⚠️</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <button
                onClick={() => handleFocusPair(activePairRecord.base, activePairRecord.quote, activePairRecord.pair)}
                title="Isolasi dan sorot hanya 2 garis pair ini di grafik"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors border ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-white/10'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Isolasi Pair {activePairRecord.pair}</span>
              </button>

              <button
                onClick={() => setShowHistoryModal(!showHistoryModal)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer transition-colors"
              >
                <span>Riwayat 28 Pair ({expandingCrosses.length} Exp • {chopZeroCrosses.length} Chop)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistoryModal ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Middle Row: Primary Cross Analysis & Expansion Evaluation */}
          <div className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Time of Cross */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>BERSILANGAN: PUKUL {activePairRecord.lastCrossTime}</span>
                  <span className="text-[10px] text-amber-600/80 dark:text-amber-300/80 font-normal">
                    ({activePairRecord.timeAgoFormatted})
                  </span>
                </div>

                {/* Dominance Direction */}
                <div className="flex items-center gap-1 font-bold">
                  <span
                    className="px-1.5 py-0.5 rounded text-white font-bold"
                    style={{ backgroundColor: CURRENCIES[activePairRecord.bullish]?.color }}
                  >
                    {activePairRecord.bullish} ↑ ({activePairRecord.bullish === activePairRecord.base ? activePairRecord.currentBaseScore : activePairRecord.currentQuoteScore})
                  </span>
                  <span className="text-zinc-400 text-xs">menembus</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-white font-bold"
                    style={{ backgroundColor: CURRENCIES[activePairRecord.bearish]?.color }}
                  >
                    {activePairRecord.bearish} ↓ ({activePairRecord.bearish === activePairRecord.base ? activePairRecord.currentBaseScore : activePairRecord.currentQuoteScore})
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[11px] ml-1">
                    Bias: <strong className={activePairRecord.signalBias === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}>{activePairRecord.signalBias} {activePairRecord.pair}</strong>
                  </span>
                </div>

                {/* Status Badge */}
                {activePairRecord.status === 'STRONG_EXPANSION' && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    🚀 EKSPANSI KUAT (Δ+{activePairRecord.currentGap})
                  </span>
                )}
                {activePairRecord.status === 'EMERGING_EXPANSION' && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/30 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    📈 MULAI MELEBAR (Δ+{activePairRecord.currentGap})
                  </span>
                )}
                {activePairRecord.status === 'CHOP_ZERO_NO_EXPANSION' && (
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    ⚠️ CHOP AREA 0 (Tanpa Ekspansi, Δ+{activePairRecord.currentGap})
                  </span>
                )}
                {activePairRecord.status === 'CONTRACTING' && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30 flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3" />
                    📉 EKSPANSI MENYEMPIT (Δ+{activePairRecord.currentGap})
                  </span>
                )}
              </div>

              {/* Narrative Explanation */}
              <p className={`text-xs ${isLight ? 'text-slate-700' : 'text-zinc-300'} leading-relaxed`}>
                {activePairRecord.description}
              </p>
            </div>
          </div>

          {/* Bottom Telemetry Strip */}
          <div className="pt-2 border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-3 sm:gap-5 flex-wrap text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>
              Titik Cross: <strong className="text-zinc-900 dark:text-zinc-100">{activePairRecord.crossLevel}</strong> {activePairRecord.isNearZero ? '(Area 0.0 Equilibrium)' : '(Zona Tren)'}
            </span>
            <span>
              Disparitas Saat Ini: <strong className="text-emerald-500 dark:text-emerald-400 font-bold">Δ+{activePairRecord.currentGap} poin</strong>
            </span>
            <span>
              Max Ekspansi: <strong className="text-cyan-500 dark:text-cyan-400 font-bold">Δ+{activePairRecord.maxGapSinceCross} poin</strong>
            </span>
            <span>
              Frekuensi Cross 24 Bar: <strong className={activePairRecord.whipsawCount >= 3 ? 'text-rose-400 font-bold' : 'text-zinc-300'}>{activePairRecord.whipsawCount}x</strong> {activePairRecord.whipsawCount >= 3 ? '(Tinggi / Chop)' : '(Bersih)'}
            </span>
          </div>

          {/* Expandable History Drawer of All 28 Forex Pairs */}
          {showHistoryModal && (
            <div className="mt-3 pt-3 border-t border-amber-500/30 space-y-3">
              {/* Drawer Controls: Filter Tabs & Pair Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10">
                  <button
                    onClick={() => setCrossFilterTab('expanding')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      crossFilterTab === 'expanding'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🚀 Berekspansi Kuat</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-black/20">({expandingCrosses.length})</span>
                  </button>
                  <button
                    onClick={() => setCrossFilterTab('chop')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      crossFilterTab === 'chop'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <span>⚠️ Chop Area 0 (Tanpa Ekspansi)</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-black/20">({chopZeroCrosses.length})</span>
                  </button>
                  <button
                    onClick={() => setCrossFilterTab('all')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      crossFilterTab === 'all'
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Semua Pair</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-black/20">({allCrosses.length})</span>
                  </button>
                </div>

                {/* Search input */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 text-xs">
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Cari pair (cth: GBP, AUD)..."
                    value={searchPairQuery}
                    onChange={(e) => setSearchPairQuery(e.target.value.toUpperCase())}
                    className="bg-transparent focus:outline-none text-slate-800 dark:text-white placeholder:text-zinc-500 w-36 uppercase"
                  />
                  {searchPairQuery && (
                    <button onClick={() => setSearchPairQuery('')} className="text-zinc-400 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {(crossFilterTab === 'expanding'
                  ? expandingCrosses
                  : crossFilterTab === 'chop'
                  ? chopZeroCrosses
                  : allCrosses
                )
                  .filter((p) => (!searchPairQuery ? true : p.pair.includes(searchPairQuery)))
                  .map((item) => {
                    const isSelected = activePairRecord.pair === item.pair;
                    return (
                      <div
                        key={item.pair}
                        onClick={() => handleFocusPair(item.base, item.quote, item.pair)}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500/50'
                            : item.isChopNoExpansion
                            ? isLight
                              ? 'bg-rose-50 border-rose-200 hover:bg-rose-100/60'
                              : 'bg-rose-500/[0.05] border-rose-500/20 hover:bg-rose-500/10'
                            : isLight
                            ? 'bg-white border-slate-200 hover:bg-slate-50'
                            : 'bg-zinc-900/60 border-white/[0.06] hover:bg-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold flex items-center gap-1 text-slate-900 dark:text-white">
                            <span className="text-xs">{item.pair}</span>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              item.signalBias === 'BUY' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
                            }`}>
                              {item.signalBias}
                            </span>
                          </span>

                          <span className="font-bold font-mono text-amber-500 dark:text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{item.lastCrossTime}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs my-1">
                          <div className="flex items-center gap-1">
                            <span
                              className="px-1 py-0.2 rounded text-[10px] text-white font-bold"
                              style={{ backgroundColor: CURRENCIES[item.bullish]?.color }}
                            >
                              {item.bullish} ↑
                            </span>
                            <span className="text-[10px] text-zinc-400">vs</span>
                            <span
                              className="px-1 py-0.2 rounded text-[10px] text-white font-bold"
                              style={{ backgroundColor: CURRENCIES[item.bearish]?.color }}
                            >
                              {item.bearish} ↓
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`font-mono font-bold ${item.isChopNoExpansion ? 'text-rose-500' : 'text-emerald-500'}`}>
                              Δ+{item.currentGap}
                            </span>
                            <span className="text-[9px] text-zinc-400 block">
                              Max: Δ+{item.maxGapSinceCross}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-slate-100 dark:border-white/[0.04]">
                          <span>{item.timeAgoFormatted}</span>
                          <span className={item.isChopNoExpansion ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                            {item.isChopNoExpansion ? '⚠️ Chop di 0' : `Cross di ${item.crossLevel}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* 3. Top Legend: Circle dot bullets with code matching currency-strength.com */}
      <div className="flex items-center justify-end gap-3.5 overflow-x-auto pb-2 mb-1 scrollbar-none font-mono text-xs select-none">
        {CURRENCY_CODES.map((code) => {
          const conf = CURRENCIES[code];
          const isSelected = selectedCurrencies.has(code);
          const isFocused = focusedCurrency === code;
          const lastPoint = currencyPaths[code]?.lastPoint;
          const liveVal = lastPoint ? lastPoint.val : 0;
          const isPositive = liveVal >= 0;

          return (
            <button
              key={code}
              onClick={() => onToggleCurrency(code)}
              onDoubleClick={() => onSoloCurrency(code)}
              onMouseEnter={() => onSetFocusedCurrency(code)}
              onMouseLeave={() => onSetFocusedCurrency(null)}
              title={`Klik: On/Off | Dobel Klik: Solo ${code}`}
              className={`flex items-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? isFocused
                    ? 'font-bold scale-110 opacity-100'
                    : 'opacity-100 hover:opacity-85'
                  : 'opacity-30 line-through'
              }`}
              style={{ color: isSelected ? themeStyles.legendText : '#888888' }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: conf.color }}
              />
              <span className="font-bold text-xs">{code}</span>
              <span
                className="text-[11px] font-mono font-bold"
                style={{ color: isPositive ? conf.color : '#e11d48' }}
              >
                {isRelative ? (isPositive ? `+${liveVal}` : `${liveVal}`) : liveVal.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. The SVG Canvas */}
      <div className={`relative w-full overflow-hidden ${isFullscreen ? 'flex-1' : ''}`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Main Chart Canvas Background */}
          <rect
            x={padding.left}
            y={padding.top}
            width={chartWidth}
            height={chartHeight}
            fill={themeStyles.canvasFill}
            stroke={themeStyles.canvasBorder}
            strokeWidth="1.2"
          />

          {/* Horizontal Grid Lines & Y-Axis Labels */}
          {yTicks.map((val) => {
            const y = getY(val);
            const isZero = val === 0;

            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  stroke={isZero ? themeStyles.zeroLine : themeStyles.gridLine}
                  strokeWidth={isZero ? 1.4 : 0.8}
                />

                <line
                  x1={padding.left - 4}
                  y1={y}
                  x2={padding.left}
                  y2={y}
                  stroke={themeStyles.zeroLine}
                  strokeWidth="1"
                />

                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  fill={isZero ? (isLight ? '#000000' : '#ffffff') : themeStyles.axisLabel}
                  fontSize="11"
                  fontFamily="sans-serif"
                  fontWeight={isZero ? 'bold' : 'normal'}
                  textAnchor="end"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Vertical Grid Lines & Bottom X-Axis Time Labels */}
          {xTimeIndices.map((idx) => {
            const timeStr = getTimeString(idx);
            if (!timeStr) return null;
            const x = getX(idx);

            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + chartHeight}
                  stroke={themeStyles.gridLine}
                  strokeWidth="0.8"
                />

                <line
                  x1={x}
                  y1={padding.top + chartHeight}
                  x2={x}
                  y2={padding.top + chartHeight + 4}
                  stroke={themeStyles.zeroLine}
                  strokeWidth="1"
                />

                <text
                  x={x}
                  y={padding.top + chartHeight + 17}
                  fill={themeStyles.axisText}
                  fontSize="11"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {timeStr}
                </text>
              </g>
            );
          })}

          {/* Shaded Divergence / Expansion Ribbon Corridor between Crossed Pair */}
          {expansionRibbonPoints && activePairRecord && (
            <g>
              <polygon
                points={expansionRibbonPoints}
                fill={activePairRecord.isChopNoExpansion ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.14)'}
                stroke={activePairRecord.isChopNoExpansion ? 'rgba(244, 63, 94, 0.35)' : 'rgba(16, 185, 129, 0.35)'}
                strokeWidth="1"
                strokeDasharray={activePairRecord.isChopNoExpansion ? '3 3' : 'none'}
              />
            </g>
          )}

          {/* VISUAL MARKER: Crossover & Expansion Point Tracker */}
          {activePairRecord && (
            <g>
              {/* Vertical Guideline at Crossover Point */}
              <line
                x1={getX(activePairRecord.lastCrossIndex)}
                y1={padding.top}
                x2={getX(activePairRecord.lastCrossIndex)}
                y2={padding.top + chartHeight}
                stroke={activePairRecord.isChopNoExpansion ? '#F43F5E' : '#F59E0B'}
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />

              {/* Marker Tag di Sumbu X */}
              <g transform={`translate(${getX(activePairRecord.lastCrossIndex)}, ${padding.top + chartHeight + 2})`}>
                <rect
                  x="-42"
                  y="1"
                  width="84"
                  height="18"
                  rx="3"
                  fill={activePairRecord.isChopNoExpansion ? '#F43F5E' : '#F59E0B'}
                />
                <text
                  x="0"
                  y="13"
                  fill="#000000"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ⚡ {activePairRecord.lastCrossTime} ({activePairRecord.barsAgo}b)
                </text>
              </g>

              {/* Cross Intersection Point Circle */}
              <circle
                cx={getX(activePairRecord.lastCrossIndex)}
                cy={getY(activePairRecord.crossLevel)}
                r="5"
                fill={activePairRecord.isChopNoExpansion ? '#F43F5E' : '#F59E0B'}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* 8 Currency Trend Lines */}
          {CURRENCY_CODES.map((code) => {
            const conf = CURRENCIES[code];
            const isSelected = selectedCurrencies.has(code);
            const isFocused = focusedCurrency === code;
            const hasOtherFocus = focusedCurrency !== null && !isFocused;

            if (!isSelected) return null;

            const pathData = currencyPaths[code];
            if (!pathData) return null;

            const strokeWidth = isFocused ? 2.8 : 1.6;
            const opacity = hasOtherFocus ? 0.2 : 1.0;

            return (
              <g key={code}>
                <path
                  d={pathData.path}
                  fill="none"
                  stroke={conf.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <circle
                  cx={pathData.lastPoint.x}
                  cy={pathData.lastPoint.y}
                  r={isFocused ? 4.5 : 3.0}
                  fill={conf.color}
                  opacity={opacity}
                />
              </g>
            );
          })}

          {/* Interactive Crosshair Cursor Line & Point Markers */}
          {hoverIndex !== null && hoverX !== null && (
            <g>
              <line
                x1={hoverX}
                y1={padding.top}
                x2={hoverX}
                y2={padding.top + chartHeight}
                stroke={isLight ? '#0284C7' : '#38BDF8'}
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />

              <g transform={`translate(${hoverX}, ${padding.top + chartHeight + 2})`}>
                <rect x="-26" y="2" width="52" height="17" rx="3" fill="#0284C7" />
                <text
                  x="0"
                  y="14"
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {activeTimeString}
                </text>
              </g>

              {CURRENCY_CODES.map((code) => {
                if (!selectedCurrencies.has(code)) return null;
                const pathData = currencyPaths[code];
                const point = pathData?.points[hoverIndex];
                if (!point) return null;

                return (
                  <circle
                    key={code}
                    cx={hoverX}
                    cy={point.y}
                    r="4"
                    fill={CURRENCIES[code].color}
                    stroke={isLight ? '#FFFFFF' : '#000000'}
                    strokeWidth="1.2"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Floating HUD Snapshot Inspector */}
        {hoverIndex !== null && (
          <div
            className={`absolute top-2 left-16 z-20 pointer-events-none ${
              isLight
                ? 'bg-white/95 border border-zinc-300 text-zinc-900 shadow-xl'
                : 'bg-[#0D111A]/95 border border-white/[0.15] text-white shadow-2xl'
            } backdrop-blur-md rounded-lg p-2.5 font-mono text-xs max-w-xs`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/[0.08] pb-1 mb-1.5">
              <span className="font-bold flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-cyan-500" />
                <span>Waktu: {activeTimeString}</span>
              </span>
              <span className="text-[10px] text-zinc-500">
                {isRealWebLive ? 'currency-strength.com' : 'Local'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {activeRankings.map((item) => {
                const isSelected = selectedCurrencies.has(item.code);
                const isPos = item.val >= 0;

                return (
                  <div
                    key={item.code}
                    className={`flex items-center justify-between text-[11px] py-0.5 ${
                      isSelected ? 'opacity-100' : 'opacity-35 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.config.color }}
                      />
                      <strong style={{ color: item.config.color }}>{item.code}</strong>
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        isPos
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isRelative
                        ? isPos
                          ? `+${item.val.toFixed(2)}`
                          : `${item.val.toFixed(2)}`
                        : item.val.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Footer Quick Info */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-200 dark:border-white/[0.06] text-xs font-mono ${themeStyles.subText}`}
      >
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>
            {isRealWebLive
              ? 'Data tersinkronisasi 100% langsung dari server resmi currency-strength.com.'
              : 'Sinkronisasi dengan server resmi currency-strength.com...'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-zinc-500">
          <span>
            Rentang Sesi: {getTimeString(0)} s/d {getTimeString(dataLength - 1)}
          </span>
        </div>
      </div>
    </div>
  );
};
