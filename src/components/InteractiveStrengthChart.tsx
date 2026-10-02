import React, { useState, useRef, useMemo } from 'react';
import {
  CurrencyCode,
  StrengthSnapshot,
  TimeframeKey,
} from '../types/forex';
import {
  CURRENCIES,
  CURRENCY_CODES,
  getCurrencyConfig,
  formatScore,
} from '../services/currencyStrengthEngine';
import {
  Sparkles,
  RotateCcw,
  Sun,
  Moon,
  BarChart2,
  TrendingUp,
} from 'lucide-react';

interface InteractiveStrengthChartProps {
  history: StrengthSnapshot[];
  timeframe: TimeframeKey;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  selectedCurrencies: Set<CurrencyCode>;
  onToggleCurrency: (code: CurrencyCode) => void;
  onSelectAllCurrencies: () => void;
  onSoloCurrency: (code: CurrencyCode) => void;
  focusedCurrency: CurrencyCode | null;
  onSetFocusedCurrency: (code: CurrencyCode | null) => void;
}

export const InteractiveStrengthChart: React.FC<InteractiveStrengthChartProps> = ({
  history,
  timeframe,
  onChangeTimeframe,
  selectedCurrencies,
  onToggleCurrency,
  onSelectAllCurrencies,
  onSoloCurrency,
  focusedCurrency,
  onSetFocusedCurrency,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [visiblePointsCount, setVisiblePointsCount] = useState<number>(50);
  const [smoothCurve, setSmoothCurve] = useState<boolean>(false); // default false to match crisp line chart on original site
  const [chartTheme, setChartTheme] = useState<'classic' | 'dark'>('classic'); // 'classic' matches original currency-strength.com white canvas
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Filter history by points count
  const displayHistory = useMemo(() => {
    if (history.length <= visiblePointsCount) return history;
    return history.slice(history.length - visiblePointsCount);
  }, [history, visiblePointsCount]);

  // Chart dimensions & margins
  const width = 1160;
  const height = 480;
  const padding = { top: 30, right: 65, bottom: 45, left: 55 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Scale: 0.0 to 10.0 (or dynamic if fluctuations exceed)
  const minY = 0.0;
  const maxY = 10.0;

  const getY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    const ratio = (clamped - minY) / (maxY - minY);
    return padding.top + innerHeight * (1 - ratio);
  };

  const getX = (index: number) => {
    if (displayHistory.length <= 1) return padding.left;
    return padding.left + (index / (displayHistory.length - 1)) * innerWidth;
  };

  // Generate SVG path for a currency
  const generatePath = (code: CurrencyCode) => {
    if (displayHistory.length === 0) return '';

    const points = displayHistory.map((item, idx) => ({
      x: getX(idx),
      y: getY(item.scores[code] ?? 5.0),
    }));

    if (!smoothCurve || points.length < 3) {
      return points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');
    }

    // Catmull-Rom cubic Bezier smoothing
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Mouse hover event handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || displayHistory.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    if (svgX < padding.left || svgX > width - padding.right) {
      setHoverIndex(null);
      return;
    }

    const relativeX = (svgX - padding.left) / innerWidth;
    const index = Math.round(relativeX * (displayHistory.length - 1));
    const clampedIndex = Math.max(0, Math.min(displayHistory.length - 1, index));
    setHoverIndex(clampedIndex);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Hovered data point
  const currentHoveredPoint =
    hoverIndex !== null ? displayHistory[hoverIndex] : displayHistory[displayHistory.length - 1];

  // Latest snapshot
  const latestPoint = displayHistory[displayHistory.length - 1];

  // Sorted list of visible currencies at current hovered point
  const sortedCurrenciesAtHover = useMemo(() => {
    if (!currentHoveredPoint) return [];
    return CURRENCY_CODES.filter((code) => selectedCurrencies.has(code))
      .map((code) => ({
        code,
        score: currentHoveredPoint.scores[code] ?? 5.0,
        config: CURRENCIES[code],
      }))
      .sort((a, b) => b.score - a.score);
  }, [currentHoveredPoint, selectedCurrencies]);

  // Visual Colors depending on theme
  const isLight = chartTheme === 'classic';
  const themeStyles = {
    cardBg: isLight ? 'bg-white' : 'bg-[#0d121f]',
    cardBorder: isLight ? 'border-[#bfc9d3]' : 'border-slate-800',
    topBarBg: isLight ? 'bg-[#f8fafc]' : 'bg-[#090d16]',
    textPrimary: isLight ? 'text-slate-800' : 'text-white',
    textSecondary: isLight ? 'text-slate-500' : 'text-slate-400',
    gridColor: isLight ? '#e2e8f0' : '#1e293b',
    axisTextColor: isLight ? '#64748b' : '#94a3b8',
    zeroLineColor: isLight ? '#94a3b8' : '#64748b',
    crosshairColor: isLight ? '#0ea5e9' : '#38bdf8',
    tooltipBg: isLight ? 'bg-white/95 text-slate-800 border-slate-300' : 'bg-[#090d16]/95 text-slate-200 border-slate-700/80',
  };

  return (
    <div
      className={`w-full rounded-xl border shadow-xl overflow-hidden transition-colors ${themeStyles.cardBg} ${themeStyles.cardBorder}`}
      ref={containerRef}
    >
      {/* Top Controls Toolbar (#timeselect and options) */}
      <div
        className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-5 py-3 border-b ${themeStyles.topBarBg} ${themeStyles.cardBorder}`}
      >
        {/* Left: Original Timeselect ('today' & 'yesterday' + Timeframes) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className={`text-sm font-bold tracking-tight font-sans ${themeStyles.textPrimary}`}>
              Currency Strength Chart
            </h2>
          </div>

          {/* Original currency-strength.com Range Buttons: 'yesterday' & 'today' */}
          <div className="flex items-center bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-md p-0.5 text-xs font-medium">
            <button
              onClick={() => onChangeTimeframe('1D')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                timeframe === '1D'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-400 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              yesterday
            </button>
            <button
              onClick={() => onChangeTimeframe('1H')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                timeframe === '1H'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-400 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              today
            </button>
          </div>

          {/* Extended Timeframe Selectors */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-md p-0.5 text-xs overflow-x-auto scrollbar-none">
            {(['5M', '10M', '15M', '1H', '2H', '3H', '4H', '6H', '8H', '1D'] as TimeframeKey[]).map((tf) => (
              <button
                key={tf}
                onClick={() => onChangeTimeframe(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Chart options & Theme switcher */}
        <div className="flex items-center gap-2 justify-end flex-wrap text-xs">
          {/* Chart Type Toggle: Line vs Bar */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-md p-0.5">
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'line'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Line</span>
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'bar'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              <span>Bar</span>
            </button>
          </div>

          {/* Smooth curve toggle */}
          {chartType === 'line' && (
            <button
              onClick={() => setSmoothCurve(!smoothCurve)}
              className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                smoothCurve
                  ? 'bg-cyan-50 dark:bg-slate-800 border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-300'
                  : 'bg-transparent border-slate-300 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
              title="Toggle smooth spline vs sharp original polyline"
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              Smooth
            </button>
          )}

          {/* Select All */}
          <button
            onClick={onSelectAllCurrencies}
            className="px-2 py-1 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded text-[11px] transition-colors cursor-pointer"
            title="Reset & show all 8 currencies"
          >
            <RotateCcw className="w-3 h-3 inline mr-1" />
            All
          </button>

          {/* Theme Switcher: Classic Original (#f6f0da/white canvas) vs Dark Cyber */}
          <button
            onClick={() => setChartTheme(chartTheme === 'classic' ? 'dark' : 'classic')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
              chartTheme === 'classic'
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                : 'bg-slate-800 border-slate-700 text-cyan-400 hover:bg-slate-700'
            }`}
            title="Switch between Classic Original theme and Dark Terminal theme"
          >
            {chartTheme === 'classic' ? (
              <>
                <Sun className="w-3 h-3 text-amber-600" />
                <span>Classic</span>
              </>
            ) : (
              <>
                <Moon className="w-3 h-3 text-cyan-400" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AUTHENTIC NVD3-STYLE LEGEND ON TOP OF CHART (Matches currency-strength.com) */}
      <div
        className={`flex items-center justify-center flex-wrap gap-x-5 gap-y-2 px-5 py-2.5 border-b ${
          isLight ? 'bg-[#fafafa]' : 'bg-[#090d16]/80'
        } ${themeStyles.cardBorder}`}
      >
        {CURRENCY_CODES.map((code) => {
          const config = CURRENCIES[code];
          const isSelected = selectedCurrencies.has(code);
          const isFocused = focusedCurrency === code;
          const currentScore = latestPoint?.scores[code] ?? 5.0;

          return (
            <div
              key={code}
              className="flex items-center cursor-pointer select-none group"
              onClick={() => onToggleCurrency(code)}
              onDoubleClick={() => onSoloCurrency(code)}
              onMouseEnter={() => onSetFocusedCurrency(code)}
              onMouseLeave={() => onSetFocusedCurrency(null)}
              title={`Click to show/hide ${code} · Double-click to solo`}
            >
              {/* NVD3 Circular Dot with authentic color */}
              <span
                className={`inline-block w-3 h-3 rounded-full mr-1.5 transition-all ${
                  isSelected
                    ? isFocused
                      ? 'ring-2 ring-offset-1 ring-slate-900 scale-125'
                      : 'shadow-sm'
                    : 'border-2 border-dashed opacity-40'
                }`}
                style={{
                  backgroundColor: isSelected ? config.color : 'transparent',
                  borderColor: config.color,
                }}
              />
              <span
                className={`text-xs font-bold font-sans transition-colors ${
                  isSelected
                    ? isLight
                      ? 'text-slate-800 group-hover:text-black'
                      : 'text-slate-200 group-hover:text-white'
                    : 'line-through opacity-40 text-slate-500'
                }`}
              >
                {code}
              </span>
              <span
                className="ml-1 text-[11px] font-mono tabular-nums font-semibold"
                style={{ color: isSelected ? config.color : '#94a3b8' }}
              >
                {formatScore(currentScore)}
              </span>
            </div>
          );
        })}
      </div>

      {/* MAIN CHART CANVAS */}
      <div className="relative w-full overflow-hidden select-none p-2">
        {chartType === 'line' ? (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto block cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              {/* Overbought light zone (> 8.0) */}
              <linearGradient id="overboughtZone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={isLight ? '0.08' : '0.12'} />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>

              {/* Oversold light zone (< 2.0) */}
              <linearGradient id="oversoldZone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.0" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={isLight ? '0.08' : '0.12'} />
              </linearGradient>
            </defs>

            {/* Overbought zone background rect */}
            <rect
              x={padding.left}
              y={getY(10.0)}
              width={innerWidth}
              height={getY(8.0) - getY(10.0)}
              fill="url(#overboughtZone)"
            />
            {/* Oversold zone background rect */}
            <rect
              x={padding.left}
              y={getY(2.0)}
              width={innerWidth}
              height={getY(0.0) - getY(2.0)}
              fill="url(#oversoldZone)"
            />

            {/* Horizontal Gridlines & Y-Axis Scale Ticks (0, 2, 4, 5, 6, 8, 10) */}
            {[
              { val: 10.0, label: '10.00', major: false },
              { val: 8.0, label: '8.00 (Overbought / Strong)', major: true, color: '#10b981' },
              { val: 6.0, label: '6.00', major: false },
              { val: 5.0, label: '5.00 (Baseline / Neutral)', major: true, color: themeStyles.zeroLineColor },
              { val: 4.0, label: '4.00', major: false },
              { val: 2.0, label: '2.00 (Oversold / Weak)', major: true, color: '#ef4444' },
              { val: 0.0, label: '0.00', major: false },
            ].map((level) => {
              const y = getY(level.val);
              return (
                <g key={level.val}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={level.major ? (level.color || themeStyles.gridColor) : themeStyles.gridColor}
                    strokeDasharray={level.major ? (level.val === 5.0 ? '4 4' : '3 3') : '2 4'}
                    strokeWidth={level.major ? '1.2' : '0.8'}
                    strokeOpacity={level.major ? 0.8 : 0.5}
                  />
                  {/* Left Y-axis label (exact format like d3.format(',2f')) */}
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    fill={level.color || themeStyles.axisTextColor}
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    fontWeight={level.major ? '600' : '400'}
                    textAnchor="end"
                  >
                    {level.val.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Vertical Gridlines & X-Axis Time Ticks */}
            {displayHistory.map((item, idx) => {
              // Space out approx 6-8 ticks
              const step = Math.max(1, Math.floor(displayHistory.length / 7));
              if (idx % step !== 0 && idx !== displayHistory.length - 1) return null;
              const x = getX(idx);
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={height - padding.bottom}
                    stroke={themeStyles.gridColor}
                    strokeWidth="0.8"
                    strokeDasharray="2 4"
                    strokeOpacity={0.6}
                  />
                  <text
                    x={x}
                    y={height - padding.bottom + 18}
                    fill={themeStyles.axisTextColor}
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {item.timeString}
                  </text>
                </g>
              );
            })}

            {/* CURRENCY LINES (Plotted with exact currency-strength.com colors) */}
            {CURRENCY_CODES.map((code) => {
              if (!selectedCurrencies.has(code) || focusedCurrency === code) return null;
              const config = CURRENCIES[code];
              const d = generatePath(code);
              return (
                <path
                  key={code}
                  d={d}
                  fill="none"
                  stroke={config.color}
                  strokeWidth={focusedCurrency ? '1.2' : '2.4'}
                  strokeOpacity={focusedCurrency ? '0.2' : '0.95'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Highlighted Focused Currency Line */}
            {focusedCurrency && selectedCurrencies.has(focusedCurrency) && (
              <path
                d={generatePath(focusedCurrency)}
                fill="none"
                stroke={CURRENCIES[focusedCurrency]?.color || getCurrencyConfig(focusedCurrency).color}
                strokeWidth="4"
                strokeOpacity="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* RIGHT AXIS LIVE PINNING VALUE BADGES */}
            {latestPoint &&
              CURRENCY_CODES.filter((code) => selectedCurrencies.has(code)).map((code) => {
                const conf = CURRENCIES[code];
                const score = latestPoint.scores[code] ?? 5.0;
                const y = getY(score);
                const x = width - padding.right + 4;
                const isFoc = focusedCurrency === code;

                return (
                  <g key={`pin-${code}`}>
                    <rect
                      x={x}
                      y={y - 8}
                      width={44}
                      height={16}
                      rx={3}
                      fill={conf.color}
                      stroke={isFoc ? '#000' : 'none'}
                      strokeWidth={1}
                    />
                    <text
                      x={x + 22}
                      y={y + 3.5}
                      fill="#ffffff"
                      fontSize="10"
                      fontFamily="var(--font-mono)"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {formatScore(score)}
                    </text>
                  </g>
                );
              })}

            {/* INTERACTIVE GUIDELINE (Vertical Tracker line and circles) */}
            {hoverIndex !== null && hoverIndex < displayHistory.length && (
              <g>
                {/* Vertical Tracker Line */}
                <line
                  x1={getX(hoverIndex)}
                  y1={padding.top}
                  x2={getX(hoverIndex)}
                  y2={height - padding.bottom}
                  stroke={themeStyles.crosshairColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />

                {/* Circles on each line at hover X */}
                {CURRENCY_CODES.filter((code) => selectedCurrencies.has(code)).map((code) => {
                  const config = CURRENCIES[code];
                  const score = displayHistory[hoverIndex].scores[code] ?? 5.0;
                  const cx = getX(hoverIndex);
                  const cy = getY(score);
                  const isFoc = focusedCurrency === code;

                  return (
                    <circle
                      key={`pt-${code}`}
                      cx={cx}
                      cy={cy}
                      r={isFoc ? 6 : 4}
                      fill={isLight ? '#ffffff' : '#0d121f'}
                      stroke={config.color}
                      strokeWidth="2.5"
                    />
                  );
                })}
              </g>
            )}
          </svg>
        ) : (
          /* BAR CHART VIEW (Tick-by-tick strength comparison bar chart) */
          <div className="py-6 px-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-end h-[360px]">
              {CURRENCY_CODES.map((code) => {
                const conf = CURRENCIES[code] || getCurrencyConfig(code);
                const score = latestPoint?.scores[code] ?? 5.0;
                const heightPct = Math.max(5, (score / 10) * 100);

                return (
                  <div
                    key={code}
                    className="flex flex-col items-center justify-end h-full group cursor-pointer"
                    onClick={() => onToggleCurrency(code)}
                  >
                    <span
                      className="text-xs font-bold font-mono mb-2"
                      style={{ color: conf?.color || '#0ea5e9' }}
                    >
                      {formatScore(score)}
                    </span>
                    <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-t-lg overflow-hidden flex flex-col justify-end h-[280px]">
                      <div
                        className="w-full rounded-t-lg transition-all duration-300 group-hover:brightness-110"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: conf?.color || '#0ea5e9',
                        }}
                      />
                    </div>
                    <div className="mt-2 text-center">
                      <span className="text-base">{conf?.flag || '🌐'}</span>
                      <span className="block font-bold text-xs mt-0.5" style={{ color: conf?.color || '#0ea5e9' }}>
                        {code}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NVD3-STYLE INTERACTIVE TOOLTIP POPUP */}
        {chartType === 'line' && hoverIndex !== null && currentHoveredPoint && (
          <div
            className={`absolute top-5 pointer-events-none z-20 rounded-lg p-3 shadow-xl backdrop-blur-md min-w-[190px] text-xs border transition-all duration-75 ${themeStyles.tooltipBg}`}
            style={{
              left:
                getX(hoverIndex) > innerWidth * 0.65
                  ? `${Math.max(8, (getX(hoverIndex) / width) * 100 - 24)}%`
                  : `${Math.min(76, (getX(hoverIndex) / width) * 100 + 4)}%`,
            }}
          >
            {/* Header: Timestamp */}
            <div className="flex items-center justify-between border-b pb-1.5 mb-2 font-mono text-[11px] font-semibold border-slate-200 dark:border-slate-800">
              <span className="text-blue-600 dark:text-cyan-400 font-bold">
                {currentHoveredPoint.timeString}
              </span>
              <span className="text-slate-500 uppercase">{timeframe}</span>
            </div>

            {/* List of sorted currencies */}
            <div className="space-y-1 font-mono">
              {sortedCurrenciesAtHover.map(({ code, score, config }, i) => (
                <div
                  key={code}
                  className={`flex items-center justify-between text-xs py-0.5 px-1 rounded ${
                    focusedCurrency === code ? 'bg-slate-200 dark:bg-slate-800 font-bold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="font-bold">{code}</span>
                  </div>
                  <span className="tabular-nums font-bold" style={{ color: config.color }}>
                    {formatScore(score)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart Footer with exact reference details */}
      <div
        className={`flex flex-col sm:flex-row items-center justify-between px-5 py-2.5 text-xs font-mono border-t ${
          isLight ? 'bg-[#fafafa]' : 'bg-[#090d16]'
        } ${themeStyles.cardBorder} ${themeStyles.textSecondary}`}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Scale: 0.0 - 10.0
          </span>
          <span>·</span>
          <span>Strong &gt; 8.0</span>
          <span>·</span>
          <span>Weak &lt; 2.0</span>
          <span>·</span>
          <span>Equilibrium = 5.0</span>
        </div>
        <div className="text-[11px] mt-1 sm:mt-0">
          <span>Click legend item to toggle · Double-click to solo</span>
        </div>
      </div>
    </div>
  );
};
