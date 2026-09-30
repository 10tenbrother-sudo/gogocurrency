import React, { useEffect, useRef, useState } from 'react';
import { PairOpportunity } from '../types/forex';
import { CURRENCIES, formatScore } from '../services/currencyStrengthEngine';
import {
  X,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

interface TradingViewModalProps {
  pair: PairOpportunity | null;
  onClose: () => void;
  defaultInterval?: '5' | '15' | '60' | '240' | 'D';
  theme?: 'dark' | 'light';
}

const INTERVAL_LABELS: { label: string; value: '5' | '15' | '60' | '240' | 'D'; desc: string }[] = [
  { label: '5M', value: '5', desc: 'Scalp' },
  { label: '15M', value: '15', desc: 'Scalp' },
  { label: '1H', value: '60', desc: 'Intraday' },
  { label: '4H', value: '240', desc: 'Intraday' },
  { label: '1D', value: 'D', desc: 'Swing' },
];

export const TradingViewModal: React.FC<TradingViewModalProps> = ({
  pair,
  onClose,
  defaultInterval = '15',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [interval, setInterval] = useState<'5' | '15' | '60' | '240' | 'D'>(defaultInterval);
  const [key, setKey] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanPairSymbol = pair ? pair.pair.replace('/', '') : 'EURUSD';
  const tradingViewSymbol = `FX:${cleanPairSymbol}`;

  useEffect(() => {
    if (!pair || !containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tradingViewSymbol,
      interval: interval,
      timezone: 'Asia/Jakarta',
      theme: isDark ? 'dark' : 'light',
      style: '1',
      locale: 'id',
      enable_publishing: false,
      backgroundColor: isDark ? 'rgba(10, 12, 18, 1)' : 'rgba(255, 255, 255, 1)',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);
  }, [pair, interval, key, tradingViewSymbol, isDark]);

  if (!pair) return null;

  const baseConf = CURRENCIES[pair.base];
  const quoteConf = CURRENCIES[pair.quote];
  const isBullish = pair.divergence > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-6xl h-[92vh] max-h-[880px] bg-white dark:bg-[#0A0C12] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0E111A]">
          {/* Pair Identity & Divergence Bias */}
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-1 text-lg">
              <span>{baseConf.flag}</span>
              <span>{quoteConf.flag}</span>
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
                  className={`text-xs font-mono font-medium tabular-nums ${
                    pair.change24h >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {pair.change24h >= 0 ? `+${pair.change24h}%` : `${pair.change24h}%`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:block">
                TradingView Real-Time Chart · {baseConf.name} / {quoteConf.name}
              </p>
            </div>

            {/* Bias Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold ${
                isBullish
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isBullish ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{isBullish ? 'BIAS BULLISH' : 'BIAS BEARISH'}</span>
              <span className="text-[11px] opacity-80">
                (Δ {pair.divergence > 0 ? `+${pair.divergence.toFixed(2)}` : pair.divergence.toFixed(2)})
              </span>
            </div>
          </div>

          {/* Timeframe Selector & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Timeframe Switcher */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono shadow-2xs">
              {INTERVAL_LABELS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setInterval(item.value)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    interval === item.value
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                  title={`${item.label} (${item.desc})`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Reload Chart */}
            <button
              onClick={() => setKey((k) => k + 1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
              title="Refresh Widget"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Open in full TradingView in new tab */}
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer hidden sm:flex items-center gap-1 text-xs font-mono shadow-2xs"
              title="Buka di TradingView.com"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>TradingView ↗</span>
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
              title="Tutup Chart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Currency Strength Flow Context Ribbon */}
        <div className="px-4 sm:px-6 py-2 bg-slate-100 dark:bg-[#0B0D14] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span>
              Kekuatan {pair.base}: <strong className="text-slate-900 dark:text-white font-semibold">{formatScore(pair.baseScore)}</strong>
            </span>
            <span className="text-slate-400 dark:text-zinc-600">vs</span>
            <span>
              Kekuatan {pair.quote}: <strong className="text-slate-900 dark:text-white font-semibold">{formatScore(pair.quoteScore)}</strong>
            </span>
            <span className="text-slate-300 dark:text-zinc-700 hidden sm:inline">·</span>
            <span className="hidden sm:inline text-slate-500 dark:text-zinc-500">
              Spread {pair.spreadPips.toFixed(1)} pip
            </span>
          </div>

          <div className="text-[11px]">
            {isBullish ? (
              <span className="text-emerald-600 dark:text-emerald-400/90 font-medium">
                Arus modal dominan masuk ke {pair.base} dibanding {pair.quote}
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400/90 font-medium">
                Arus modal dominan keluar dari {pair.base} mengalir ke {pair.quote}
              </span>
            )}
          </div>
        </div>

        {/* Main TradingView Embedded Widget Container */}
        <div className="flex-1 w-full h-full relative bg-white dark:bg-[#0A0C12]">
          <div
            ref={containerRef}
            className="tradingview-widget-container w-full h-full"
            style={{ minHeight: '400px' }}
          />
        </div>
      </div>
    </div>
  );
};
