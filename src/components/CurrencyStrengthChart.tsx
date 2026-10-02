import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  CurrencyCode,
  TimeframeKey,
  StrengthSnapshot,
  CurrencyStrengthScore,
} from '../types/forex';
import {
  CURRENCY_CODES,
  PAIR_DEFINITIONS,
  TIMEFRAME_CONFIGS,
} from '../services/currencyStrengthEngine';

export interface CurrencyStrengthChartProps {
  history: StrengthSnapshot[];
  rankings: CurrencyStrengthScore[];
  timeframe: TimeframeKey;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  selectedCurrencies?: Set<CurrencyCode>;
  onToggleCurrency?: (code: CurrencyCode) => void;
  onSoloCurrency?: (code: CurrencyCode) => void;
  focusedCurrency?: CurrencyCode | null;
  onSetFocusedCurrency?: (code: CurrencyCode | null) => void;
  rawWebSeries?: Record<CurrencyCode, [number, number][]> | null;
  isRealWebLive?: boolean;
  onRefreshWebData?: () => void;
  isLoadingWebData?: boolean;
  lastWebSyncTime?: string;
  onOpenTradingView?: (pair: string) => void;
  theme?: 'dark' | 'light';
}

const CURRENCY_COLORS: Record<CurrencyCode, string> = {
  USD: '#ed9b20',
  EUR: '#ee596c',
  GBP: '#2aa676',
  JPY: '#15a9d0',
  CHF: '#a47826',
  AUD: '#4363f0',
  CAD: '#965ced',
  NZD: '#e151af',
};

const TRADING_HORIZON_GROUPS: Array<{
  name: string;
  desc: string;
  tag: string;
  tfs: TimeframeKey[];
}> = [
  {
    name: 'Scalping',
    desc: 'Pembacaan pergerakan jangka pendek (5M, 10M, 15M).',
    tag: 'Horizon cepat',
    tfs: ['5M', '10M', '15M'],
  },
  {
    name: 'Intraday',
    desc: 'Bandingkan pergerakan arah dalam satu sesi perdagangan (1J, 2J, 3J).',
    tag: 'Dalam hari',
    tfs: ['1H', '2H', '3H'],
  },
  {
    name: 'Swing & makro',
    desc: 'Ringkasan interval multi-sesi dan tren struktural yang lebih panjang.',
    tag: 'Konteks luas',
    tfs: ['4H', '6H', '8H', '1D'],
  },
];

interface PairAnalysisRecord {
  pair: string;
  a: CurrencyCode;
  b: CurrencyCode;
  gap: number;
  max: number;
  crossIndex: number | null;
  crossTime: string | null;
  count: number;
  exp: boolean;
}

export const CurrencyStrengthChart: React.FC<CurrencyStrengthChartProps> = ({
  history,
  timeframe,
  onChangeTimeframe,
  rawWebSeries,
  onOpenTradingView,
  theme = 'light',
}) => {
  const isLight = theme === 'light';

  // 1. Interactive States
  const [selectedPair, setSelectedPair] = useState<string>('CAD/CHF');
  const [scaleMode, setScaleMode] = useState<'relative' | 'score'>('relative');
  const [isIsolated, setIsIsolated] = useState<boolean>(false);
  const [hiddenCodes, setHiddenCodes] = useState<Set<CurrencyCode>>(new Set());
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // 2. Cursor Hover Tooltip State
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const chartSvgRef = useRef<SVGSVGElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // 3. Number Formatters
  const formatNum = (v: number, d: number = 2) => {
    return (v > 0 ? '+' : '') + v.toFixed(d).replace('.', ',');
  };

  // Convert raw 0-10 score to relative -35..+30 scale centered at 0
  const toRelativeVal = (score: number) => {
    return Number(((score - 5.0) * 7.0).toFixed(2));
  };

  // 4. Series Extraction from history or real web data
  const hasRealWebData = useMemo(() => {
    if (!rawWebSeries) return false;
    const first = CURRENCY_CODES[0];
    return Array.isArray(rawWebSeries[first]) && rawWebSeries[first].length > 0;
  }, [rawWebSeries]);

  const timestamps = useMemo(() => {
    if (hasRealWebData && rawWebSeries && rawWebSeries.USD) {
      return rawWebSeries.USD.map(([ts]) => ts);
    }
    return history.map((s) => s.timestamp);
  }, [hasRealWebData, rawWebSeries, history]);

  const timeLabels = useMemo(() => {
    if (hasRealWebData && rawWebSeries && rawWebSeries.USD) {
      return rawWebSeries.USD.map(([ts]) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      });
    }
    return history.map((s) => s.timeString);
  }, [hasRealWebData, rawWebSeries, history]);

  const seriesByCode = useMemo(() => {
    const map: Record<CurrencyCode, number[]> = {} as any;
    CURRENCY_CODES.forEach((c) => {
      if (hasRealWebData && rawWebSeries && rawWebSeries[c]) {
        map[c] = rawWebSeries[c].map(([, val]) => val);
      } else {
        map[c] = history.map((s) => {
          const rawScore = s.scores[c] ?? 5.0;
          return toRelativeVal(rawScore);
        });
      }
    });
    return map;
  }, [hasRealWebData, rawWebSeries, history]);

  const dataLength = timestamps.length || 1;

  // 5. Visibility check
  const isCodeVisible = useCallback(
    (code: CurrencyCode) => {
      if (isIsolated) {
        const [a, b] = selectedPair.split('/');
        return code === a || code === b;
      }
      return !hiddenCodes.has(code);
    },
    [isIsolated, selectedPair, hiddenCodes]
  );

  // 6. Compute 28 Forex Pair Records
  const allPairRecords: PairAnalysisRecord[] = useMemo(() => {
    if (dataLength === 0) return [];
    const list: PairAnalysisRecord[] = [];

    PAIR_DEFINITIONS.forEach((def) => {
      const a = def.base;
      const b = def.quote;
      const aVals = seriesByCode[a] || [];
      const bVals = seriesByCode[b] || [];
      const diffs = aVals.map((v, i) => v - (bVals[i] ?? 0));

      let crossIndex: number | null = null;
      let count = 0;
      for (let i = 1; i < diffs.length; i++) {
        if (diffs[i] * diffs[i - 1] < 0) {
          crossIndex = i;
          count++;
        }
      }

      const latestGap = diffs.length > 0 ? diffs[diffs.length - 1] : 0;
      const maxGap = diffs.length > 0 ? Math.max(...diffs.map(Math.abs)) : 0;
      const crossTime = crossIndex !== null ? timeLabels[crossIndex] || null : null;
      const exp = Math.abs(latestGap) >= 10.0;

      list.push({
        pair: def.pair,
        a,
        b,
        gap: Number(latestGap.toFixed(2)),
        max: Number(maxGap.toFixed(2)),
        crossIndex,
        crossTime,
        count,
        exp,
      });
    });

    list.sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap));
    return list;
  }, [seriesByCode, dataLength, timeLabels]);

  // Selected Pair Analysis Record
  const activeRecord: PairAnalysisRecord = useMemo(() => {
    const found = allPairRecords.find((r) => r.pair === selectedPair);
    if (found) return found;
    return (
      allPairRecords[0] || {
        pair: 'CAD/CHF',
        a: 'CAD',
        b: 'CHF',
        gap: -6.84,
        max: 6.84,
        crossIndex: null,
        crossTime: null,
        count: 0,
        exp: true,
      }
    );
  }, [allPairRecords, selectedPair]);

  // 7. Coordinate Math for SVG Canvas
  // viewBox: 0 0 960 390
  const svgWidth = 960;
  const svgHeight = 390;
  const padLeft = 60;
  const padRight = 70;
  const padTop = 50;
  const padBottom = 60;
  const plotWidth = svgWidth - padLeft - padRight; // 830
  const plotHeight = svgHeight - padTop - padBottom; // 280

  const getX = (idx: number) => {
    if (dataLength <= 1) return padLeft + plotWidth / 2;
    return padLeft + (idx / (dataLength - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    // Relative range: -35 to +30 (delta 65)
    // Score range: 0 to 10 (delta 10)
    if (scaleMode === 'score') {
      const score = (val + 35) / 6.5; // map to 0..10
      const clamped = Math.max(0, Math.min(10, score));
      return padTop + plotHeight - (clamped / 10) * plotHeight;
    }
    const clamped = Math.max(-35, Math.min(30, val));
    return padTop + plotHeight - ((clamped + 35) / 65) * plotHeight;
  };

  // Convert raw value to display value based on scaleMode
  const getDisplayVal = (val: number) => {
    if (scaleMode === 'score') {
      return Number(Math.max(0, Math.min(10, (val + 35) / 6.5)).toFixed(2));
    }
    return val;
  };

  // 8. Generate Area Shading Polygon Points between Base & Quote
  const shadedPolygonPoints = useMemo(() => {
    if (dataLength <= 1) return '';
    const [a, b] = activeRecord.pair.split('/') as [CurrencyCode, CurrencyCode];
    if (!isCodeVisible(a) || !isCodeVisible(b)) return '';

    const aVals = seriesByCode[a] || [];
    const bVals = seriesByCode[b] || [];
    if (aVals.length < 2 || bVals.length < 2) return '';

    const topPath: string[] = [];
    const bottomPath: string[] = [];

    for (let i = 0; i < dataLength; i++) {
      const x = getX(i).toFixed(1);
      const yA = getY(aVals[i] ?? 0).toFixed(1);
      const yB = getY(bVals[i] ?? 0).toFixed(1);
      topPath.push(`${x},${yA}`);
      bottomPath.unshift(`${x},${yB}`);
    }

    return `${topPath.join(' ')} ${bottomPath.join(' ')}`;
  }, [activeRecord, isCodeVisible, seriesByCode, dataLength, scaleMode]);

  // 9. Interactive Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!chartSvgRef.current || dataLength <= 1) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const clampedRelX = Math.max(padLeft, Math.min(padLeft + plotWidth, relX));
    const idx = Math.round(((clampedRelX - padLeft) / plotWidth) * (dataLength - 1));
    const finalIdx = Math.max(0, Math.min(dataLength - 1, idx));
    setHoverIndex(finalIdx);
    setHoverX(getX(finalIdx));
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
    setHoverX(null);
  };

  // Toggle single currency in legend
  const handleToggleCode = (code: CurrencyCode) => {
    if (isIsolated) {
      setIsIsolated(false);
      const newHidden = new Set(CURRENCY_CODES.filter((c) => c !== code));
      setHiddenCodes(newHidden);
      return;
    }
    setHiddenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Reset entire view
  const handleReset = () => {
    setSelectedPair('CAD/CHF');
    setScaleMode('relative');
    setIsIsolated(false);
    setHiddenCodes(new Set());
    setIsExpanded(false);
    setStatusMessage('Tampilan direset ke pengaturan default.');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Active Horizon info
  const activeHorizon = useMemo(() => {
    return (
      TRADING_HORIZON_GROUPS.find((g) => g.tfs.includes(timeframe)) ||
      TRADING_HORIZON_GROUPS[0]
    );
  }, [timeframe]);

  // Filtered lists for validation cards
  const expandingPairs = useMemo(() => allPairRecords.filter((r) => r.exp).slice(0, 4), [allPairRecords]);
  const noisePairs = useMemo(() => allPairRecords.filter((r) => !r.exp).slice(0, 4), [allPairRecords]);

  // Dynamic theme tokens matching the provided HTML styles
  const T = useMemo(
    () => ({
      pageBg: isLight ? 'bg-[#f2f5f9]' : 'bg-[#0f1723]',
      panelBg: isLight ? 'bg-white' : 'bg-[#172333]',
      border: isLight ? 'border-[#e2e8f0]' : 'border-[#2a3b51]',
      textInk: isLight ? 'text-[#1a2b44]' : 'text-[#e5edf8]',
      textMuted: isLight ? 'text-[#6d7e95]' : 'text-[#99aac1]',
      softBg: isLight ? 'bg-[#edf2fc]' : 'bg-[#243650]',
      blue: isLight ? '#345de0' : '#7da0ff',
      green: isLight ? '#188165' : '#74d3b3',
      red: isLight ? '#c75470' : '#ef9cb1',
      gridLine: isLight ? '#e2e8f0' : '#2a3b51',
      zeroLine: isLight ? '#9eafc3' : '#4f6685',
    }),
    [isLight]
  );

  return (
    <div className={`space-y-6 font-sans antialiased transition-colors ${T.textInk}`}>
      {/* ── 1. PAGE HEADER ── */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-[1.5px] font-bold uppercase text-[#345de0] dark:text-[#7da0ff] mb-1">
            MARKET INTELLIGENCE / FOREX
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight m-0">
            Currency strength<span className="text-[#345de0] dark:text-[#7da0ff]">.</span>
          </h1>
          <p className={`text-xs sm:text-sm mt-1 m-0 ${T.textMuted}`}>
            Baca kekuatan relatif. Temukan perbedaan arah.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className={`text-left sm:text-right text-xs ${T.textMuted}`}>
            <b className={`block font-semibold ${T.textInk}`}>
              {hasRealWebData ? 'Data Terkalibrasi Live' : 'Snapshot Terkalibrasi'}
            </b>
            <span className="font-mono text-[11px]">
              {activeHorizon.name} · {timeframe}
            </span>
          </div>

          <button
            onClick={handleReset}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shadow-xs ${
              T.panelBg
            } ${T.border} ${T.textInk} hover:border-[#345de0] hover:text-[#345de0]`}
          >
            Reset tampilan
          </button>
        </div>
      </section>

      {/* ── 2. MAIN WORKSPACE: CHART PANEL + INSPECTOR SIDEBAR ── */}
      <div
        ref={workspaceRef}
        className={`grid gap-4.5 items-start transition-all duration-300 ${
          isExpanded ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]'
        }`}
      >
        {/* ── A. MAIN CHART PANEL ── */}
        <section className={`rounded-xl border overflow-hidden shadow-xs ${T.panelBg} ${T.border}`}>
          {/* Panel Head */}
          <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b ${T.border}`}>
            <div>
              <h2 className="text-base font-bold m-0 tracking-tight">Pergerakan mata uang</h2>
              <div className={`text-xs mt-0.5 ${T.textMuted}`}>
                8 mata uang · pilih label untuk menampilkan / menyembunyikan
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Segmented Scale Toggle */}
              <div className={`p-1 rounded-lg border flex items-center gap-1 text-xs ${T.softBg} ${T.border}`}>
                <button
                  onClick={() => setScaleMode('relative')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    scaleMode === 'relative'
                      ? 'bg-white dark:bg-[#172333] text-[#345de0] dark:text-[#7da0ff] shadow-xs'
                      : T.textMuted
                  }`}
                >
                  Relatif
                </button>
                <button
                  onClick={() => setScaleMode('score')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    scaleMode === 'score'
                      ? 'bg-white dark:bg-[#172333] text-[#345de0] dark:text-[#7da0ff] shadow-xs'
                      : T.textMuted
                  }`}
                >
                  Skor 0–10
                </button>
              </div>

              {/* Expand Toggle Button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                  T.panelBg
                } ${T.border} ${T.textInk} hover:border-[#345de0]`}
              >
                {isExpanded ? 'Tampilan normal' : 'Perluas grafik'}
              </button>
            </div>
          </div>

          {/* 8 Currency Legend Buttons Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 sm:p-4 pb-2">
            {CURRENCY_CODES.map((c) => {
              const visible = isCodeVisible(c);
              const latestVal = seriesByCode[c]?.[dataLength - 1] ?? 0;
              const displayVal = getDisplayVal(latestVal);

              return (
                <button
                  key={c}
                  onClick={() => handleToggleCode(c)}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    T.panelBg
                  } ${T.border} ${
                    visible ? 'opacity-100 shadow-2xs hover:border-[#345de0]/60' : 'opacity-35'
                  }`}
                  title={`Klik untuk ${visible ? 'menyembunyikan' : 'menampilkan'} ${c}`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6d7e95] dark:text-[#99aac1]">
                    <i
                      className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: CURRENCY_COLORS[c] }}
                    />
                    <span>{c}</span>
                  </span>
                  <b className={`block font-mono text-xs sm:text-sm font-bold mt-0.5 tabular-nums ${T.textInk}`}>
                    {scaleMode === 'score' ? displayVal.toFixed(2).replace('.', ',') : formatNum(displayVal)}
                  </b>
                </button>
              );
            })}
          </div>

          {/* Interactive Chart Canvas Area */}
          <div className="relative px-2 sm:px-4 py-2 select-none">
            <svg
              ref={chartSvgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
              className="w-full h-auto min-h-[300px] sm:min-h-[380px] touch-pan-y"
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
            >
              {/* Horizontal Grid Lines */}
              {scaleMode === 'score'
                ? [0, 2, 4, 5, 6, 8, 10].map((v) => {
                    const y = padTop + plotHeight - (v / 10) * plotHeight;
                    const isCenter = v === 5;
                    return (
                      <g key={v}>
                        <line
                          x1={padLeft}
                          x2={padLeft + plotWidth}
                          y1={y}
                          y2={y}
                          stroke={isCenter ? T.zeroLine : T.gridLine}
                          strokeWidth={isCenter ? 1.4 : 0.7}
                        />
                        <text
                          x={padLeft - 10}
                          y={y + 4}
                          textAnchor="end"
                          fill={isLight ? '#6d7e95' : '#99aac1'}
                          fontSize="11"
                          fontFamily="monospace"
                        >
                          {v.toFixed(1)}
                        </text>
                      </g>
                    );
                  })
                : [-35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30].map((v) => {
                    const y = getY(v);
                    const isZero = v === 0;
                    return (
                      <g key={v}>
                        <line
                          x1={padLeft}
                          x2={padLeft + plotWidth}
                          y1={y}
                          y2={y}
                          stroke={isZero ? T.zeroLine : T.gridLine}
                          strokeWidth={isZero ? 1.5 : 0.65}
                        />
                        <text
                          x={padLeft - 10}
                          y={y + 4}
                          textAnchor="end"
                          fill={isLight ? '#6d7e95' : '#99aac1'}
                          fontSize="11"
                          fontFamily="monospace"
                        >
                          {v > 0 ? `+${v}` : v}
                        </text>
                      </g>
                    );
                  })}

              {/* Time Axis Ticks */}
              {Array.from(
                new Set([
                  0,
                  Math.round((dataLength - 1) * 0.25),
                  Math.round((dataLength - 1) * 0.5),
                  Math.round((dataLength - 1) * 0.75),
                  dataLength - 1,
                ])
              ).map((idx) => (
                <text
                  key={idx}
                  x={getX(idx)}
                  y={svgHeight - 16}
                  textAnchor="middle"
                  fill={isLight ? '#6d7e95' : '#99aac1'}
                  fontSize="11"
                  fontFamily="monospace"
                >
                  {timeLabels[idx] || ''}
                </text>
              ))}

              {/* Shaded Area between selected pair */}
              {shadedPolygonPoints && (
                <polygon points={shadedPolygonPoints} fill="#188165" fillOpacity="0.085" />
              )}

              {/* Last Crossover Vertical Dashed Line */}
              {activeRecord.crossIndex !== null && (
                <g>
                  <line
                    x1={getX(activeRecord.crossIndex)}
                    x2={getX(activeRecord.crossIndex)}
                    y1={padTop}
                    y2={padTop + plotHeight}
                    stroke="#d5a144"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={getX(activeRecord.crossIndex)}
                    y={svgHeight - 32}
                    textAnchor="middle"
                    fill="#af8031"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    Cross {activeRecord.crossTime}
                  </text>
                </g>
              )}

              {/* Currency Line Series */}
              {CURRENCY_CODES.map((c) => {
                if (!isCodeVisible(c)) return null;
                const vals = seriesByCode[c] || [];
                if (vals.length === 0) return null;

                const isPairCurrency = activeRecord.a === c || activeRecord.b === c;
                const polylinePoints = vals
                  .map((v, i) => `${getX(i).toFixed(1)},${getY(v).toFixed(1)}`)
                  .join(' ');
                const lastVal = vals[vals.length - 1];

                return (
                  <g key={c}>
                    <polyline
                      points={polylinePoints}
                      stroke={CURRENCY_COLORS[c]}
                      fill="none"
                      strokeWidth={isPairCurrency ? 2.6 : 1.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity={isIsolated || isPairCurrency ? 1 : 0.72}
                    />
                    {/* Dot on current latest candle */}
                    <circle
                      cx={getX(vals.length - 1)}
                      cy={getY(lastVal)}
                      r={isPairCurrency ? 4.5 : 3.2}
                      fill={CURRENCY_COLORS[c]}
                      stroke="#fff"
                      strokeWidth={isPairCurrency ? 1.5 : 0.8}
                    />
                  </g>
                );
              })}

              {/* Interactive Cursor Crosshair Line */}
              {hoverX !== null && (
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={padTop}
                  y2={padTop + plotHeight}
                  stroke={isLight ? '#6d7e95' : '#99aac1'}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              )}
            </svg>

            {/* Hover Tooltip Box */}
            {hoverIndex !== null && hoverX !== null && (
              <div
                className="absolute pointer-events-none z-20 rounded-lg p-2.5 text-xs shadow-xl backdrop-blur-md border"
                style={{
                  left: Math.min(hoverX + 14, svgWidth - 220),
                  top: 24,
                  backgroundColor: isLight ? '#1a2b44' : '#0c141f',
                  color: isLight ? '#ffffff' : '#e5edf8',
                  borderColor: isLight ? '#345de0' : '#4f6685',
                }}
              >
                <div className="font-bold text-[11px] pb-1.5 border-b border-white/10 mb-1.5 flex items-center justify-between gap-3">
                  <span>{timeLabels[hoverIndex] || ''}</span>
                  <span className="text-[#345de0] dark:text-[#7da0ff] font-mono text-[10px]">
                    {timeframe}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                  {CURRENCY_CODES.filter(isCodeVisible).map((c) => {
                    const rawVal = seriesByCode[c]?.[hoverIndex] ?? 0;
                    const val = getDisplayVal(rawVal);
                    return (
                      <div key={c} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1">
                          <i
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: CURRENCY_COLORS[c] }}
                          />
                          <span>{c}:</span>
                        </span>
                        <b className="tabular-nums">
                          {scaleMode === 'score' ? val.toFixed(2) : formatNum(val)}
                        </b>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Chart Notes & Footnote */}
          <p className={`text-[11px] px-4 sm:px-6 py-2 m-0 border-t ${T.border} ${T.textMuted}`}>
            Arsir = selisih pair terpilih · garis putus-putus = persilangan terakhir · arahkan pointer atau sentuh grafik untuk membaca nilai.
          </p>

          <div className={`px-4 sm:px-6 py-3 border-t flex flex-wrap items-center justify-between text-xs gap-3 ${T.border} ${T.textMuted}`}>
            <span>Data terkalibrasi Currency-Strength · Sinkronisasi Otomatis</span>
            <span className="font-mono">
              {scaleMode === 'score' ? 'Skala Skor 0–10' : 'Skala relatif −35 hingga +30'}
            </span>
          </div>
        </section>

        {/* ── B. INSPECTOR SIDEBAR (PAIR INSIGHT) ── */}
        {!isExpanded && (
          <aside className={`rounded-xl border p-5 space-y-4 shadow-xs ${T.panelBg} ${T.border}`}>
            <div>
              <div className="text-[10px] tracking-wider font-extrabold uppercase text-[#345de0] dark:text-[#7da0ff]">
                PAIR INSIGHT
              </div>

              {/* Pair Selector Dropdown */}
              <select
                value={selectedPair}
                onChange={(e) => setSelectedPair(e.target.value)}
                className={`w-full mt-2.5 p-2.5 rounded-lg border font-bold text-lg font-mono focus:outline-hidden cursor-pointer ${
                  T.softBg
                } ${T.border} ${T.textInk}`}
              >
                {allPairRecords.map((r) => (
                  <option key={r.pair} value={r.pair}>
                    {r.pair}
                  </option>
                ))}
              </select>
            </div>

            {/* Regime Pill: Ekspansi vs Noise */}
            <div>
              <span
                className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                  activeRecord.exp
                    ? 'bg-[#e7f5ee] dark:bg-[#183a2e] text-[#188165] dark:text-[#74d3b3]'
                    : 'bg-[#fbedf1] dark:bg-[#3c252d] text-[#c75470] dark:text-[#ef9cb1]'
                }`}
              >
                {activeRecord.exp ? 'Ekspansi kuat' : 'Area rapat / noise'}
              </span>
            </div>

            {/* Big Gap Number */}
            <div>
              <div
                className={`text-4xl font-extrabold tracking-tight font-mono tabular-nums leading-none ${
                  activeRecord.gap >= 0 ? 'text-[#188165] dark:text-[#74d3b3]' : 'text-[#c75470] dark:text-[#ef9cb1]'
                }`}
              >
                {formatNum(activeRecord.gap)}
              </div>
              <div className={`text-xs mt-1.5 ${T.textMuted}`}>
                Disparitas relatif saat ini
              </div>
            </div>

            {/* Base vs Quote Mini Comparison Cards */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className={`p-3 rounded-lg border ${T.softBg} ${T.border}`}>
                <span className={`text-xs block ${T.textMuted}`}>{activeRecord.a}</span>
                <b
                  className="block text-lg font-bold font-mono mt-1"
                  style={{ color: CURRENCY_COLORS[activeRecord.a] }}
                >
                  {formatNum(seriesByCode[activeRecord.a]?.slice(-1)[0] ?? 0)}
                </b>
              </div>

              <div className={`p-3 rounded-lg border ${T.softBg} ${T.border}`}>
                <span className={`text-xs block ${T.textMuted}`}>{activeRecord.b}</span>
                <b
                  className="block text-lg font-bold font-mono mt-1"
                  style={{ color: CURRENCY_COLORS[activeRecord.b] }}
                >
                  {formatNum(seriesByCode[activeRecord.b]?.slice(-1)[0] ?? 0)}
                </b>
              </div>
            </div>

            {/* Facts Key-Value Rows */}
            <div className={`border-t pt-3 space-y-2 text-xs ${T.border} ${T.textMuted}`}>
              <div className="flex justify-between items-center">
                <span>Cross terakhir</span>
                <b className={`font-mono font-medium ${T.textInk}`}>
                  {activeRecord.crossTime ? activeRecord.crossTime : 'Tidak ada'}
                </b>
              </div>
              <div className="flex justify-between items-center">
                <span>Jumlah persilangan</span>
                <b className={`font-mono font-medium ${T.textInk}`}>{activeRecord.count}</b>
              </div>
              <div className="flex justify-between items-center">
                <span>Selisih maksimum</span>
                <b className={`font-mono font-medium ${T.textInk}`}>
                  {activeRecord.max.toFixed(2).replace('.', ',')}
                </b>
              </div>
              <div className="flex justify-between items-center">
                <span>Agregasi</span>
                <b className={`font-mono font-medium ${T.textInk}`}>
                  {timeframe} · {dataLength} titik
                </b>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => setIsIsolated(!isIsolated)}
                className={`w-full py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs ${
                  isIsolated
                    ? 'bg-[#345de0] text-white'
                    : `border ${T.border} ${T.panelBg} ${T.textInk} hover:border-[#345de0] hover:text-[#345de0]`
                }`}
              >
                {isIsolated ? 'Tampilkan semua mata uang' : `Isolasi ${activeRecord.pair}`}
              </button>

              <button
                onClick={() => setShowHistoryDialog(true)}
                className={`w-full py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                  T.panelBg
                } ${T.border} ${T.textInk} hover:bg-slate-100 dark:hover:bg-zinc-800`}
              >
                Riwayat 28 pair
              </button>

              {onOpenTradingView && (
                <button
                  onClick={() => onOpenTradingView(selectedPair)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer transition-colors shadow-2xs inline-flex items-center justify-center gap-1.5 ${
                    isLight
                      ? 'bg-[#137854] text-white hover:bg-[#0f6345] border-[#137854]'
                      : 'bg-[#82e6be] text-[#0c1015] hover:bg-[#6edaa6] border-[#82e6be]'
                  }`}
                  title={`Buka & Sinkronkan Chart TradingView (${selectedPair})`}
                >
                  <span>Buka Chart TradingView ({selectedPair})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Contextual Analysis Text */}
            <p className={`text-xs leading-relaxed m-0 pt-2 border-t ${T.border} ${T.textMuted}`}>
              <strong className={T.textInk}>
                {activeRecord.gap >= 0 ? activeRecord.a : activeRecord.b}
              </strong>{' '}
              lebih kuat dari{' '}
              <strong className={T.textInk}>
                {activeRecord.gap >= 0 ? activeRecord.b : activeRecord.a}
              </strong>{' '}
              pada akhir seri simulasi.{' '}
              {activeRecord.exp
                ? 'Selisih melewati ambang ekspansi demo, mendukung peluang bias berkelanjutan.'
                : 'Selisih berada di bawah ambang ekspansi, terindikasi fase konsolidasi/noise.'}
            </p>
          </aside>
        )}
      </div>

      {/* ── 3. BELOW SECTION: TRADING HORIZON CARDS ── */}
      <section className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-base sm:text-lg font-bold m-0 tracking-tight">Trading horizon</h2>
            <p className={`text-xs mt-0.5 ${T.textMuted}`}>
              Pilih interval agregasi untuk membandingkan bentuk pergerakan.
            </p>
          </div>
          <span className={`text-xs font-mono font-medium ${T.textMuted}`}>
            {activeHorizon.name} · {timeframe}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TRADING_HORIZON_GROUPS.map((g) => {
            const isGroupSelected = g.tfs.includes(timeframe);
            return (
              <div
                key={g.name}
                className={`rounded-xl border p-4.5 space-y-3.5 shadow-xs transition-all ${
                  T.panelBg
                } ${
                  isGroupSelected
                    ? 'border-[#345de0] ring-1 ring-[#345de0]/30'
                    : T.border
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold m-0">{g.name}</h3>
                  <span className={`text-[11px] font-medium ${T.textMuted}`}>{g.tag}</span>
                </div>

                <p className={`text-xs m-0 min-h-[32px] ${T.textMuted}`}>{g.desc}</p>

                {/* Timeframe Buttons in Horizon Card */}
                <div className="flex gap-2">
                  {g.tfs.map((tfKey) => {
                    const isTfActive = timeframe === tfKey;
                    return (
                      <button
                        key={tfKey}
                        onClick={() => onChangeTimeframe(tfKey)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-bold border cursor-pointer transition-all ${
                          isTfActive
                            ? 'bg-[#345de0] text-white border-[#345de0] shadow-xs'
                            : `${T.panelBg} ${T.border} ${T.textInk} hover:border-[#345de0]`
                        }`}
                      >
                        {tfKey}
                      </button>
                    );
                  })}
                </div>

                <div className={`border-t pt-2.5 flex items-center justify-between text-xs ${T.border} ${T.textMuted}`}>
                  <span>{isGroupSelected ? 'Sedang ditampilkan' : 'Interval tersedia'}</span>
                  <b className={`font-mono ${T.textInk}`}>
                    {isGroupSelected ? timeframe : g.tfs.join(' / ')}
                  </b>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. BELOW SECTION: VALIDASI PERSILANGAN (EKSPANSI vs NOISE) ── */}
      <section className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-base sm:text-lg font-bold m-0 tracking-tight">Validasi persilangan</h2>
            <p className={`text-xs mt-0.5 ${T.textMuted}`}>
              Pemisahan ekspansi dan area rapat di sekitar garis nol.
            </p>
          </div>
          <span className={`text-xs font-mono font-medium ${T.textMuted}`}>
            {expandingPairs.length} ekspansi / {noisePairs.length} area rapat
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Ekspansi Terkuat */}
          <div className={`rounded-xl border overflow-hidden shadow-xs ${T.panelBg} ${T.border}`}>
            <div className="px-4.5 py-3 border-b flex items-center justify-between text-xs font-bold bg-[#f7faf9] dark:bg-[#183a2e] text-[#188165] dark:text-[#74d3b3]">
              <span>Ekspansi terkuat</span>
              <small className="font-normal font-mono opacity-80">Selisih ≥ 10</small>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {expandingPairs.map((r) => (
                <button
                  key={r.pair}
                  onClick={() => {
                    setSelectedPair(r.pair);
                    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`w-full px-4.5 py-2.5 flex items-center justify-between text-left cursor-pointer transition-colors ${
                    selectedPair === r.pair ? T.softBg : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div>
                    <strong className="text-xs sm:text-sm font-mono font-bold block">
                      {r.pair}
                    </strong>
                    <small className={`text-[11px] block mt-0.5 ${T.textMuted}`}>
                      {r.count} cross · {r.crossTime ? `${r.crossTime} terakhir` : 'Tanpa cross'}
                    </small>
                  </div>
                  <b className="font-mono text-sm font-bold text-[#188165] dark:text-[#74d3b3]">
                    {formatNum(r.gap)}
                  </b>
                </button>
              ))}
            </div>
          </div>

          {/* Card B: Area Rapat / Noise */}
          <div className={`rounded-xl border overflow-hidden shadow-xs ${T.panelBg} ${T.border}`}>
            <div className="px-4.5 py-3 border-b flex items-center justify-between text-xs font-bold bg-[#fcf8fa] dark:bg-[#3c252d] text-[#c75470] dark:text-[#ef9cb1]">
              <span>Area rapat / noise</span>
              <small className="font-normal font-mono opacity-80">Selisih &lt; 10</small>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {noisePairs.map((r) => (
                <button
                  key={r.pair}
                  onClick={() => {
                    setSelectedPair(r.pair);
                    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`w-full px-4.5 py-2.5 flex items-center justify-between text-left cursor-pointer transition-colors ${
                    selectedPair === r.pair ? T.softBg : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div>
                    <strong className="text-xs sm:text-sm font-mono font-bold block">
                      {r.pair}
                    </strong>
                    <small className={`text-[11px] block mt-0.5 ${T.textMuted}`}>
                      {r.count} cross · {r.crossTime ? `${r.crossTime} terakhir` : 'Tanpa cross'}
                    </small>
                  </div>
                  <b className="font-mono text-sm font-bold text-[#c75470] dark:text-[#ef9cb1]">
                    {formatNum(r.gap)}
                  </b>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. COLLAPSIBLE DEFINISI METRIK & PANDUAN ── */}
      <details className={`rounded-xl border p-4 text-xs space-y-2 cursor-pointer shadow-xs ${T.panelBg} ${T.border} ${T.textMuted}`}>
        <summary className={`font-semibold ${T.textInk} select-none`}>
          Definisi metrik & validasi persilangan
        </summary>
        <div className="pt-2 space-y-2 leading-relaxed">
          <p className="m-0">
            <strong className={T.textInk}>Disparitas:</strong> Nilai mata uang base dikurangi quote.
            Ketika bernilai positif besar, base dominan menguat terhadap quote.
          </p>
          <p className="m-0">
            <strong className={T.textInk}>Persilangan (Crossover):</strong> Dihitung ketika selisih
            berpindah tanda (dari positif ke negatif atau sebaliknya), menandakan rotasi kepemimpinan
            aliran modal antar kedua mata uang.
          </p>
          <p className="m-0">
            <strong className={T.textInk}>Ekspansi Kuat vs Noise:</strong> Ditandai ketika selisih
            melebar signifikan (&ge; 10 poin relatif). Jika kedua mata uang saling mengunci di dekat
            titik 0 tanpa ekspansi, kondisi diklasifikasikan sebagai area rapat/chop.
          </p>
        </div>
      </details>

      {/* Status Snackbar Message */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a2b44] text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium border border-white/10 animate-fadeIn">
          {statusMessage}
        </div>
      )}

      {/* ── 6. DIALOG MODAL RIWAYAT 28 PAIR ── */}
      {showHistoryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className={`rounded-2xl border max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl ${T.panelBg} ${T.border} ${T.textInk}`}>
            <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${T.border}`}>
              <div>
                <h2 className="text-base font-bold m-0">Riwayat persilangan · 28 pair</h2>
                <div className={`text-xs mt-0.5 ${T.textMuted}`}>
                  Dihitung dari seri pada horizon {timeframe}.
                </div>
              </div>
              <button
                onClick={() => setShowHistoryDialog(false)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${T.border} hover:bg-slate-100 dark:hover:bg-zinc-800`}
              >
                Tutup
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-auto flex-1 text-xs">
              <p className={`mb-3.5 ${T.textMuted}`}>
                Urutan berdasarkan selisih absolut terbesar. Klik pair mana saja untuk membuka grafiknya.
              </p>

              <div className={`border rounded-xl overflow-hidden ${T.border}`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${T.softBg} ${T.border} ${T.textMuted}`}>
                      <th className="p-2.5">Pair</th>
                      <th className="p-2.5 text-right">Selisih</th>
                      <th className="p-2.5 text-center">Cross Terakhir</th>
                      <th className="p-2.5 text-center">Jumlah Cross</th>
                      <th className="p-2.5 text-center">Kondisi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-mono">
                    {allPairRecords.map((r) => (
                      <tr
                        key={r.pair}
                        className={`hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors ${
                          selectedPair === r.pair ? T.softBg : ''
                        }`}
                      >
                        <td className="p-2.5">
                          <button
                            onClick={() => {
                              setSelectedPair(r.pair);
                              setShowHistoryDialog(false);
                              workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="font-bold text-[#345de0] dark:text-[#7da0ff] cursor-pointer hover:underline"
                          >
                            {r.pair}
                          </button>
                        </td>
                        <td
                          className={`p-2.5 text-right font-bold tabular-nums ${
                            r.gap >= 0 ? 'text-[#188165] dark:text-[#74d3b3]' : 'text-[#c75470] dark:text-[#ef9cb1]'
                          }`}
                        >
                          {formatNum(r.gap)}
                        </td>
                        <td className="p-2.5 text-center text-[#6d7e95] dark:text-[#99aac1]">
                          {r.crossTime || '—'}
                        </td>
                        <td className="p-2.5 text-center text-[#6d7e95] dark:text-[#99aac1]">
                          {r.count}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.exp
                                ? 'bg-[#e7f5ee] dark:bg-[#183a2e] text-[#188165] dark:text-[#74d3b3]'
                                : 'bg-[#fbedf1] dark:bg-[#3c252d] text-[#c75470] dark:text-[#ef9cb1]'
                            }`}
                          >
                            {r.exp ? 'Ekspansi' : 'Area rapat'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
