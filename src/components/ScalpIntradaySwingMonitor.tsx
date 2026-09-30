import React, { useState, useEffect } from 'react';
import { TimeframeKey, CurrencyStrengthScore, StrengthSnapshot, CurrencyCode } from '../types/forex';
import {
  TIMEFRAME_CONFIGS,
  getNext5MinuteCandleSeconds,
  evaluateScalpSignal,
  ScalpSignalAlert,
  CURRENCIES,
  CURRENCY_CODES,
  analyzeAllForexPairsCrossHistory,
  PairCrossRecord,
} from '../services/currencyStrengthEngine';
import {
  Zap,
  Target,
  TrendingUp,
  Clock,
  RefreshCw,
  ArrowRight,
  TrendingDown,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Activity,
  AlertTriangle,
  Radio,
} from 'lucide-react';

interface ScalpIntradaySwingMonitorProps {
  activeTimeframe: TimeframeKey;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  currentHistory: StrengthSnapshot[];
  rankings: CurrencyStrengthScore[];
  onManualRefresh?: () => void;
  theme?: 'dark' | 'light';
}

export const ScalpIntradaySwingMonitor: React.FC<ScalpIntradaySwingMonitorProps> = ({
  activeTimeframe,
  onChangeTimeframe,
  currentHistory,
  rankings,
  onManualRefresh,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [candleClock, setCandleClock] = useState(() => getNext5MinuteCandleSeconds());
  const [lastCheckTime, setLastCheckTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);

  // Live countdown to next 5-minute candle tick
  useEffect(() => {
    const timer = setInterval(() => {
      const clock = getNext5MinuteCandleSeconds();
      setCandleClock(clock);

      // Trigger automatic scalp check at 5m candle boundary (:00, :05, :10, :15, ...)
      if (clock.remainingSeconds === 299 || clock.remainingSeconds === 0) {
        setLastCheckTime(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute scalp signal for 5M, 10M, or 15M
  const scalpTf = (['5M', '10M', '15M'].includes(activeTimeframe)
    ? activeTimeframe
    : '5M') as '5M' | '10M' | '15M';

  const scalpSignal: ScalpSignalAlert | null = evaluateScalpSignal(currentHistory, scalpTf);

  const handleManualCheck = () => {
    setIsChecking(true);
    setLastCheckTime(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
    if (onManualRefresh) {
      onManualRefresh();
    }
    setTimeout(() => {
      setIsChecking(false);
    }, 600);
  };

  const activeCategory = TIMEFRAME_CONFIGS[activeTimeframe]?.category || 'scalp';

  // Analyze cross history across 28 pairs for current timeframe
  const crossAnalytics = React.useMemo(() => {
    if (!currentHistory || currentHistory.length < 3) return null;
    const seriesByCurrency: Record<CurrencyCode, { val: number; ts?: number; time?: string }[]> = {} as any;
    CURRENCY_CODES.forEach((c) => {
      seriesByCurrency[c] = currentHistory.map((s) => ({
        val: s.scores[c] ?? 5.0,
        ts: s.timestamp,
        time: s.timeString,
      }));
    });
    return analyzeAllForexPairsCrossHistory(seriesByCurrency, TIMEFRAME_CONFIGS[activeTimeframe]?.minutes || 5);
  }, [currentHistory, activeTimeframe]);

  return (
    <div className="w-full bg-white dark:bg-[#0D1017] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-xs transition-colors">
      {/* Top Bar: Title & Trading Horizons Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
              Trading Horizon Monitor (Scalping • Intraday • Swing)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono">
            Currency Strength update setiap 5 menit. Cek momentum delta sesuai durasi trading yang dipilih.
          </p>
        </div>

        {/* 5-Minute Candle Clock Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>Candle 5M:</span>
            <span className="font-bold text-sm tracking-wider">{candleClock.formatted}</span>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 hidden sm:inline">
              (Tutup {candleClock.nextCloseTime})
            </span>
          </div>

          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            title="Cek momentum dan divergensi kekuatan mata uang sekarang"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-300 dark:border-white/10 text-xs font-mono font-medium text-slate-800 dark:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-cyan-500' : ''}`} />
            <span>Cek Sekarang</span>
          </button>
        </div>
      </div>

      {/* 3 Interactive Trading Horizon Cards (Scalp, Intraday, Swing) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
        {/* 1. SCALPING CARD (5M, 10M, 15M) */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            activeCategory === 'scalp'
              ? 'bg-amber-500/[0.06] border-amber-500/40 shadow-xs ring-1 ring-amber-500/20'
              : 'bg-slate-50/50 dark:bg-zinc-900/30 border-slate-200 dark:border-white/[0.06] opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-amber-500/20 text-amber-500">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                Scalping
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30">
              Update per 5m
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-3">
            Cek perubahan arah & ledakan momentum jangka pendek:
          </p>

          {/* Timeframe Buttons: 5M, 10M, 15M */}
          <div className="grid grid-cols-3 gap-1.5 mb-3 font-mono">
            {(['5M', '10M', '15M'] as TimeframeKey[]).map((tf) => {
              const isActive = activeTimeframe === tf;
              const cfg = TIMEFRAME_CONFIGS[tf];
              return (
                <button
                  key={tf}
                  onClick={() => onChangeTimeframe(tf)}
                  className={`flex flex-col items-center py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-white font-bold border-amber-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 hover:border-amber-400'
                  }`}
                >
                  <span className="text-xs">{tf}</span>
                  <span className={`text-[9px] ${isActive ? 'text-amber-100' : 'text-slate-400 dark:text-zinc-500'}`}>
                    {cfg.minutes} Menit
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scalp Live Signal Highlight */}
          {scalpSignal && (
            <div className="p-2.5 rounded-lg bg-white dark:bg-[#0A0D14] border border-amber-500/20 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-[10px] mb-1">
                <span>Rekomendasi Scalp ({scalpSignal.timeframe}):</span>
                <span className="text-amber-500 font-semibold">Divergensi {scalpSignal.divergence}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-900 dark:text-white text-xs">{scalpSignal.bestPair}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    scalpSignal.bias === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {scalpSignal.bias}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 truncate">
                {scalpSignal.recommendation}
              </div>
            </div>
          )}
        </div>

        {/* 2. INTRADAY CARD (1H, 2H, 3H) */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            activeCategory === 'intraday'
              ? 'bg-cyan-500/[0.06] border-cyan-500/40 shadow-xs ring-1 ring-cyan-500/20'
              : 'bg-slate-50/50 dark:bg-zinc-900/30 border-slate-200 dark:border-white/[0.06] opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-500">
                <Target className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                Intraday
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-semibold border border-cyan-500/30">
              Sesi Tokyo/London/NY
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-3">
            Tren stabil untuk trading 1-8 jam di sesi pasar aktif:
          </p>

          {/* Timeframe Buttons: 1H, 2H, 3H */}
          <div className="grid grid-cols-3 gap-1.5 mb-3 font-mono">
            {(['1H', '2H', '3H'] as TimeframeKey[]).map((tf) => {
              const isActive = activeTimeframe === tf;
              const cfg = TIMEFRAME_CONFIGS[tf];
              return (
                <button
                  key={tf}
                  onClick={() => onChangeTimeframe(tf)}
                  className={`flex flex-col items-center py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-600 text-white font-bold border-cyan-700 shadow-xs'
                      : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 hover:border-cyan-400'
                  }`}
                >
                  <span className="text-xs">{tf}</span>
                  <span className={`text-[9px] ${isActive ? 'text-cyan-100' : 'text-slate-400 dark:text-zinc-500'}`}>
                    {cfg.minutes / 60} Jam
                  </span>
                </button>
              );
            })}
          </div>

          {/* Intraday Insights */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-[#0A0D14] border border-cyan-500/20 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-[10px] mb-1">
              <span>Fokus Intraday Saat Ini:</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{activeTimeframe} Sesi</span>
            </div>
            <div className="text-[11px] text-slate-700 dark:text-zinc-300">
              {TIMEFRAME_CONFIGS[activeTimeframe]?.category === 'intraday'
                ? TIMEFRAME_CONFIGS[activeTimeframe].description
                : 'Pilih 1H, 2H, atau 3H untuk melihat arah dominan sesi London/NY.'}
            </div>
          </div>
        </div>

        {/* 3. SWING CARD (4H, 6H, 8H, 1D) */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            activeCategory === 'swing'
              ? 'bg-emerald-500/[0.06] border-emerald-500/40 shadow-xs ring-1 ring-emerald-500/20'
              : 'bg-slate-50/50 dark:bg-zinc-900/30 border-slate-200 dark:border-white/[0.06] opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-500">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                Swing & Makro
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30">
              Multi-Hari & Sesi
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-3">
            Arah tren besar rotasi shift pasar global:
          </p>

          {/* Timeframe Buttons: 4H, 6H, 8H, 1D */}
          <div className="grid grid-cols-4 gap-1 mb-3 font-mono">
            {(['4H', '6H', '8H', '1D'] as TimeframeKey[]).map((tf) => {
              const isActive = activeTimeframe === tf;
              const cfg = TIMEFRAME_CONFIGS[tf];
              return (
                <button
                  key={tf}
                  onClick={() => onChangeTimeframe(tf)}
                  className={`flex flex-col items-center py-1.5 px-0.5 rounded-lg border text-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold border-emerald-700 shadow-xs'
                      : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 hover:border-emerald-400'
                  }`}
                >
                  <span className="text-xs">{tf}</span>
                  <span className={`text-[9px] ${isActive ? 'text-emerald-100' : 'text-slate-400 dark:text-zinc-500'}`}>
                    {cfg.minutes < 1440 ? `${cfg.minutes / 60}J` : '1H'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Swing Insights */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-[#0A0D14] border border-emerald-500/20 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-[10px] mb-1">
              <span>Aliran Modal Swing:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tahan Posisi Stabil</span>
            </div>
            <div className="text-[11px] text-slate-700 dark:text-zinc-300">
              {TIMEFRAME_CONFIGS[activeTimeframe]?.category === 'swing'
                ? TIMEFRAME_CONFIGS[activeTimeframe].description
                : 'Pilih 4H, 6H, 8H, atau 1D untuk melihat tren gelombang swing institusional.'}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Cross History & Expansion Verification Strip */}
      {crossAnalytics && (
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/[0.08] font-mono text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Validasi Persilangan Riwayat (Anti-Chop Area 0)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{crossAnalytics.expandingCrosses.length} Pair Ekspansi</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>{crossAnalytics.chopZeroCrosses.length} Pair Terjebak Chop 0</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {/* Top Expanding Pairs */}
            <div className="p-2.5 rounded-lg bg-white dark:bg-[#0A0D14] border border-emerald-500/20">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Pair Ekspansi Kuat (Siap Trading)</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-normal">Divergensi Jelas</span>
              </div>
              <div className="space-y-1.5">
                {crossAnalytics.expandingCrosses.slice(0, 3).map((item) => (
                  <div key={item.pair} className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded bg-slate-50 dark:bg-zinc-900/60">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-900 dark:text-white">{item.pair}</strong>
                      <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${item.signalBias === 'BUY' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                        {item.signalBias}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        Cross {item.lastCrossTime} ({item.timeAgoFormatted})
                      </span>
                    </div>
                    <span className="text-emerald-500 font-bold">
                      Δ+{item.currentGap}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Zero-Chop Whipsaws to Avoid */}
            <div className="p-2.5 rounded-lg bg-white dark:bg-[#0A0D14] border border-rose-500/20">
              <div className="flex items-center justify-between text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-2">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Pair Terjebak di Area 0 (Filter Noise)</span>
                </span>
                <span className="text-[10px] text-rose-500/80 font-normal">Hindari Entry!</span>
              </div>
              <div className="space-y-1.5">
                {crossAnalytics.chopZeroCrosses.length > 0 ? (
                  crossAnalytics.chopZeroCrosses.slice(0, 3).map((item) => (
                    <div key={item.pair} className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded bg-rose-500/[0.04] border border-rose-500/10">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-slate-800 dark:text-zinc-200">{item.pair}</strong>
                        <span className="text-rose-500 text-[10px]">
                          Cross di {item.crossLevel} ({item.whipsawCount}x bolak-balik)
                        </span>
                      </div>
                      <span className="text-rose-400 text-[10px] font-semibold">
                        Gap {item.currentGap} (Tanpa Exp)
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-zinc-500 py-2 text-center">
                    Tidak ada pair yang terjebak di area 0 saat ini.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status bar: Last evaluation info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.04] text-[11px] font-mono text-slate-500 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>
            Evaluasi Aktif: <strong className="text-slate-800 dark:text-zinc-200">{activeTimeframe} ({TIMEFRAME_CONFIGS[activeTimeframe]?.categoryLabel})</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">|</span>
          <span>Terakhir dicek: {lastCheckTime}</span>
        </div>

        <div className="text-[10px] text-slate-400 dark:text-zinc-500">
          Setiap candle 5m close, momentum dihitung ulang otomatis
        </div>
      </div>
    </div>
  );
};
