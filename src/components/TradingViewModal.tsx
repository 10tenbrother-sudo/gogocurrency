import React, { useEffect, useRef, useState, useMemo } from 'react';
import { PairOpportunity, CurrencyCode } from '../types/forex';
import { getCurrencyConfig, formatScore, PAIR_DEFINITIONS } from '../services/currencyStrengthEngine';
import {
  X,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Building2,
  ChevronDown,
  Layers,
  Sparkles,
  Copy,
  Check,
  Maximize2,
} from 'lucide-react';

export type SupportedBroker =
  | 'FOREXCOM'
  | 'OANDA'
  | 'FX'
  | 'PEPPERSTONE'
  | 'CAPITALCOM'
  | 'EIGHTCAP'
  | 'SAXO'
  | 'FX_IDC';

export const SUPPORTED_BROKERS: {
  id: SupportedBroker;
  name: string;
  tag: string;
  desc: string;
  badgeCls: string;
}[] = [
  {
    id: 'FOREXCOM',
    name: 'FOREX.com',
    tag: 'Gain Capital',
    desc: 'Direct Interbank Execution · 28 Pasangan Forex',
    badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'OANDA',
    name: 'OANDA',
    tag: 'Oanda Corp',
    desc: 'Global Retail & Institusi FX / CFD',
    badgeCls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  },
  {
    id: 'FX',
    name: 'FXCM',
    tag: 'FXCM Global',
    desc: 'Volume Likuiditas Forex Institusional',
    badgeCls: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  },
  {
    id: 'PEPPERSTONE',
    name: 'Pepperstone',
    tag: 'Razor ECN',
    desc: 'Ultra Low Latency Raw Spread Spread Rendah',
    badgeCls: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  {
    id: 'CAPITALCOM',
    name: 'Capital.com',
    tag: 'Capital Global',
    desc: 'Multi-Aset CFD & Kuotasi Real-Time',
    badgeCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  {
    id: 'EIGHTCAP',
    name: 'Eightcap',
    tag: 'Raw Spread',
    desc: 'Spread Tipis & Eksekusi Cepat MT5/TradingView',
    badgeCls: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30',
  },
  {
    id: 'SAXO',
    name: 'Saxo Bank',
    tag: 'Saxo Bank',
    desc: 'Tier-1 Investment Bank Direct Rate',
    badgeCls: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  },
  {
    id: 'FX_IDC',
    name: 'FX IDC',
    tag: 'Global IDC',
    desc: 'Komposit Antar Bank Universal Dunia',
    badgeCls: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30',
  },
];

export interface TradingViewModalProps {
  pair: PairOpportunity | null;
  onClose: () => void;
  defaultInterval?: '1' | '5' | '15' | '60' | '240' | 'D';
  theme?: 'dark' | 'light';
  onSelectPair?: (pairStr: string) => void;
}

const INTERVAL_LABELS: { label: string; value: '1' | '5' | '15' | '60' | '240' | 'D'; desc: string }[] = [
  { label: '1M', value: '1', desc: 'Scalp 1 Menit' },
  { label: '5M', value: '5', desc: 'Scalp 5 Menit' },
  { label: '15M', value: '15', desc: 'Scalp 15 Menit' },
  { label: '1H', value: '60', desc: 'Intraday 1 Jam' },
  { label: '4H', value: '240', desc: 'Swing 4 Jam' },
  { label: '1D', value: 'D', desc: 'Daily Bias' },
];

/**
 * Resolves exact TradingView symbol syntax based on selected broker and pair type
 */
export function resolveTradingViewSymbol(pairStr: string, broker: SupportedBroker = 'FOREXCOM'): string {
  if (!pairStr) return `${broker}:EURUSD`;
  const clean = pairStr.replace('/', '').replace(':', '').replace('-', '').toUpperCase().trim();

  // Commodities
  if (clean === 'XAUUSD' || clean === 'GOLD') {
    if (broker === 'OANDA') return 'OANDA:XAUUSD';
    if (broker === 'FX') return 'FX:XAUUSD';
    if (broker === 'PEPPERSTONE') return 'PEPPERSTONE:XAUUSD';
    if (broker === 'CAPITALCOM') return 'CAPITALCOM:GOLD';
    return 'FOREXCOM:XAUUSD';
  }
  if (clean === 'XAGUSD' || clean === 'SILVER') {
    if (broker === 'OANDA') return 'OANDA:XAGUSD';
    if (broker === 'FX') return 'FX:XAGUSD';
    if (broker === 'PEPPERSTONE') return 'PEPPERSTONE:XAGUSD';
    if (broker === 'CAPITALCOM') return 'CAPITALCOM:SILVER';
    return 'FOREXCOM:XAGUSD';
  }
  if (clean === 'WTI' || clean === 'USOIL' || clean === 'OIL') {
    if (broker === 'OANDA') return 'OANDA:WTICOUSD';
    if (broker === 'CAPITALCOM') return 'CAPITALCOM:OIL_CRUDE';
    return 'TVC:USOIL';
  }
  if (clean === 'GOLDSILVER') {
    return 'OANDA:XAUUSD/OANDA:XAGUSD';
  }

  // Stock Indices
  if (clean === 'US30' || clean === 'DJI') {
    if (broker === 'OANDA') return 'OANDA:US30USD';
    if (broker === 'CAPITALCOM') return 'CAPITALCOM:US30';
    return 'FOREXCOM:US30';
  }
  if (clean === 'NAS100' || clean === 'NDX') {
    if (broker === 'OANDA') return 'OANDA:NAS100USD';
    if (broker === 'CAPITALCOM') return 'CAPITALCOM:US100';
    return 'FOREXCOM:NAS100';
  }
  if (clean === 'SPX500' || clean === 'SPX') {
    if (broker === 'OANDA') return 'OANDA:SPX500USD';
    if (broker === 'CAPITALCOM') return 'CAPITALCOM:US500';
    return 'FOREXCOM:SPX500';
  }
  if (clean === 'DAX' || clean === 'GER40') {
    if (broker === 'OANDA') return 'OANDA:DE30EUR';
    if (broker === 'CAPITALCOM') return 'CAPITALCOM:DE40';
    return 'FOREXCOM:GER40';
  }

  // Cryptocurrencies
  if (clean.includes('BTC')) return 'BINANCE:BTCUSDT';
  if (clean.includes('ETH')) return 'BINANCE:ETHUSDT';
  if (clean.includes('SOL')) return 'BINANCE:SOLUSDT';
  if (clean.includes('XRP')) return 'BINANCE:XRPUSDT';
  if (clean.includes('DOGE')) return 'BINANCE:DOGEUSDT';
  if (clean.includes('ADA')) return 'BINANCE:ADAUSDT';
  if (clean.includes('BNB')) return 'BINANCE:BNBUSDT';

  // Standard Forex 28 Pairs (e.g. CADCHF, CADJPY, EURUSD, USDJPY, etc.)
  // Format: "FOREXCOM:CADCHF" or "OANDA:CADCHF" or "PEPPERSTONE:CADCHF" etc.
  return `${broker}:${clean}`;
}

export const TradingViewModal: React.FC<TradingViewModalProps> = ({
  pair,
  onClose,
  defaultInterval = '15',
  theme = 'light',
  onSelectPair,
}) => {
  const isLight = theme === 'light';

  // Active Pair State
  const [currentPairStr, setCurrentPairStr] = useState<string>(() => pair?.pair || 'CAD/CHF');
  const [interval, setInterval] = useState<'1' | '5' | '15' | '60' | '240' | 'D'>(defaultInterval);
  const [key, setKey] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Preferred Broker with localStorage persistence
  const [broker, setBroker] = useState<SupportedBroker>(() => {
    try {
      const saved = localStorage.getItem('flowmonitor_preferred_broker');
      if (saved && SUPPORTED_BROKERS.some((b) => b.id === saved)) {
        return saved as SupportedBroker;
      }
    } catch {}
    return 'FOREXCOM'; // Default to FOREX.com
  });

  // Keep currentPairStr in sync if pair prop changes
  useEffect(() => {
    if (pair?.pair && pair.pair !== currentPairStr) {
      setCurrentPairStr(pair.pair);
      setKey((k) => k + 1);
    }
  }, [pair?.pair]);

  // Handle Broker Switch
  const handleBrokerChange = (newBroker: SupportedBroker) => {
    setBroker(newBroker);
    try {
      localStorage.setItem('flowmonitor_preferred_broker', newBroker);
    } catch {}
    setKey((k) => k + 1);
  };

  // Handle Pair Switch from internal dropdown
  const handlePairChange = (newPair: string) => {
    setCurrentPairStr(newPair);
    if (onSelectPair) {
      onSelectPair(newPair);
    }
    setKey((k) => k + 1);
  };

  // Resolved TradingView symbol
  const tradingViewSymbol = useMemo(() => {
    return resolveTradingViewSymbol(currentPairStr, broker);
  }, [currentPairStr, broker]);

  const activeBrokerInfo = useMemo(() => {
    return SUPPORTED_BROKERS.find((b) => b.id === broker) || SUPPORTED_BROKERS[0];
  }, [broker]);

  // Construct iframe source URL
  const iframeSrc = useMemo(() => {
    const sym = encodeURIComponent(tradingViewSymbol);
    const thm = isLight ? 'light' : 'dark';
    const bg = isLight ? 'f8fafc' : '131920';
    return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${sym}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=${bg}&theme=${thm}&style=1&timezone=Asia%2FJakarta&locale=id`;
  }, [tradingViewSymbol, interval, isLight]);

  // Copy symbol to clipboard
  const handleCopySymbol = () => {
    navigator.clipboard?.writeText(tradingViewSymbol).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!pair && !currentPairStr) return null;

  const baseCode = (pair?.base || (currentPairStr.includes('/') ? currentPairStr.split('/')[0] : 'CAD')) as CurrencyCode;
  const quoteCode = (pair?.quote || (currentPairStr.includes('/') ? currentPairStr.split('/')[1] : 'CHF')) as CurrencyCode;
  const baseConf = getCurrencyConfig(baseCode);
  const quoteConf = getCurrencyConfig(quoteCode);
  const isBullish = (pair?.divergence ?? 0) >= 0;

  // External direct link to official TradingView chart for this broker symbol
  const tradingViewWebUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-6xl h-[94vh] max-h-[920px] bg-white dark:bg-[#131920] border border-[#dbe3e8] dark:border-[#27313b] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors">
        
        {/* ── 1. TOP HEADER & PAIR SYNCHRONIZER ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#dbe3e8] dark:border-[#27313b] bg-[#f8fafc] dark:bg-[#0c1015]">
          {/* Pair Identity & Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center -space-x-1 text-base sm:text-lg">
              <span>{baseConf?.flag || '🌐'}</span>
              <span>{quoteConf?.flag || '🌐'}</span>
            </div>

            {/* Quick Pair Switcher Dropdown */}
            <div className="relative">
              <select
                value={currentPairStr}
                onChange={(e) => handlePairChange(e.target.value)}
                className="font-mono font-bold text-base sm:text-lg bg-white dark:bg-[#192129] border border-[#dbe3e8] dark:border-[#27313b] rounded-lg px-2.5 py-1 text-slate-900 dark:text-zinc-100 focus:outline-hidden cursor-pointer shadow-2xs"
              >
                <optgroup label="28 Pasangan Forex Cross">
                  {PAIR_DEFINITIONS.map((def) => (
                    <option key={def.pair} value={def.pair}>
                      {def.pair}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Komoditas Prime">
                  <option value="XAU/USD">XAU/USD (Gold Emas)</option>
                  <option value="XAG/USD">XAG/USD (Silver Perak)</option>
                  <option value="WTI">WTI (Crude Oil)</option>
                </optgroup>
                <optgroup label="Indeks Saham Utama">
                  <option value="US30">US30 (Dow Jones 30)</option>
                  <option value="NAS100">NAS100 (Nasdaq Tech)</option>
                  <option value="SPX500">SPX500 (S&P 500)</option>
                  <option value="GER40">GER40 (DAX 40)</option>
                </optgroup>
                <optgroup label="Aset Kripto Teratas">
                  <option value="BTC/USDT">BTC/USDT (Bitcoin)</option>
                  <option value="ETH/USDT">ETH/USDT (Ethereum)</option>
                  <option value="SOL/USDT">SOL/USDT (Solana)</option>
                </optgroup>
              </select>
            </div>

            {/* Active TradingView Symbol Pill Badge + Copy */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold">{tradingViewSymbol}</span>
              <button
                onClick={handleCopySymbol}
                className="p-0.5 hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer ml-1"
                title="Salin Simbol TradingView"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Bias Indicator */}
            {pair && (
              <div
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold ${
                  isBullish
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {isBullish ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{isBullish ? 'BIAS BUY' : 'BIAS SELL'}</span>
                <span className="text-[11px] opacity-80">
                  (Δ {pair.divergence > 0 ? `+${pair.divergence.toFixed(2)}` : pair.divergence.toFixed(2)})
                </span>
              </div>
            )}
          </div>

          {/* Controls: Quick Timeframes + Refresh + External Link + Close */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Quick Timeframe Switcher */}
            <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-[#192129] border border-[#dbe3e8] dark:border-[#27313b] rounded-lg text-xs font-mono">
              {INTERVAL_LABELS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setInterval(item.value)}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    interval === item.value
                      ? 'bg-white dark:bg-[#131920] text-emerald-700 dark:text-emerald-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={`${item.label} (${item.desc})`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => setKey((k) => k + 1)}
              className="p-1.5 rounded-lg border border-[#dbe3e8] dark:border-[#27313b] bg-white dark:bg-[#192129] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Muat Ulang Widget"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* External link to TradingView.com */}
            <a
              href={tradingViewWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg border border-[#dbe3e8] dark:border-[#27313b] bg-white dark:bg-[#192129] text-slate-700 dark:text-zinc-300 hover:text-[#137854] dark:hover:text-[#82e6be] transition-colors cursor-pointer hidden sm:flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
              title={`Buka ${tradingViewSymbol} langsung di situs TradingView`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>TradingView.com ↗</span>
            </a>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Tutup Chart (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. BROKER SYNCHRONIZER STRIP (FOREX.com, OANDA, FXCM, Pepperstone, etc.) ── */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100/90 dark:bg-[#0c1015] border-b border-[#dbe3e8] dark:border-[#27313b] flex flex-wrap items-center justify-between text-xs gap-2">
          {/* Quick Broker Selector Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>Pilih Broker:</span>
            </span>
            {SUPPORTED_BROKERS.map((b) => {
              const isActive = broker === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => handleBrokerChange(b.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-white dark:bg-[#192129] text-[#137854] dark:text-[#82e6be] border-emerald-500/50 shadow-xs'
                      : 'bg-transparent text-slate-600 dark:text-zinc-400 border-transparent hover:bg-slate-200/60 dark:hover:bg-[#192129]/60'
                  }`}
                  title={`${b.name} (${b.tag}): ${b.desc}`}
                >
                  <span>{b.name}</span>
                  {isActive && <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Broker Data Feed Status Badge */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
            <span className="hidden lg:inline text-slate-500">Feed:</span>
            <strong className="text-slate-900 dark:text-white font-bold">{activeBrokerInfo.name}</strong>
            <span className="text-slate-400 hidden sm:inline">({activeBrokerInfo.desc})</span>
            {pair && (
              <>
                <span className="text-slate-300 dark:text-zinc-700">|</span>
                <span>
                  {pair.base}: <strong className="text-slate-900 dark:text-white">{formatScore(pair.baseScore)}</strong> vs{' '}
                  {pair.quote}: <strong className="text-slate-900 dark:text-white">{formatScore(pair.quoteScore)}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── 3. TRADINGVIEW EMBEDDED WIDGET CONTAINER ── */}
        <div className="flex-1 w-full h-full relative bg-white dark:bg-[#131920] overflow-hidden">
          <iframe
            key={`${tradingViewSymbol}-${interval}-${isLight ? 'light' : 'dark'}-${key}`}
            src={iframeSrc}
            title={`TradingView Chart ${tradingViewSymbol}`}
            className="w-full h-full border-0 absolute inset-0"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
};
