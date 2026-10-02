import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PairOpportunity } from '../types/forex';
import { CURRENCIES, getCurrencyConfig, formatScore } from '../services/currencyStrengthEngine';
import { resolveTradingViewSymbol, SupportedBroker, SUPPORTED_BROKERS } from './TradingViewModal';
import {
  X,
  TrendingUp,
  TrendingDown,
  LineChart,
  BarChart2,
  ExternalLink,
  RefreshCw,
  Building2,
} from 'lucide-react';

interface PairDetailModalProps {
  pair: PairOpportunity | null;
  onClose: () => void;
  onSelectPairForChart: (base: PairOpportunity['base'], quote: PairOpportunity['quote']) => void;
  theme?: 'dark' | 'light';
}

const INTERVALS: { label: string; value: string; desc: string }[] = [
  { label: '5M', value: '5', desc: 'Scalping' },
  { label: '15M', value: '15', desc: 'Scalping' },
  { label: '1H', value: '60', desc: 'Intraday' },
  { label: '4H', value: '240', desc: 'Intraday' },
  { label: '1D', value: 'D', desc: 'Swing' },
];

export const PairDetailModal: React.FC<PairDetailModalProps> = ({
  pair,
  onClose,
  onSelectPairForChart,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'chart' | 'stats'>('chart');
  const [chartInterval, setChartInterval] = useState<string>('15');
  const [broker, setBroker] = useState<SupportedBroker>(() => {
    try {
      const saved = localStorage.getItem('flowmonitor_preferred_broker');
      if (saved && SUPPORTED_BROKERS.some((b) => b.id === saved)) {
        return saved as SupportedBroker;
      }
    } catch {}
    return 'FOREXCOM';
  });
  const [widgetKey, setWidgetKey] = useState<number>(0);

  const cleanPairSymbol = pair ? pair.pair.toUpperCase().trim() : 'EUR/USD';
  const tradingViewSymbol = resolveTradingViewSymbol(cleanPairSymbol, broker);

  // Construct iframe source URL
  const iframeSrc = useMemo(() => {
    const sym = encodeURIComponent(tradingViewSymbol);
    const thm = isDark ? 'dark' : 'light';
    const bg = isDark ? '0a0c12' : 'ffffff';
    return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_detail_widget&symbol=${sym}&interval=${chartInterval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=${bg}&theme=${thm}&style=1&timezone=Asia%2FJakarta&locale=id`;
  }, [tradingViewSymbol, chartInterval, isDark]);

  if (!pair) return null;

  const baseConf = getCurrencyConfig(pair.base);
  const quoteConf = getCurrencyConfig(pair.quote);
  const isBuy = pair.divergence > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl h-[90vh] max-h-[840px] bg-white dark:bg-[#0A0C12] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0E111A]">
          {/* Pair Identity & Flags */}
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-1 text-lg">
              <span>{baseConf?.flag || '🌐'}</span>
              <span>{quoteConf?.flag || '🌐'}</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white tracking-tight font-mono">
                  {pair.pair}
                </h3>
                <span className="text-xs font-mono text-slate-600 dark:text-zinc-400">
                  {pair.rate < 10 ? pair.rate.toFixed(4) : pair.rate.toFixed(2)}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    pair.change24h >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {pair.change24h >= 0 ? `+${pair.change24h}%` : `${pair.change24h}%`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:block">
                {baseConf?.name || pair.base} / {quoteConf?.name || pair.quote}
              </p>
            </div>

            {/* Bias Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium ${
                isBuy
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{isBuy ? 'BIAS BULLISH' : 'BIAS BEARISH'}</span>
              <span className="text-[11px] opacity-80">
                (Δ {pair.divergence > 0 ? `+${pair.divergence.toFixed(2)}` : pair.divergence.toFixed(2)})
              </span>
            </div>
          </div>

          {/* View Tab Switcher & Modal Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tab: Chart vs Stats */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-medium shadow-2xs">
              <button
                onClick={() => setActiveTab('chart')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'chart'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-medium shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                <LineChart className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                <span>Chart TradingView</span>
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'stats'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-medium shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                <span>Analisis Disparitas</span>
              </button>
            </div>

            {/* If Chart is active, show Interval Switcher */}
            {activeTab === 'chart' && (
              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono shadow-2xs">
                {INTERVALS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setChartInterval(item.value)}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      chartInterval === item.value
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                        : 'text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-300'
                    }`}
                    title={`${item.label} (${item.desc})`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* Refresh chart */}
            {activeTab === 'chart' && (
              <button
                onClick={() => setWidgetKey((k) => k + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
                title="Refresh Widget"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* TradingView external link */}
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer hidden sm:flex items-center gap-1 text-xs font-mono shadow-2xs"
              title="Buka di tab baru TradingView.com"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>TradingView ↗</span>
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Currency Strength Flow Context Ribbon */}
        <div className="px-4 sm:px-6 py-2 bg-slate-100 dark:bg-[#0B0D14] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span>
              {pair.base}: <strong className="text-slate-900 dark:text-white font-medium">{formatScore(pair.baseScore)}</strong>
            </span>
            <span className="text-slate-400 dark:text-zinc-600">vs</span>
            <span>
              {pair.quote}: <strong className="text-slate-900 dark:text-white font-medium">{formatScore(pair.quoteScore)}</strong>
            </span>
            <span className="text-slate-300 dark:text-zinc-700 hidden sm:inline">·</span>
            <span className="hidden sm:inline text-slate-500 dark:text-zinc-500">
              Spread {pair.spreadPips.toFixed(1)} pip
            </span>
          </div>

          <div className="text-[11px]">
            {isBuy ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                ↗ Arus modal terkonfirmasi masuk ke {pair.base}
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                ↘ Arus modal terkonfirmasi keluar dari {pair.base}
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden relative bg-white dark:bg-[#0A0C12]">
          {activeTab === 'chart' ? (
            /* Live TradingView Iframe */
            <div className="w-full h-full relative">
              <iframe
                key={`${tradingViewSymbol}-${chartInterval}-${isDark ? 'dark' : 'light'}-${widgetKey}`}
                src={iframeSrc}
                title={`TradingView Chart ${tradingViewSymbol}`}
                className="w-full h-full border-0 absolute inset-0"
                allow="fullscreen"
              />
            </div>
          ) : (
            /* Disparity & Flow Stats View */
            <div className="p-6 space-y-4 max-w-3xl mx-auto overflow-y-auto h-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Base Currency Card */}
                <div className="p-4 bg-[#11141D] border border-white/[0.08] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{baseConf?.flag || '🌐'}</span>
                      <span className="font-semibold text-white text-sm">{pair.base}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">(Base)</span>
                    </div>
                    <span className="text-xl font-bold font-mono text-white tabular-nums">
                      {formatScore(pair.baseScore)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {pair.baseScore >= 6.0
                      ? 'Akumulasi aliran modal dominan (Strong Inflow)'
                      : 'Tekanan likuiditas rendah'}
                  </p>
                </div>

                {/* Quote Currency Card */}
                <div className="p-4 bg-[#11141D] border border-white/[0.08] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{quoteConf?.flag || '🌐'}</span>
                      <span className="font-semibold text-white text-sm">{pair.quote}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">(Quote)</span>
                    </div>
                    <span className="text-xl font-bold font-mono text-white tabular-nums">
                      {formatScore(pair.quoteScore)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {pair.quoteScore <= 4.0
                      ? 'Distribusi pelepasan modal tinggi (Outflow Pressure)'
                      : 'Arus tandingan masih seimbang'}
                  </p>
                </div>
              </div>

              {/* Quantitative Metrics */}
              <div className="bg-[#11141D] border border-white/[0.08] rounded-xl p-4 font-mono text-xs space-y-2.5">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Spot Exchange Rate:</span>
                  <span className="text-white font-semibold tabular-nums">
                    {pair.rate < 10 ? pair.rate.toFixed(4) : pair.rate.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Performa 24 Jam:</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      pair.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {pair.change24h >= 0 ? `+${pair.change24h.toFixed(2)}%` : `${pair.change24h.toFixed(2)}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Spread Rata-rata Institusional:</span>
                  <span className="text-zinc-200 tabular-nums">{pair.spreadPips.toFixed(1)} pip</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Status Momentum Aliran:</span>
                  <span className="text-white capitalize font-semibold">{pair.momentum}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    onSelectPairForChart(pair.base, pair.quote);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-white/10 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer shadow-xs"
                >
                  <LineChart className="w-4 h-4" />
                  Plot di Multi-Line Chart
                </button>
                <button
                  onClick={() => setActiveTab('chart')}
                  className="flex-1 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer shadow-sm"
                >
                  Lihat Candlestick TradingView
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
