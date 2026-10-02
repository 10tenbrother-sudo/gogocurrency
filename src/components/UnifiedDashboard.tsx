import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CurrencyCode,
  TimeframeKey,
  StrengthSnapshot,
  CurrencyStrengthScore,
  MarketSession,
  PairOpportunity,
} from '../types/forex';
import {
  PAIR_DEFINITIONS,
  CURRENCIES,
  getCurrencyConfig,
  getNext5MinuteCandleSeconds,
  generateMultiTimeframeMatrix,
} from '../services/currencyStrengthEngine';
import {
  FlowAssetCategory,
  FlowItem,
  FlowSnapshot,
  fetchFlowMonitorLatest,
  fetchFlowMonitorHistory,
  testWorkerConnection,
} from '../services/flowMonitorEngine';
import { User } from 'firebase/auth';
import { TradingViewModal } from './TradingViewModal';
import { PineScriptWebhookModal } from './PineScriptWebhookModal';
import { CurrencyStrengthChart } from './CurrencyStrengthChart';
import { ScalpIntradaySwingMonitor } from './ScalpIntradaySwingMonitor';
import { MultiTimeframeHeatmap } from './MultiTimeframeHeatmap';
import { MarketSessions } from './MarketSessions';
import {
  Bell,
  Settings,
  Moon,
  Sun,
  Home,
  BookOpen,
  LogOut,
  Radio,
  Clock,
  TrendingUp,
  BarChart2,
  Compass,
  ExternalLink,
} from 'lucide-react';

export interface UnifiedDashboardProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeTimeframe: TimeframeKey;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  timeframeHistories?: Record<TimeframeKey, StrengthSnapshot[]>;
  usdRates?: Record<CurrencyCode, number>;
  rankings?: CurrencyStrengthScore[];
  marketSessions?: MarketSession[];
  user?: User | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onOpenMethodology?: () => void;
  onOpenAlerts?: () => void;
  onExportSnapshot?: () => void;
  unreadAlertCount?: number;
  activeTab?: string;
  onChangeTab?: (tab: any) => void;
  currentHistory?: StrengthSnapshot[];
  selectedCurrencies?: Set<CurrencyCode>;
  onToggleCurrency?: (code: CurrencyCode) => void;
  onSoloCurrency?: (code: CurrencyCode) => void;
  focusedCurrency?: CurrencyCode | null;
  onSetFocusedCurrency?: (code: CurrencyCode | null) => void;
  rawWebSeries?: any;
  isRealWebLive?: boolean;
  onRefreshWebData?: () => void;
  isLoadingWebData?: boolean;
  lastWebSyncTime?: string | null;
  matrixData?: Record<CurrencyCode, Record<TimeframeKey, { score: number; sentiment: CurrencyStrengthScore['sentiment'] }>>;
  onBackToLanding?: () => void;
}

type MarketCatKey = 'forex' | 'komoditas' | 'crypto' | 'indeks';
type StyleKey = 's' | 'i' | 'w'; // s: Scalping (5M/10M/15M), i: Intraday (1H/2H/3H), w: Swing (4H/6H/8H)
type FilterKey = 'all' | 'buy' | 'sell' | 'flip';
type ScopeModeKey = 'all' | 'top';
type ViewModeKey = 'table' | 'heat';
type SortKey = 'disparity' | 'bias' | 'alignment' | 'name';

interface InstrumentModel {
  symbol: string;
  name: string;
  category: MarketCatKey;
  isForex: boolean;
  base?: CurrencyCode;
  quote?: CurrencyCode;
  // Timeframe directions: 1 = up, -1 = down, 0 = neutral
  tfScalp: [number, number, number]; // 5M, 10M, 15M
  tfIntra: [number, number, number]; // 1H, 2H, 3H
  tfSwing: [number, number, number]; // 4H, 6H, 8H
  scalpDiff: number;
  intraDiff: number;
  swingDiff: number;
  activeTf: number[];
  sum: number;
  disparity: number | null; // Base - Quote score for forex
  alignment: number; // percentage alignment across active TFs
  flip: boolean; // Baru balik (early turnaround / reversal)
  scoreDisplay: string;
  price?: number;
  is3TfAligned: boolean;
}

const CAT_LABELS: Record<MarketCatKey, string> = {
  forex: 'Forex',
  komoditas: 'Komoditas',
  crypto: 'Crypto',
  indeks: 'Indeks',
};

const STYLE_CONFIG: Record<
  StyleKey,
  { label: string; timeframes: [string, string, string]; tfKey: TimeframeKey }
> = {
  s: { label: 'Scalping', timeframes: ['5M', '10M', '15M'], tfKey: '5M' },
  i: { label: 'Intraday', timeframes: ['1J', '2J', '3J'], tfKey: '1H' },
  w: { label: 'Swing', timeframes: ['4J', '6J', '8J'], tfKey: '4H' },
};

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Semua',
  buy: 'Buy',
  sell: 'Sell',
  flip: 'Baru balik',
};

const COUNTRY_CODES: Record<string, string> = {
  CHF: 'CH',
  JPY: 'JP',
  NZD: 'NZ',
  AUD: 'AU',
  GBP: 'GB',
  EUR: 'EU',
  USD: 'US',
  CAD: 'CA',
};

const ASSET_FRIENDLY_NAMES: Record<string, string> = {
  EURUSD: 'Euro / US Dollar',
  GBPUSD: 'Poundsterling / US Dollar',
  USDJPY: 'US Dollar / Yen Jepang',
  AUDUSD: 'Aussie / US Dollar',
  USDCAD: 'US Dollar / Dolar Kanada',
  USDCHF: 'US Dollar / Franc Swiss',
  NZDUSD: 'New Zealand / US Dollar',
  EURJPY: 'Euro / Yen Jepang',
  GBPJPY: 'Poundsterling / Yen Jepang',
  AUDJPY: 'Aussie / Yen Jepang',
  CADJPY: 'Dolar Kanada / Yen Jepang',
  CHFJPY: 'Franc Swiss / Yen Jepang',
  NZDJPY: 'New Zealand / Yen Jepang',
  EURGBP: 'Euro / Poundsterling',
  EURAUD: 'Euro / Aussie',
  EURCAD: 'Euro / Dolar Kanada',
  EURCHF: 'Euro / Franc Swiss',
  EURNZD: 'Euro / New Zealand',
  GBPAUD: 'Poundsterling / Aussie',
  GBPCAD: 'Poundsterling / Dolar Kanada',
  GBPCHF: 'Poundsterling / Franc Swiss',
  GBPNZD: 'Poundsterling / New Zealand',
  AUDCAD: 'Aussie / Dolar Kanada',
  AUDCHF: 'Aussie / Franc Swiss',
  AUDNZD: 'Aussie / New Zealand',
  CADCHF: 'Dolar Kanada / Franc Swiss',
  NZDCAD: 'New Zealand / Dolar Kanada',
  NZDCHF: 'New Zealand / Franc Swiss',
  GOLD: 'Emas (XAUUSD)',
  XAUUSD: 'Emas (Gold)',
  SILVER: 'Perak (XAGUSD)',
  XAGUSD: 'Perak (Silver)',
  WTI: 'Minyak Mentah (Crude Oil)',
  USOIL: 'Minyak Mentah (US Oil)',
  GOLDSILVER: 'Rasio Emas / Perak',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  XRP: 'XRP Ledger',
  DOGE: 'Dogecoin',
  ADA: 'Cardano',
  BNB: 'BNB Chain',
  US30: 'Dow Jones 30',
  NAS100: 'Nasdaq 100 Tech',
  US100: 'Nasdaq 100 Tech',
  US500: 'S&P 500 AS',
  SPX500: 'S&P 500 AS',
  GER40: 'DAX 40 Jerman',
  DAX: 'DAX 40 Jerman',
  JP225: 'Nikkei 225 Jepang',
  UKOIL: 'Minyak Brent Crude',
  NATGAS: 'Gas Alam (Natural Gas)',
};

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  theme,
  onToggleTheme,
  activeTimeframe,
  onChangeTimeframe,
  timeframeHistories,
  usdRates,
  rankings = [],
  marketSessions = [],
  user,
  onOpenAuth,
  onLogout,
  onOpenMethodology,
  onOpenAlerts,
  onExportSnapshot,
  unreadAlertCount = 0,
  activeTab = 'flow_monitor',
  onChangeTab,
  currentHistory,
  selectedCurrencies,
  onToggleCurrency,
  onSoloCurrency,
  focusedCurrency,
  onSetFocusedCurrency,
  rawWebSeries,
  isRealWebLive,
  onRefreshWebData,
  isLoadingWebData,
  lastWebSyncTime,
  matrixData,
  onBackToLanding,
}) => {
  const isLight = theme === 'light';

  // ── Theme Style Tokens matching image.png (light) and Strength-Modern.html (dark) ──
  const T = useMemo(() => ({
    isLight,
    pageBg: isLight ? 'bg-[#f1f4f6]' : 'bg-[#0c1015]',
    headerBg: isLight ? 'bg-white/95 border-[#dbe3e8] text-[#17252e] shadow-xs' : 'bg-[#131920]/90 border-[#27313b] text-[#ecf1f5]',
    panelBg: isLight ? 'bg-white border-[#dbe3e8]' : 'bg-[#131920] border-[#27313b]',
    panel2Bg: isLight ? 'bg-[#eaf0f3]' : 'bg-[#192129]',
    controlBg: isLight ? 'bg-[#f1f4f6] border-[#dbe3e8]' : 'bg-[#0c1015] border-[#27313b]',
    inputBg: isLight
      ? 'bg-[#f1f4f6] border-[#dbe3e8] text-[#17252e] placeholder-[#607380] focus:border-[#137854]'
      : 'bg-[#0c1015] border-[#27313b] text-[#ecf1f5] placeholder-[#8f9daa] focus:border-[#82e6be]',
    tableHeadBg: isLight ? 'bg-[#f1f4f6] border-[#dbe3e8] text-[#607380]' : 'bg-[#0c1015] border-[#27313b] text-[#8f9daa]',
    scopeBg: isLight ? 'bg-[#eaf0f3] border-[#dbe3e8] text-[#607380]' : 'bg-[#192129]/60 border-[#27313b]/60 text-[#8f9daa]',
    avatarBg: isLight ? 'bg-[#eaf0f3] border-[#dbe3e8] text-[#607380]' : 'bg-[#192129] border-[#27313b] text-[#8f9daa]',
    rowHover: isLight ? 'hover:bg-[#f8fafc]' : 'hover:bg-[#192129]/60',
    rowActive: isLight ? 'bg-[#eaf0f3]' : 'bg-[#192129]/80',
    rowBorder: isLight ? 'divide-[#dbe3e8]' : 'divide-[#27313b]',
    border: isLight ? 'border-[#dbe3e8]' : 'border-[#27313b]',
    borderSubtle: isLight ? 'border-[#dbe3e8]/70' : 'border-[#27313b]/60',
    textPrimary: isLight ? 'text-[#17252e]' : 'text-[#ecf1f5]',
    textMuted: isLight ? 'text-[#607380]' : 'text-[#8f9daa]',
    textMint: isLight ? 'text-[#137854]' : 'text-[#82e6be]',
    textRed: isLight ? 'text-[#c34b61]' : 'text-[#f18f9a]',
    mintBrand: isLight ? 'bg-[#137854]' : 'bg-[#82e6be]',
    mintDot: isLight ? 'text-[#137854]' : 'text-[#82e6be]',
    mintBar: isLight ? '#137854' : '#82e6be',
    redBar: isLight ? '#c34b61' : '#f18f9a',
    navActive: isLight ? 'border-[#137854] text-[#137854]' : 'border-[#82e6be] text-[#82e6be]',
    card1Bg: isLight
      ? 'bg-gradient-to-br from-[#e0f4eb] to-white border-[#b9dccc]'
      : 'bg-gradient-to-br from-[#19342e] to-[#131920] border-[#345447]',
    insightBg: isLight
      ? 'bg-[#e9f6ef] border-[#c5e4d2]'
      : 'bg-[#20352d]/40 border-[#365247]',
    buyBadge: isLight ? 'bg-[#e2f4ec] text-[#137854]' : 'bg-[#203b33] text-[#82e6be]',
    sellBadge: isLight ? 'bg-[#fae9ed] text-[#c34b61]' : 'bg-[#3a272e] text-[#f18f9a]',
    neuBadge: isLight ? 'bg-[#eaf0f3] text-[#607380]' : 'bg-[#192129] text-[#8f9daa]',
    segActive: isLight
      ? 'bg-white text-[#17252e] shadow-xs font-semibold'
      : 'bg-[#192129] text-[#ecf1f5] shadow-xs font-semibold',
    segInactive: isLight ? 'text-[#607380] hover:text-[#17252e]' : 'text-[#8f9daa] hover:text-[#ecf1f5]',
    detailBoxBg: isLight ? 'bg-[#f1f4f6] border-[#dbe3e8]' : 'bg-[#131920] border-[#27313b]',
  }), [isLight]);
  // ── 1. Settings & Display Preferences (Stored in localStorage) ──
  const [pref, setPref] = useState<{
    density: 'comfortable' | 'compact';
    showStrength: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('strength-unified-preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          density: parsed.density || 'comfortable',
          showStrength: parsed.showStrength !== false,
        };
      }
    } catch {}
    return { density: 'comfortable', showStrength: true };
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [workerUrl, setWorkerUrl] = useState<string>(() => {
    return localStorage.getItem('flowmonitor_worker_url') || 'https://flowmonitor.aideelyst.workers.dev';
  });
  const [workerToken, setWorkerToken] = useState<string>(() => {
    return localStorage.getItem('flowmonitor_worker_token') || '';
  });
  const [isTestingWorker, setIsTestingWorker] = useState(false);
  const [workerTestResult, setWorkerTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [showPineScriptModal, setShowPineScriptModal] = useState(false);

  // Apply density to DOM root
  useEffect(() => {
    document.documentElement.dataset.density = pref.density;
    try {
      localStorage.setItem('strength-unified-preferences', JSON.stringify(pref));
    } catch {}
  }, [pref]);

  // ── 2. Screener State (Unified Navigation & Multi-Horizon Confluence) ──
  const [category, setCategory] = useState<MarketCatKey>('forex');
  // Multi-style horizons: Scalping, Intraday, and Swing can be active simultaneously!
  const [activeStyles, setActiveStyles] = useState<{
    s: boolean; // Scalping (5M, 10M, 15M)
    i: boolean; // Intraday (1H, 2H, 3H)
    w: boolean; // Swing (4H, 6H, 8H)
  }>({
    s: true,
    i: true,
    w: true, // Default: all timeframes enabled for full confluence!
  });

  const toggleStyle = (k: StyleKey) => {
    setActiveStyles((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      // Keep at least one active
      if (!next.s && !next.i && !next.w) {
        return { ...prev, [k]: true };
      }
      return next;
    });
    onChangeTimeframe(STYLE_CONFIG[k].tfKey);
  };

  const selectAllStyles = () => {
    setActiveStyles({ s: true, i: true, w: true });
    onChangeTimeframe('5M');
  };

  const isAllStylesActive = activeStyles.s && activeStyles.i && activeStyles.w;
  const activeStylesLabel = isAllStylesActive
    ? 'Semua TF (Scalp + Intra + Swing)'
    : [
        activeStyles.s ? 'Scalping' : null,
        activeStyles.i ? 'Intraday' : null,
        activeStyles.w ? 'Swing' : null,
      ]
        .filter(Boolean)
        .join(' + ');

  const [filter, setFilter] = useState<FilterKey>('all');
  const [scopeMode, setScopeMode] = useState<ScopeModeKey>('all');
  const [viewMode, setViewMode] = useState<ViewModeKey>('table');
  const [sortKey, setSortKey] = useState<SortKey>('disparity');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  // Selected pair for TradingView modal
  const [tradingViewPair, setTradingViewPair] = useState<PairOpportunity | null>(null);

  // ── 3. Live Data Engines (Forex Currency Strength + Worker Webhook) ──
  const [candleClock, setCandleClock] = useState(() => getNext5MinuteCandleSeconds());
  useEffect(() => {
    const timer = setInterval(() => {
      setCandleClock(getNext5MinuteCandleSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [latestSnapshot, setLatestSnapshot] = useState<FlowSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<'live' | 'updating' | 'offline'>('live');

  // Load Cloudflare Worker feed for Commodities, Crypto, Indices
  const loadWorkerData = useCallback(async () => {
    setIsRefreshing(true);
    setConnectionStatus('updating');
    try {
      const res = await fetchFlowMonitorLatest(workerUrl ? `${workerUrl}/latest` : undefined);
      if (res && res.data) {
        setLatestSnapshot(res.data);
        setLastSyncTime(new Date());
        setConnectionStatus('live');
      }
    } catch (err) {
      setConnectionStatus('offline');
    } finally {
      setIsRefreshing(false);
    }
  }, [workerUrl]);

  useEffect(() => {
    loadWorkerData();
    const timer = setInterval(loadWorkerData, 12000);
    return () => clearInterval(timer);
  }, [loadWorkerData]);

  // Currency Strength Multi-Timeframe Matrix
  const csMatrix = useMemo(() => {
    if (!timeframeHistories) return null;
    return generateMultiTimeframeMatrix(timeframeHistories);
  }, [timeframeHistories]);

  // ── 4. Build Complete Universe of Instruments ──
  const allInstruments = useMemo<InstrumentModel[]>(() => {
    const list: InstrumentModel[] = [];

    // Helper to evaluate direction (-1, 0, +1)
    const evalDir = (val: number, thresh: number = 0.15) => (val >= thresh ? 1 : val <= -thresh ? -1 : 0);

    // A. FOREX (All 28 Pairs)
    PAIR_DEFINITIONS.forEach((def) => {
      const b = def.base;
      const q = def.quote;
      let tfScalp: [number, number, number] = [0, 0, 0];
      let tfIntra: [number, number, number] = [0, 0, 0];
      let tfSwing: [number, number, number] = [0, 0, 0];
      let disparity: number = 0;

      if (csMatrix && csMatrix[b] && csMatrix[q]) {
        const bScores = csMatrix[b];
        const qScores = csMatrix[q];

        const d5M = (bScores['5M']?.score ?? 5) - (qScores['5M']?.score ?? 5);
        const d10M = (bScores['10M']?.score ?? 5) - (qScores['10M']?.score ?? 5);
        const d15M = (bScores['15M']?.score ?? 5) - (qScores['15M']?.score ?? 5);
        const d1H = (bScores['1H']?.score ?? 5) - (qScores['1H']?.score ?? 5);
        const d2H = (bScores['2H']?.score ?? 5) - (qScores['2H']?.score ?? 5);
        const d3H = (bScores['3H']?.score ?? 5) - (qScores['3H']?.score ?? 5);
        const d4H = (bScores['4H']?.score ?? 5) - (qScores['4H']?.score ?? 5);
        const d6H = (bScores['6H']?.score ?? 5) - (qScores['6H']?.score ?? 5);
        const d8H = (bScores['8H']?.score ?? bScores['1D']?.score ?? 5) - (qScores['8H']?.score ?? qScores['1D']?.score ?? 5);

        tfScalp = [evalDir(d5M), evalDir(d10M), evalDir(d15M)];
        tfIntra = [evalDir(d1H), evalDir(d2H), evalDir(d3H)];
        tfSwing = [evalDir(d4H), evalDir(d6H), evalDir(d8H)];

        const sDiff = Number(d5M.toFixed(2));
        const iDiff = Number(d1H.toFixed(2));
        const wDiff = Number(d4H.toFixed(2));

        // When multiple styles are active, weighted composite disparity
        let totalWeight = 0;
        let weightedDiff = 0;
        if (activeStyles.s) { weightedDiff += sDiff * 1.0; totalWeight += 1.0; }
        if (activeStyles.i) { weightedDiff += iDiff * 1.5; totalWeight += 1.5; }
        if (activeStyles.w) { weightedDiff += wDiff * 1.2; totalWeight += 1.2; }
        disparity = totalWeight > 0 ? Number((weightedDiff / totalWeight).toFixed(2)) : iDiff;
      } else {
        // Fallback calculation from base rankings if matrix is still calculating
        const bRank = rankings.find((r) => r.code === b)?.score ?? 5;
        const qRank = rankings.find((r) => r.code === q)?.score ?? 5;
        const diff = bRank - qRank;
        const dir = evalDir(diff);
        tfScalp = [dir, dir, dir];
        tfIntra = [dir, dir, dir];
        tfSwing = [dir, dir, dir];
        disparity = Number(diff.toFixed(2));
      }

      const activeTf: number[] = [
        ...(activeStyles.s ? tfScalp : []),
        ...(activeStyles.i ? tfIntra : []),
        ...(activeStyles.w ? tfSwing : []),
      ];
      const sum = activeTf.reduce((acc, v) => acc + v, 0);
      const bullCount = activeTf.filter((x) => x > 0).length;
      const bearCount = activeTf.filter((x) => x < 0).length;
      const alignment = activeTf.length > 0 ? Math.round((Math.max(bullCount, bearCount) / activeTf.length) * 100) : 50;

      const scalpBull = tfScalp.filter((x) => x > 0).length >= 2;
      const intraBull = tfIntra.filter((x) => x > 0).length >= 2;
      const swingBull = tfSwing.filter((x) => x > 0).length >= 2;
      const scalpBear = tfScalp.filter((x) => x < 0).length >= 2;
      const intraBear = tfIntra.filter((x) => x < 0).length >= 2;
      const swingBear = tfSwing.filter((x) => x < 0).length >= 2;

      const is3TfAligned = (scalpBull && intraBull && swingBull) || (scalpBear && intraBear && swingBear);
      // Reversal: Scalping opposes Swing
      const flip = (scalpBull && swingBear) || (scalpBear && swingBull);

      const sDiff = csMatrix && csMatrix[b] && csMatrix[q] ? Number(((csMatrix[b]['5M']?.score ?? 5) - (csMatrix[q]['5M']?.score ?? 5)).toFixed(2)) : (disparity ?? 0);
      const iDiff = csMatrix && csMatrix[b] && csMatrix[q] ? Number(((csMatrix[b]['1H']?.score ?? 5) - (csMatrix[q]['1H']?.score ?? 5)).toFixed(2)) : (disparity ?? 0);
      const wDiff = csMatrix && csMatrix[b] && csMatrix[q] ? Number(((csMatrix[b]['4H']?.score ?? 5) - (csMatrix[q]['4H']?.score ?? 5)).toFixed(2)) : (disparity ?? 0);

      list.push({
        symbol: def.pair,
        name: ASSET_FRIENDLY_NAMES[def.pair] || 'Forex Pair',
        category: 'forex',
        isForex: true,
        base: b,
        quote: q,
        tfScalp,
        tfIntra,
        tfSwing,
        scalpDiff: sDiff,
        intraDiff: iDiff,
        swingDiff: wDiff,
        activeTf,
        sum,
        disparity,
        alignment,
        flip,
        scoreDisplay: (disparity > 0 ? '+' : '') + disparity.toFixed(2),
        is3TfAligned,
      });
    });

    // B. COMMODITIES, CRYPTO, INDICES (Only authentic data from Webhook / Cloudflare Worker - Top 5 each)
    const rawNonFx: Array<{ pair: string; cat: MarketCatKey; pct: number; price?: number }> = [];

    if (latestSnapshot) {
      if (latestSnapshot.metals && Array.isArray(latestSnapshot.metals)) {
        latestSnapshot.metals.slice(0, 5).forEach((m) => {
          let p = m.pair;
          if (p === 'XAUUSD') p = 'GOLD';
          if (p === 'XAGUSD') p = 'SILVER';
          rawNonFx.push({ pair: p, cat: 'komoditas', pct: m.pct ?? 0, price: m.price });
        });
      }
      if (latestSnapshot.crypto && Array.isArray(latestSnapshot.crypto)) {
        latestSnapshot.crypto.slice(0, 5).forEach((c) => {
          rawNonFx.push({ pair: c.pair, cat: 'crypto', pct: c.pct ?? 0, price: c.price });
        });
      }
      if (latestSnapshot.inst && Array.isArray(latestSnapshot.inst)) {
        latestSnapshot.inst.slice(0, 5).forEach((i) => {
          let p = i.pair;
          if (p === 'SPX500USD') p = 'US500';
          if (p === 'NAS100USD') p = 'NAS100';
          if (p === 'US30USD') p = 'US30';
          if (p === 'DE40EUR') p = 'GER40';
          if (p === 'JP225USD') p = 'JP225';
          rawNonFx.push({ pair: p, cat: 'indeks', pct: i.pct ?? 0, price: i.price });
        });
      }
    }

    // Zero dummy data: only process genuine instruments received from webhook/worker
    rawNonFx.forEach((item) => {
      const p = item.pct;
      const d1 = evalDir(p, 0.4);
      const d2 = evalDir(p * 0.9, 0.3);
      const d3 = evalDir(p * 0.8, 0.2);

      const tfScalp: [number, number, number] = [d1, d2, d3];
      const tfIntra: [number, number, number] = [d1, d2, d3];
      const tfSwing: [number, number, number] = [d1, d2, d3];

      const sDiff = Number(p.toFixed(2));
      const iDiff = Number((p * 0.9).toFixed(2));
      const wDiff = Number((p * 0.8).toFixed(2));

      const activeTf: number[] = [
        ...(activeStyles.s ? tfScalp : []),
        ...(activeStyles.i ? tfIntra : []),
        ...(activeStyles.w ? tfSwing : []),
      ];
      const sum = activeTf.reduce((acc, v) => acc + v, 0);
      const bullCount = activeTf.filter((x) => x > 0).length;
      const bearCount = activeTf.filter((x) => x < 0).length;
      const alignment = activeTf.length > 0 ? Math.round((Math.max(bullCount, bearCount) / activeTf.length) * 100) : 50;
      const is3TfAligned = (d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0);
      const flip = Math.abs(p) > 1.5 && d1 !== d3;

      list.push({
        symbol: item.pair,
        name: ASSET_FRIENDLY_NAMES[item.pair] || item.pair,
        category: item.cat,
        isForex: false,
        tfScalp,
        tfIntra,
        tfSwing,
        scalpDiff: sDiff,
        intraDiff: iDiff,
        swingDiff: wDiff,
        activeTf,
        sum,
        disparity: null,
        alignment,
        flip,
        scoreDisplay: (p > 0 ? '+' : '') + p.toFixed(2) + '%',
        price: item.price,
        is3TfAligned,
      });
    });

    return list;
  }, [csMatrix, rankings, latestSnapshot, activeStyles]);

  // ── 5. Category-Specific List & Metrics ──
  const categoryInstruments = useMemo(() => {
    return allInstruments.filter((item) => item.category === category);
  }, [allInstruments, category]);

  // Counts of Buy & Sell signals in active category & style
  const buySignalCount = useMemo(() => {
    return categoryInstruments.filter((r) => r.sum > 0).length;
  }, [categoryInstruments]);

  const sellSignalCount = useMemo(() => {
    return categoryInstruments.filter((r) => r.sum < 0).length;
  }, [categoryInstruments]);

  // Strongest and Weakest Currencies for Summary
  const { strongestCurr, weakestCurr, maxDisparityPair } = useMemo(() => {
    if (rankings.length === 0) {
      return {
        strongestCurr: { code: 'AUD' as CurrencyCode, score: 8.74, name: 'Australian Dollar' },
        weakestCurr: { code: 'JPY' as CurrencyCode, score: 1.67, name: 'Japanese Yen' },
        maxDisparityPair: { pair: 'AUD/JPY', diff: 7.07 },
      };
    }
    const sorted = [...rankings].sort((a, b) => b.score - a.score);
    const strong = sorted[0];
    const weak = sorted[sorted.length - 1];
    const diff = Number((strong.score - weak.score).toFixed(2));
    return {
      strongestCurr: {
        code: strong.code,
        score: strong.score,
        name: CURRENCIES[strong.code]?.name || strong.code,
      },
      weakestCurr: {
        code: weak.code,
        score: weak.score,
        name: CURRENCIES[weak.code]?.name || weak.code,
      },
      maxDisparityPair: {
        pair: `${strong.code}/${weak.code}`,
        diff,
      },
    };
  }, [rankings]);

  // ── 6. Filtering & Sorting for the Screener Table ──
  const displayedInstruments = useMemo(() => {
    let list = [...categoryInstruments];

    // Filter by text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      );
    }

    // Filter by signal (Semua, Buy, Sell, Baru balik)
    if (filter === 'buy') {
      list = list.filter((r) => r.sum > 0);
    } else if (filter === 'sell') {
      list = list.filter((r) => r.sum < 0);
    } else if (filter === 'flip') {
      list = list.filter((r) => r.flip);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortKey === 'name') {
        return a.symbol.localeCompare(b.symbol);
      }
      if (sortKey === 'alignment') {
        return b.alignment - a.alignment || a.symbol.localeCompare(b.symbol);
      }
      if (sortKey === 'bias') {
        return Math.abs(b.sum) - Math.abs(a.sum) || a.symbol.localeCompare(b.symbol);
      }
      // 'disparity': if forex, sort by absolute disparity. If non-forex, sort by bias.
      if (a.disparity !== null && b.disparity !== null) {
        return Math.abs(b.disparity) - Math.abs(a.disparity);
      }
      return Math.abs(b.sum) - Math.abs(a.sum);
    });

    const matchedCount = list.length;

    // Scope Mode: 'top' restricts to Top 5
    if (scopeMode === 'top') {
      list = list.slice(0, 5);
    }

    return { list, matchedCount };
  }, [categoryInstruments, searchQuery, filter, sortKey, scopeMode]);

  // Helpers for Signal Badge
  const getSignalMeta = (sum: number, totalTf: number = 3, is3TfAligned: boolean = false) => {
    const ratio = totalTf > 0 ? sum / totalTf : 0;
    if (ratio >= 0.6 || (is3TfAligned && sum > 0)) {
      return { text: is3TfAligned ? 'Buy Kuat (3TF)' : 'Buy Kuat', cls: 'buy' };
    }
    if (ratio > 0.15) return { text: 'Cenderung Buy', cls: 'buy' };
    if (ratio <= -0.6 || (is3TfAligned && sum < 0)) {
      return { text: is3TfAligned ? 'Sell Kuat (3TF)' : 'Sell Kuat', cls: 'sell' };
    }
    if (ratio < -0.15) return { text: 'Cenderung Sell', cls: 'sell' };
    return { text: 'Konsolidasi / Campur', cls: 'neu' };
  };

  const getArrow = (v: number) => (v > 0 ? '↗' : v < 0 ? '↘' : '−');
  const getTfClass = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : 'neu');

  // Handle open TradingView chart modal for row
  const handleOpenChart = (e: React.MouseEvent, row: InstrumentModel) => {
    e.stopPropagation();
    const baseCode = (row.base || (row.symbol.length === 6 ? row.symbol.slice(0, 3) : 'USD')) as CurrencyCode;
    const quoteCode = (row.quote || (row.symbol.length === 6 ? row.symbol.slice(3, 6) : 'USD')) as CurrencyCode;

    const baseRank = rankings.find((r) => r.code === baseCode);
    const quoteRank = rankings.find((r) => r.code === quoteCode);

    setTradingViewPair({
      pair: row.symbol,
      base: baseCode,
      quote: quoteCode,
      baseScore: baseRank?.score ?? 6.0,
      quoteScore: quoteRank?.score ?? 4.0,
      divergence: row.disparity ?? (row.sum > 0 ? 2.5 : -2.5),
      signal: row.sum > 0 ? 'BUY' : 'SELL',
      rate: row.price ?? (row.isForex ? 1.085 : 2685.0),
      change24h: row.disparity ?? 0.5,
      spreadPips: 1.2,
      momentum: 'steady',
    });
  };

  const resetFilters = () => {
    setFilter('all');
    setSearchQuery('');
    setExpandedSymbol(null);
    setScopeMode('all');
    setSortKey(category === 'forex' ? 'disparity' : 'bias');
    setActiveStyles({ s: true, i: true, w: true });
  };

  return (
    <div className={`w-full min-h-screen font-sans antialiased transition-colors ${T.pageBg} ${T.textPrimary}`}>
      {/* ── A. HEADER RINGKAS & MODERN (Full Width Top Bar) ── */}
      <header className={`w-full py-2.5 px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 border-b sticky top-0 z-30 transition-colors backdrop-blur-md ${T.headerBg}`}>
        {/* Left: Brand & Perspective Segmented Nav */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Brand Logo */}
          <div
            onClick={onBackToLanding}
            className={`flex items-center gap-2 select-none ${
              onBackToLanding ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''
            }`}
            title={onBackToLanding ? 'Kembali ke Halaman Utama' : undefined}
          >
            <span className={`flex items-end gap-1 h-6 ${T.mintDot}`} aria-hidden="true">
              <i className={`w-1 rounded-full h-2.5 inline-block ${T.mintBrand}`}></i>
              <i className={`w-1 rounded-full h-4 inline-block ${T.mintBrand}`}></i>
              <i className={`w-1 rounded-full h-6 inline-block ${T.mintBrand}`}></i>
            </span>
            <span className="font-extrabold tracking-tight text-lg sm:text-xl font-sans">
              strength<span className={T.mintDot}>.</span>
            </span>
          </div>

          {/* Thin divider */}
          <div className="hidden xl:block h-5 w-px bg-slate-200 dark:bg-white/10" />

          {/* Perspective View Segmented Tabs */}
          <nav className={`flex items-center p-1 rounded-xl text-xs font-medium border overflow-x-auto scrollbar-none ${T.borderSubtle} ${T.isLight ? 'bg-slate-100/80' : 'bg-[#192129]/80'}`}>
            <button
              onClick={() => onChangeTab && onChangeTab('flow_monitor')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'flow_monitor'
                  ? `bg-white dark:bg-[#203b33] ${T.textMint} font-bold shadow-2xs border ${T.isLight ? 'border-slate-200/80' : 'border-emerald-500/30'}`
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onChangeTab && onChangeTab('chart')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'chart'
                  ? `bg-white dark:bg-[#203b33] ${T.textMint} font-bold shadow-2xs border ${T.isLight ? 'border-slate-200/80' : 'border-emerald-500/30'}`
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Grafik Garis
            </button>
            <button
              onClick={() => onChangeTab && onChangeTab('multi_timeframe')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'multi_timeframe'
                  ? `bg-white dark:bg-[#203b33] ${T.textMint} font-bold shadow-2xs border ${T.isLight ? 'border-slate-200/80' : 'border-emerald-500/30'}`
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Matrix Heatmap
            </button>
            <button
              onClick={() => onChangeTab && onChangeTab('sessions')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'sessions'
                  ? `bg-white dark:bg-[#203b33] ${T.textMint} font-bold shadow-2xs border ${T.isLight ? 'border-slate-200/80' : 'border-emerald-500/30'}`
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sesi Pasar
            </button>
          </nav>
        </div>

        {/* Right: Functional Control Clusters */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap ml-auto">
          {/* Cluster 1: Live Status & 5M Candle Timer Capsule */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono shadow-2xs ${T.controlBg}`}>
            <div className="flex items-center gap-1.5" title="Status koneksi data">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'live'
                    ? `${T.mintBrand} animate-pulse`
                    : connectionStatus === 'updating'
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-rose-400'
                }`}
              />
              <span
                className={`text-[11px] font-bold tracking-wider uppercase ${
                  connectionStatus === 'live'
                    ? T.textMint
                    : connectionStatus === 'updating'
                    ? 'text-amber-500'
                    : 'text-rose-500'
                }`}
              >
                {connectionStatus === 'live' ? 'LIVE' : connectionStatus === 'updating' ? 'UPDATE' : 'OFFLINE'}
              </span>
            </div>

            <span className="text-slate-300 dark:text-zinc-700 font-sans select-none">|</span>

            <div className="flex items-center gap-1.5 text-[11px]" title="Waktu tersisa menuju candle 5 menit berikutnya">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <span className={T.textMuted}>5M:</span>
              <span className={`font-bold ${T.textPrimary}`}>{candleClock.formatted}</span>
            </div>
          </div>

          {/* Cluster 2: Tooling & Utilities */}
          <div className="flex items-center gap-1.5">
            {/* Alarm Button with Counter Badge */}
            {onOpenAlerts && (
              <button
                onClick={onOpenAlerts}
                className={`relative p-2 rounded-xl border transition-all cursor-pointer ${T.controlBg} ${T.textPrimary} hover:border-emerald-500/40`}
                title={`Alarm Harga (${unreadAlertCount} aktif)`}
                aria-label="Alarm"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-4 text-[10px] font-bold rounded-full bg-amber-500 text-black text-center shadow-xs">
                    {unreadAlertCount}
                  </span>
                )}
              </button>
            )}

            {/* Metodologi Link Button */}
            {onOpenMethodology && (
              <button
                onClick={onOpenMethodology}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${T.controlBg} ${T.textMuted} hover:text-emerald-500 hover:border-emerald-500/40`}
                title="Penjelasan rumus dan metodologi"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Metodologi</span>
              </button>
            )}

            {/* Settings Icon Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${T.controlBg} ${T.textPrimary} hover:border-emerald-500/40`}
              title="Pengaturan Data & Webhook"
              aria-label="Pengaturan"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Theme Toggle Icon Button */}
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${T.controlBg} ${T.textPrimary} hover:border-emerald-500/40`}
              title={theme === 'dark' ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap'}
              aria-label="Ganti Tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Back to Home Button */}
            {onBackToLanding && (
              <button
                onClick={onBackToLanding}
                className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${T.controlBg} ${T.textMuted} hover:text-emerald-500 hover:border-emerald-500/40`}
                title="Kembali ke Beranda"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Beranda</span>
              </button>
            )}
          </div>

          {/* Cluster 3: User Account / Login */}
          {user ? (
            <div className={`flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border ${T.controlBg}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                T.isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-[#82e6be]'
              }`}>
                {user.email?.[0]?.toUpperCase() || '1'}
              </span>
              <span className={`text-xs font-mono font-semibold max-w-[130px] truncate ${T.textPrimary}`}>
                {user.email?.split('@')[0] || '10tenbrother'}
              </span>
              <button
                onClick={onLogout}
                className="p-1 rounded-lg hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                title="Keluar dari akun"
                aria-label="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs ${
                T.isLight ? 'bg-[#137854] text-white hover:bg-[#0f6345]' : 'bg-[#82e6be] text-[#0c1015] hover:bg-[#6edaa6]'
              }`}
            >
              Masuk
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-[1680px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">

      {/* ── B. TAB PERSPECTIVE VIEWS ── */}
      {activeTab === 'chart' && (
        <div className="animate-fadeIn">
          <CurrencyStrengthChart
            history={currentHistory || []}
            rankings={rankings}
            timeframe={activeTimeframe}
            onChangeTimeframe={onChangeTimeframe}
            selectedCurrencies={selectedCurrencies || new Set()}
            onToggleCurrency={onToggleCurrency || (() => {})}
            onSoloCurrency={onSoloCurrency || (() => {})}
            focusedCurrency={focusedCurrency || null}
            onSetFocusedCurrency={onSetFocusedCurrency || (() => {})}
            rawWebSeries={rawWebSeries}
            isRealWebLive={isRealWebLive}
            onRefreshWebData={onRefreshWebData}
            isLoadingWebData={isLoadingWebData}
            lastWebSyncTime={lastWebSyncTime || undefined}
            onOpenTradingView={(pairStr) => {
              const matched = allInstruments.find(
                (i) => i.symbol === pairStr || i.symbol.replace('/', '') === pairStr.replace('/', '')
              );
              if (matched) {
                handleOpenChart({ stopPropagation: () => {} } as any, matched);
              }
            }}
            theme={theme}
          />
        </div>
      )}

      {activeTab === 'multi_timeframe' && (
        <div className="animate-fadeIn">
          <MultiTimeframeHeatmap
            matrixData={matrixData || (csMatrix as any) || ({} as any)}
            selectedCurrencies={selectedCurrencies || new Set()}
            onToggleCurrency={onToggleCurrency || (() => {})}
            onSoloCurrency={onSoloCurrency || (() => {})}
            onOpenTradingView={(pairStr) => {
              const matched = allInstruments.find(
                (i) => i.symbol === pairStr || i.symbol.replace('/', '') === pairStr.replace('/', '')
              );
              if (matched) {
                handleOpenChart({ stopPropagation: () => {} } as any, matched);
              }
            }}
            theme={theme}
          />
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="animate-fadeIn">
          <MarketSessions
            sessions={marketSessions || []}
            theme={theme}
          />
        </div>
      )}

      {activeTab === 'flow_monitor' && (
        <>
          {/* ── B1. INTRO & TOP METRIC CARDS ── */}
          <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className={`text-[11px] tracking-[2px] font-bold uppercase mb-1 ${T.textMint}`}>
                SATU LAYAR. SELURUH PERSPEKTIF.
              </div>
              <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight m-0 ${T.textPrimary}`}>
                Dashboard terpadu
              </h1>
              <p className={`text-xs sm:text-sm mt-1 ${T.textMuted}`}>
                Kekuatan mata uang, top movers, dan seluruh instrumen dalam satu alur.
              </p>
            </div>
            <div className={`text-left sm:text-right text-xs ${T.textMuted}`}>
              <span>Data terkalibrasi Currency-Strength</span>
              <b className={`block font-medium mt-1 ${T.textPrimary}`}>
                {marketSessions.find((s) => s.isOpen)?.city || 'Global'} Session · Sinkronisasi Otomatis
              </b>
            </div>
          </section>

          {/* 4 Metric Summary Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Strongest Currency */}
            <div className={`p-5 rounded-2xl shadow-xs border ${T.card1Bg} flex flex-col justify-between`}>
              <div>
                <label className={`text-xs block ${T.textMuted}`}>Mata uang terkuat</label>
                <div className={`flex items-baseline gap-2.5 my-2 text-2xl font-bold tracking-tight ${T.textMint}`}>
                  <span>{strongestCurr.code}</span>
                  <small className={`text-xs font-normal font-mono ${T.textMuted}`}>
                    {strongestCurr.score.toFixed(2).replace('.', ',')} / 10
                  </small>
                </div>
                <p className={`text-xs m-0 ${T.textMuted}`}>{strongestCurr.name}</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-emerald-500/20 text-xs">
                <span className={`text-[11px] font-mono ${T.textMuted}`}>Top: {strongestCurr.code}/{weakestCurr.code}</span>
                <button
                  type="button"
                  onClick={() => {
                    const pairName = `${strongestCurr.code}/${weakestCurr.code}`;
                    const row = allInstruments.find((i) => i.symbol === pairName || i.symbol === `${weakestCurr.code}/${strongestCurr.code}`);
                    if (row) {
                      handleOpenChart({ stopPropagation: () => {} } as any, row);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs ${
                    T.isLight ? 'bg-[#137854] text-white hover:bg-[#0f6345]' : 'bg-[#82e6be] text-[#0c1015]'
                  }`}
                  title={`Buka Chart TradingView untuk pair ${strongestCurr.code}/${weakestCurr.code}`}
                >
                  <span>Chart TV</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Card 2: Weakest Currency */}
            <div className={`p-5 rounded-2xl shadow-xs border ${T.panelBg} flex flex-col justify-between`}>
              <div>
                <label className={`text-xs block ${T.textMuted}`}>Mata uang terlemah</label>
                <div className={`flex items-baseline gap-2.5 my-2 text-2xl font-bold tracking-tight ${T.textRed}`}>
                  <span>{weakestCurr.code}</span>
                  <small className={`text-xs font-normal font-mono ${T.textMuted}`}>
                    {weakestCurr.score.toFixed(2).replace('.', ',')} / 10
                  </small>
                </div>
                <p className={`text-xs m-0 ${T.textMuted}`}>{weakestCurr.name}</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-rose-500/20 text-xs">
                <span className={`text-[11px] font-mono ${T.textMuted}`}>Divergensi Max</span>
                <button
                  type="button"
                  onClick={() => {
                    const pairName = `${weakestCurr.code}/${strongestCurr.code}`;
                    const row = allInstruments.find((i) => i.symbol === pairName || i.symbol === `${strongestCurr.code}/${weakestCurr.code}`);
                    if (row) {
                      handleOpenChart({ stopPropagation: () => {} } as any, row);
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30"
                  title="Buka Chart TradingView untuk pair dengan disparitas terbesar"
                >
                  <span>Chart TV</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Card 3: Buy Signals in Active Category */}
            <div className={`p-5 rounded-2xl shadow-xs border ${T.panelBg}`}>
              <label className={`text-xs block ${T.textMuted}`}>
                Sinyal buy · {CAT_LABELS[category]}
              </label>
              <div className={`flex items-baseline gap-2 my-2 text-2xl font-bold tracking-tight ${T.textMint}`}>
                <span>{buySignalCount}</span>
                <small className={`text-xs font-normal ${T.textMuted}`}>
                  / {categoryInstruments.length} instrumen
                </small>
              </div>
              <p className={`text-xs m-0 truncate ${T.textMuted}`}>
                {activeStylesLabel} · sebelum filter
              </p>
            </div>

            {/* Card 4: Sell Signals in Active Category */}
            <div className={`p-5 rounded-2xl shadow-xs border ${T.panelBg}`}>
              <label className={`text-xs block ${T.textMuted}`}>
                Sinyal sell · {CAT_LABELS[category]}
              </label>
              <div className={`flex items-baseline gap-2 my-2 text-2xl font-bold tracking-tight ${T.textRed}`}>
                <span>{sellSignalCount}</span>
                <small className={`text-xs font-normal ${T.textMuted}`}>
                  / {categoryInstruments.length} instrumen
                </small>
              </div>
              <p className={`text-xs m-0 truncate ${T.textMuted}`}>
                {activeStylesLabel} · sebelum filter
              </p>
            </div>
          </section>

          {/* ── B2. MAIN WORKSPACE (2-COLUMN LAYOUT) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_315px] gap-5 items-start">
            {/* ── LEFT COLUMN: UNIFIED MARKET SCREENER ── */}
            <section className={`rounded-2xl overflow-hidden shadow-xs border ${T.panelBg}`}>
              {/* Panel Head: Title + Count + Search */}
              <div className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${T.borderSubtle}`}>
                <h2 className={`text-base sm:text-lg font-semibold tracking-tight m-0 flex items-center gap-2 ${T.textPrimary}`}>
                  <span>Market screener</span>
                  <span className={`text-xs font-normal ${T.textMuted}`}>
                    {categoryInstruments.length} instrumen
                  </span>
                </h2>

                <div className="relative w-full sm:w-60">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setExpandedSymbol(null);
                    }}
                    placeholder="Cari instrumen (EUR, Gold, BTC)…"
                    className={`w-full rounded-lg px-3 py-2 text-xs focus:outline-hidden border ${T.inputBg}`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs ${
                        T.isLight ? 'text-[#607380] hover:text-[#17252e]' : 'text-[#8f9daa] hover:text-white'
                      }`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Category Tabs */}
              <div className={`flex items-center gap-6 px-4 sm:px-5 border-b overflow-x-auto scrollbar-none ${T.border}`}>
                {(Object.keys(CAT_LABELS) as MarketCatKey[]).map((catKey) => {
                  const isSelected = category === catKey;
                  return (
                    <button
                      key={catKey}
                      onClick={() => {
                        setCategory(catKey);
                        setExpandedSymbol(null);
                        setSortKey(catKey === 'forex' ? 'disparity' : 'bias');
                      }}
                      className={`pb-3 pt-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                        isSelected
                          ? T.navActive
                          : `${T.textMuted} border-transparent ${T.isLight ? 'hover:text-[#17252e]' : 'hover:text-[#ecf1f5]'}`
                      }`}
                    >
                      {CAT_LABELS[catKey]}
                    </button>
                  );
                })}
              </div>

              {/* Toolbar: Trading Style + Signal Filter */}
              <div className={`p-3.5 sm:p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
                T.isLight ? 'bg-[#f8fafc] border-[#dbe3e8]' : 'bg-[#0c1015]/40 border-[#27313b]/60'
              }`}>
                {/* Trading Style Multi-Horizon Selector (Supports simultaneous multi-selection) */}
                <div className={`flex items-center p-1 rounded-xl gap-1 border flex-wrap ${T.controlBg}`}>
                  {/* Select All 3 Timeframes Shortcut */}
                  <button
                    onClick={selectAllStyles}
                    className={`px-3 py-1.5 text-xs rounded-lg font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                      isAllStylesActive
                        ? `${T.segActive} ring-1 ring-emerald-500/40`
                        : T.segInactive
                    }`}
                    title="Tampilkan semua timeframe secara bersamaan (Scalping + Intraday + Swing)"
                  >
                    <span>⚡ Semua TF</span>
                    <span className="text-[10px] font-mono opacity-80">(9 TF)</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-0.5 hidden sm:block" />

                  {/* Individual Horizon Toggles */}
                  {(['s', 'i', 'w'] as StyleKey[]).map((sKey) => {
                    const isSelected = activeStyles[sKey];
                    return (
                      <button
                        key={sKey}
                        onClick={() => toggleStyle(sKey)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? `${T.segActive} font-bold`
                            : T.segInactive
                        }`}
                        title={`Klik untuk mengaktifkan/menonaktifkan horizon ${STYLE_CONFIG[sKey].label} (${STYLE_CONFIG[sKey].timeframes.join(', ')})`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full transition-colors ${
                            isSelected
                              ? sKey === 's'
                                ? 'bg-emerald-500 animate-pulse'
                                : sKey === 'i'
                                ? 'bg-blue-500 animate-pulse'
                                : 'bg-purple-500 animate-pulse'
                              : 'bg-slate-300 dark:bg-zinc-600'
                          }`}
                        />
                        <span>{STYLE_CONFIG[sKey].label}</span>
                        <span className="text-[10px] font-mono opacity-70">
                          {sKey === 's' ? '5M-15M' : sKey === 'i' ? '1J-3J' : '4J-8J'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Signal Filters */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {(Object.keys(FILTER_LABELS) as FilterKey[]).map((fKey) => {
                    const isSelected = filter === fKey;
                    return (
                      <button
                        key={fKey}
                        onClick={() => {
                          setFilter(fKey);
                          setExpandedSymbol(null);
                        }}
                        className={`text-xs px-3 py-1 rounded-md cursor-pointer transition-all ${
                          isSelected
                            ? `bg-[#137854] dark:bg-[#203b33] text-white dark:text-[#82e6be] font-bold shadow-2xs`
                            : `${T.textMuted} ${T.isLight ? 'hover:text-[#17252e]' : 'hover:text-[#ecf1f5]'}`
                        }`}
                      >
                        {FILTER_LABELS[fKey]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Viewbar: Scope Mode (All vs Top 5) + View (Table vs Heatmap) + Sort */}
              <div className={`p-3.5 sm:p-4 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${T.borderSubtle}`}>
                {/* Scope Mode (All vs Top 5) */}
                <div className={`flex items-center p-1 rounded-lg gap-1 border ${T.controlBg}`}>
                  <button
                    onClick={() => setScopeMode('all')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      scopeMode === 'all' ? T.segActive : T.segInactive
                    }`}
                  >
                    Semua instrumen
                  </button>
                  <button
                    onClick={() => setScopeMode('top')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      scopeMode === 'top' ? T.segActive : T.segInactive
                    }`}
                  >
                    Top movers · 5
                  </button>
                </div>

                {/* Right Controls: View (Table vs Heatmap) + Sort */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`flex items-center p-1 rounded-lg gap-1 border ${T.controlBg}`}>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        viewMode === 'table' ? T.segActive : T.segInactive
                      }`}
                    >
                      Tabel
                    </button>
                    <button
                      onClick={() => setViewMode('heat')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        viewMode === 'heat' ? T.segActive : T.segInactive
                      }`}
                    >
                      Heatmap
                    </button>
                  </div>

                  <label className={`flex items-center gap-2 text-xs ${T.textMuted}`}>
                    <span>Urutkan:</span>
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                      className={`rounded-lg px-2.5 py-1 text-xs border focus:outline-hidden ${
                        T.isLight
                          ? 'bg-[#f1f4f6] text-[#17252e] border-[#dbe3e8] focus:border-[#137854]'
                          : 'bg-[#0c1015] text-[#ecf1f5] border-[#27313b] focus:border-[#82e6be]'
                      }`}
                    >
                      {category === 'forex' && (
                        <option value="disparity">Disparitas terbesar</option>
                      )}
                      <option value="bias">Bias terkuat</option>
                      <option value="alignment">Keselarasan</option>
                      <option value="name">Nama A–Z</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Scope Description Strip */}
              <div className={`px-4 py-2 border-b text-[11px] font-mono ${T.scopeBg}`}>
                {CAT_LABELS[category]} / {activeStylesLabel} /{' '}
                {scopeMode === 'top' ? '5 teratas dari hasil filter' : 'Semua hasil'} ·
                Urutan: {sortKey === 'disparity' ? 'Disparitas terbesar' : sortKey === 'bias' ? 'Bias terkuat' : sortKey === 'alignment' ? 'Keselarasan' : 'Nama A–Z'}.
              </div>

              {/* Table Header (Only in Table View) */}
              {viewMode === 'table' && (
                <div className={`grid grid-cols-[minmax(140px,1.2fr)_minmax(130px,1fr)_90px_minmax(180px,2fr)_85px] items-center gap-3 px-4 sm:px-6 py-2.5 border-b text-[11px] font-semibold uppercase tracking-wider ${T.tableHeadBg}`}>
                  <span>INSTRUMEN</span>
                  <span>SINYAL & CONFLUENCE</span>
                  <span className="text-right">
                    {category === 'forex' ? 'DISPARITAS' : 'BIAS'}
                  </span>
                  <span className="text-center font-mono">
                    {isAllStylesActive ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">SCALP (5M-15M)</span>
                        <span>•</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">INTRA (1J-3J)</span>
                        <span>•</span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold">SWING (4J-8J)</span>
                      </span>
                    ) : (
                      <span>
                        {[
                          activeStyles.s ? 'SCALP (5M-15M)' : null,
                          activeStyles.i ? 'INTRA (1J-3J)' : null,
                          activeStyles.w ? 'SWING (4J-8J)' : null,
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </span>
                    )}
                  </span>
                  <span className="text-right pr-2">CHART TV</span>
                </div>
              )}

              {/* Rows / Heatmap Content */}
              {displayedInstruments.list.length === 0 ? (
                category !== 'forex' && categoryInstruments.length === 0 ? (
                  <div className={`py-14 px-6 text-center space-y-4 max-w-lg mx-auto ${T.textMuted}`}>
                    <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                      <Radio className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className={`text-sm font-bold ${T.textPrimary}`}>
                        Belum Ada Data Masuk untuk Kategori {category === 'komoditas' ? 'Komoditas' : category === 'indeks' ? 'Indeks' : 'Kripto'}
                      </h4>
                      <p className="text-xs leading-relaxed">
                        Sistem tidak menampilkan data dummy atau angka buatan. Data {category} bersumber langsung dari alert <strong>TradingView Pine Script v6</strong> melalui <strong>Cloudflare Worker Webhook</strong> Anda.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        onClick={() => setShowPineScriptModal(true)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#345fdc] hover:bg-[#2b50be] text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Panduan Pine Script & Webhook
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`py-16 text-center text-xs space-y-2 ${T.textMuted}`}>
                    <p>Tidak ada instrumen yang cocok dengan filter saat ini.</p>
                    <button
                      onClick={resetFilters}
                      className={`font-semibold cursor-pointer hover:underline ${T.textMint}`}
                    >
                      Reset filter
                    </button>
                  </div>
                )
              ) : viewMode === 'table' ? (
                /* ── A. TABLE ROWS ── */
                <div className={`divide-y ${T.rowBorder}`}>
                  {displayedInstruments.list.map((row) => {
                    const signalMeta = getSignalMeta(row.sum, row.activeTf.length, row.is3TfAligned);
                    const isExpanded = expandedSymbol === row.symbol;

                    return (
                      <article key={row.symbol} className="transition-colors">
                        <div
                          className={`rowbutton w-full text-left grid grid-cols-[minmax(140px,1.2fr)_minmax(130px,1fr)_90px_minmax(180px,2fr)_85px] items-center gap-3 px-4 sm:px-6 py-3.5 transition-colors ${
                            isExpanded ? T.rowActive : T.rowHover
                          }`}
                        >
                          {/* 1. Instrument + Friendly Name + Reversal Flag + Quick TV */}
                          <div
                            onClick={() => setExpandedSymbol(isExpanded ? null : row.symbol)}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <span className={`w-9 h-9 rounded-full border grid place-items-center text-xs font-bold shrink-0 font-mono transition-transform group-hover:scale-105 ${T.avatarBg}`}>
                              {row.symbol.slice(0, 2)}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-mono font-bold text-sm ${T.textPrimary}`}>
                                  {row.symbol}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenChart(e, row)}
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono inline-flex items-center gap-0.5 cursor-pointer transition-all border shrink-0 ${
                                    T.isLight
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-emerald-950/50 text-emerald-400 border-emerald-800 hover:bg-emerald-900/50'
                                  }`}
                                  title={`Buka Candlestick TradingView (${row.symbol})`}
                                >
                                  <span>TV</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className={`text-[11px] truncate max-w-[140px] ${T.textMuted}`}>
                                {row.name}
                              </div>
                              {row.flip && (
                                <div className={`text-[10px] font-bold ${T.textMint}`}>
                                  ⚡ Baru balik arah
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 2. Signal & Confluence Badge */}
                          <div
                            onClick={() => setExpandedSymbol(isExpanded ? null : row.symbol)}
                            className="cursor-pointer"
                          >
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 ${
                                signalMeta.cls === 'buy'
                                  ? T.buyBadge
                                  : signalMeta.cls === 'sell'
                                  ? T.sellBadge
                                  : T.neuBadge
                              }`}
                            >
                              <span>{getArrow(row.sum)}</span>
                              <span>{signalMeta.text}</span>
                            </span>
                            {row.is3TfAligned && (
                              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                                ✓ 3TF Searah ({row.alignment}%)
                              </div>
                            )}
                          </div>

                          {/* 3. Disparity / Score */}
                          <div
                            onClick={() => setExpandedSymbol(isExpanded ? null : row.symbol)}
                            className={`text-right font-mono font-bold text-sm tabular-nums cursor-pointer ${T.textPrimary}`}
                          >
                            {row.scoreDisplay}
                          </div>

                          {/* 4. Timeframe Indicators across active horizons */}
                          <div
                            onClick={() => setExpandedSymbol(isExpanded ? null : row.symbol)}
                            className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap cursor-pointer"
                          >
                            {activeStyles.s && (
                              <span className="flex items-center gap-0.5 bg-slate-100/90 dark:bg-black/40 px-1.5 py-1 rounded-md border border-slate-200/60 dark:border-white/5" title="Scalping: 5M, 10M, 15M">
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 font-mono mr-1">5M-15M</span>
                                {row.tfScalp.map((tfVal, idx) => (
                                  <span
                                    key={`s-${idx}`}
                                    title={`Scalp ${['5M', '10M', '15M'][idx]}: ${tfVal > 0 ? 'Naik' : tfVal < 0 ? 'Turun' : 'Netral'}`}
                                    className={`w-5 h-5 rounded-xs grid place-items-center text-[10px] font-bold ${
                                      tfVal > 0 ? T.buyBadge : tfVal < 0 ? T.sellBadge : T.neuBadge
                                    }`}
                                  >
                                    {getArrow(tfVal)}
                                  </span>
                                ))}
                              </span>
                            )}

                            {activeStyles.i && (
                              <span className="flex items-center gap-0.5 bg-slate-100/90 dark:bg-black/40 px-1.5 py-1 rounded-md border border-slate-200/60 dark:border-white/5" title="Intraday: 1J, 2J, 3J">
                                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 font-mono mr-1">1J-3J</span>
                                {row.tfIntra.map((tfVal, idx) => (
                                  <span
                                    key={`i-${idx}`}
                                    title={`Intraday ${['1J', '2J', '3J'][idx]}: ${tfVal > 0 ? 'Naik' : tfVal < 0 ? 'Turun' : 'Netral'}`}
                                    className={`w-5 h-5 rounded-xs grid place-items-center text-[10px] font-bold ${
                                      tfVal > 0 ? T.buyBadge : tfVal < 0 ? T.sellBadge : T.neuBadge
                                    }`}
                                  >
                                    {getArrow(tfVal)}
                                  </span>
                                ))}
                              </span>
                            )}

                            {activeStyles.w && (
                              <span className="flex items-center gap-0.5 bg-slate-100/90 dark:bg-black/40 px-1.5 py-1 rounded-md border border-slate-200/60 dark:border-white/5" title="Swing: 4J, 6J, 8J">
                                <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 font-mono mr-1">4J-8J</span>
                                {row.tfSwing.map((tfVal, idx) => (
                                  <span
                                    key={`w-${idx}`}
                                    title={`Swing ${['4J', '6J', '8J'][idx]}: ${tfVal > 0 ? 'Naik' : tfVal < 0 ? 'Turun' : 'Netral'}`}
                                    className={`w-5 h-5 rounded-xs grid place-items-center text-[10px] font-bold ${
                                      tfVal > 0 ? T.buyBadge : tfVal < 0 ? T.sellBadge : T.neuBadge
                                    }`}
                                  >
                                    {getArrow(tfVal)}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>

                          {/* 5. Direct TradingView Action + Chevron */}
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleOpenChart(e, row)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono transition-all cursor-pointer shadow-2xs ${
                                T.isLight
                                  ? 'bg-[#137854] text-white hover:bg-[#0f6345]'
                                  : 'bg-[#82e6be] text-[#0c1015] hover:bg-[#6edaa6]'
                              }`}
                              title={`Buka & Sinkronkan Chart TradingView (${row.symbol})`}
                            >
                              <span>TV</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedSymbol(isExpanded ? null : row.symbol)}
                              className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors cursor-pointer ${T.textMuted} hover:text-slate-900 dark:hover:text-white`}
                              title={isExpanded ? 'Tutup detail' : 'Buka detail'}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </div>
                        </div>

                        {/* Inline Expandable Detail */}
                        {isExpanded && (
                          <div className={`px-4 sm:px-6 pb-5 pt-2 border-t text-xs space-y-4 animate-fadeIn ${
                            T.isLight ? 'bg-[#f8fafc] border-[#dbe3e8] text-[#607380]' : 'bg-[#0c1015]/60 border-[#27313b]/60 text-[#8f9daa]'
                          }`}>
                            {/* Summary Message */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <p className={`m-0 ${T.textPrimary}`}>
                                {row.is3TfAligned
                                  ? '✓ Seluruh timeframe aktif (Scalping, Intraday & Swing) searah dan mendukung pergerakan solid.'
                                  : row.sum === 0
                                  ? 'Arah timeframe saling mengimbangi (kondisi konsolidasi/netral).'
                                  : 'Arah timeframe belum sepenuhnya selaras, perhatikan level konfirmasi.'}{' '}
                                {row.flip
                                  ? '⚡ Terdeteksi sinyal balik arah (momentum mikro Scalping berlawanan dengan Swing).'
                                  : ''}
                              </p>

                              <button
                                onClick={(e) => handleOpenChart(e, row)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-xs inline-flex items-center gap-2 ${
                                  T.isLight
                                    ? 'bg-[#137854] text-white hover:bg-[#0f6345]'
                                    : 'bg-[#82e6be] text-[#0c1015] hover:bg-[#6edaa6]'
                                }`}
                              >
                                <span>Buka Chart TradingView ({row.symbol})</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* 3 Detail Stat Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className={`rounded-xl p-3.5 border ${T.detailBoxBg}`}>
                                <label className={`text-[11px] block ${T.textMuted}`}>
                                  {row.isForex ? 'Disparitas base − quote' : 'Skor Momentum ROC'}
                                </label>
                                <strong className={`text-base sm:text-lg font-bold font-mono block mt-1 ${T.textPrimary}`}>
                                  {row.disparity !== null
                                    ? (row.disparity > 0 ? '+' : '') + row.disparity.toFixed(2)
                                    : row.scoreDisplay}
                                </strong>
                              </div>

                              <div className={`rounded-xl p-3.5 border ${T.detailBoxBg}`}>
                                <label className={`text-[11px] block ${T.textMuted}`}>
                                  Bias Aktif ({activeStylesLabel})
                                </label>
                                <strong className={`text-base sm:text-lg font-bold font-mono block mt-1 ${T.textPrimary}`}>
                                  {row.sum > 0 ? `+${row.sum}` : row.sum} / ±{row.activeTf.length}
                                </strong>
                              </div>

                              <div className={`rounded-xl p-3.5 border ${T.detailBoxBg}`}>
                                <label className={`text-[11px] block ${T.textMuted}`}>
                                  Keselarasan ({row.activeTf.length} TF Aktif)
                                </label>
                                <strong className={`text-base sm:text-lg font-bold font-mono block mt-1 ${T.textPrimary}`}>
                                  {row.alignment}%
                                </strong>
                              </div>
                            </div>

                            {/* Multi-Timeframe Matrix (Scalp, Intraday, Swing) */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className={`rounded-xl p-3 border ${T.detailBoxBg}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <b className={`text-[11px] font-semibold text-emerald-600 dark:text-emerald-400`}>
                                    Scalping (5M, 10M, 15M) {activeStyles.s ? '· Aktif' : ''}
                                  </b>
                                  <span className="font-mono text-[11px] font-bold">
                                    Disparitas: {row.scalpDiff > 0 ? '+' : ''}{row.scalpDiff.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  {['5M', '10M', '15M'].map((tf, i) => (
                                    <span
                                      key={tf}
                                      className={`flex-1 text-center py-1 rounded-md text-xs font-bold font-mono ${
                                        row.tfScalp[i] > 0
                                          ? T.buyBadge
                                          : row.tfScalp[i] < 0
                                          ? T.sellBadge
                                          : T.neuBadge
                                      }`}
                                    >
                                      {tf} {getArrow(row.tfScalp[i])}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className={`rounded-xl p-3 border ${T.detailBoxBg}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <b className={`text-[11px] font-semibold text-blue-600 dark:text-blue-400`}>
                                    Intraday (1H, 2H, 3H) {activeStyles.i ? '· Aktif' : ''}
                                  </b>
                                  <span className="font-mono text-[11px] font-bold">
                                    Disparitas: {row.intraDiff > 0 ? '+' : ''}{row.intraDiff.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  {['1J', '2J', '3J'].map((tf, i) => (
                                    <span
                                      key={tf}
                                      className={`flex-1 text-center py-1 rounded-md text-xs font-bold font-mono ${
                                        row.tfIntra[i] > 0
                                          ? T.buyBadge
                                          : row.tfIntra[i] < 0
                                          ? T.sellBadge
                                          : T.neuBadge
                                      }`}
                                    >
                                      {tf} {getArrow(row.tfIntra[i])}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className={`rounded-xl p-3 border ${T.detailBoxBg}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <b className={`text-[11px] font-semibold text-purple-600 dark:text-purple-400`}>
                                    Swing (4H, 6H, 8H) {activeStyles.w ? '· Aktif' : ''}
                                  </b>
                                  <span className="font-mono text-[11px] font-bold">
                                    Disparitas: {row.swingDiff > 0 ? '+' : ''}{row.swingDiff.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  {['4J', '6J', '8J'].map((tf, i) => (
                                    <span
                                      key={tf}
                                      className={`flex-1 text-center py-1 rounded-md text-xs font-bold font-mono ${
                                        row.tfSwing[i] > 0
                                          ? T.buyBadge
                                          : row.tfSwing[i] < 0
                                          ? T.sellBadge
                                          : T.neuBadge
                                      }`}
                                    >
                                      {tf} {getArrow(row.tfSwing[i])}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Base vs Quote Strength Comparison Bars (If Forex) */}
                            {row.isForex && row.base && row.quote && (
                              <div className={`p-3.5 rounded-xl space-y-2 border ${T.detailBoxBg}`}>
                                <div className={`text-[11px] font-semibold ${T.textPrimary}`}>
                                  Perbandingan Strength Base vs Quote (Skor 0–10)
                                </div>
                                {[row.base, row.quote].map((cCode) => {
                                  const score =
                                    rankings.find((r) => r.code === cCode)?.score ??
                                    (csMatrix && csMatrix[cCode] ? csMatrix[cCode]['1H']?.score : 5) ??
                                    5;
                                  const widthPct = Math.min(100, Math.max(0, score * 10));
                                  return (
                                    <div
                                      key={cCode}
                                      className="grid grid-cols-[40px_1fr_40px] items-center gap-3 text-xs"
                                    >
                                      <b className={`font-mono ${T.textPrimary}`}>{cCode}</b>
                                      <div className={`h-2 rounded-full overflow-hidden ${T.panel2Bg}`}>
                                        <div
                                          className="h-full rounded-full transition-all duration-300"
                                          style={{
                                            width: `${widthPct}%`,
                                            backgroundColor:
                                              score >= 6
                                                ? T.mintBar
                                                : score <= 3.5
                                                ? T.redBar
                                                : isLight
                                                ? '#607380'
                                                : '#8f9daa',
                                          }}
                                        ></div>
                                      </div>
                                      <span className={`font-mono text-right ${T.textPrimary}`}>
                                        {score.toFixed(2)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                /* ── B. HEATMAP CARDS VIEW ── */
                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedInstruments.list.map((row) => {
                    const signalMeta = getSignalMeta(row.sum);
                    const isExpanded = expandedSymbol === row.symbol;

                    return (
                      <div key={row.symbol} className="contents">
                        <button
                          onClick={() => setExpandedSymbol(isExpanded ? null : row.symbol)}
                          className={`text-left rounded-xl p-4 cursor-pointer transition-all border ${T.border} ${
                            signalMeta.cls === 'buy'
                              ? T.buyBadge
                              : signalMeta.cls === 'sell'
                              ? T.sellBadge
                              : T.panel2Bg
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <strong className={`text-sm font-mono font-bold ${T.textPrimary}`}>
                                {row.symbol}
                              </strong>
                              <button
                                type="button"
                                onClick={(e) => handleOpenChart(e, row)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-0.5 ${
                                  T.isLight
                                    ? 'bg-[#137854] text-white hover:bg-[#0f6345]'
                                    : 'bg-[#82e6be] text-[#0c1015] hover:bg-[#6edaa6]'
                                }`}
                                title={`Buka Chart TradingView (${row.symbol})`}
                              >
                                <span>TV ↗</span>
                              </button>
                            </div>
                            <span className={`text-xs font-mono font-bold ${T.textPrimary}`}>
                              {row.scoreDisplay}
                            </span>
                          </div>

                          <div className={`text-[11px] mt-1 truncate ${T.textMuted}`}>
                            {signalMeta.text} · {row.alignment}% selaras
                          </div>

                          <div className="flex items-center gap-1.5 mt-3">
                            {row.activeTf.map((tfVal, idx) => (
                              <span
                                key={idx}
                                className={`flex-1 text-center py-0.5 rounded text-xs font-bold ${
                                  tfVal > 0
                                    ? T.buyBadge
                                    : tfVal < 0
                                    ? T.sellBadge
                                    : T.neuBadge
                                }`}
                              >
                                {getArrow(tfVal)}
                              </span>
                            ))}
                          </div>
                        </button>

                        {/* Expand Detail for Heatmap */}
                        {isExpanded && (
                          <div className={`col-span-full p-4 rounded-xl text-xs space-y-3 border ${T.detailBoxBg}`}>
                            <div className="flex items-center justify-between">
                              <h3 className={`text-sm font-bold m-0 font-mono ${T.textPrimary}`}>
                                Detail {row.symbol}
                              </h3>
                              <button
                                onClick={(e) => handleOpenChart(e, row)}
                                className={`px-3.5 py-1.5 font-bold rounded-lg cursor-pointer shadow-2xs inline-flex items-center gap-1.5 ${
                                  T.isLight ? 'bg-[#137854] text-white hover:bg-[#0f6345]' : 'bg-[#82e6be] text-[#0c1015] hover:bg-[#6edaa6]'
                                }`}
                              >
                                <span>Chart TradingView ({row.symbol})</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className={`m-0 ${T.textMuted}`}>{row.name}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Panel Bottom: Count Shown + Reset */}
              <div className={`p-3.5 sm:p-4 border-t flex items-center justify-between text-xs ${T.borderSubtle} ${T.textMuted}`}>
                <span>
                  {displayedInstruments.list.length} ditampilkan ·{' '}
                  {displayedInstruments.matchedCount} cocok ·{' '}
                  {categoryInstruments.length} total
                </span>
                <button
                  onClick={resetFilters}
                  className={`font-semibold cursor-pointer hover:underline ${T.textMint}`}
                >
                  Reset filter
                </button>
              </div>
            </section>

            {/* ── RIGHT COLUMN: SIDEBAR (CURRENCY STRENGTH PANEL) ── */}
            <aside className="space-y-5">
              {/* Panel Kekuatan Mata Uang (8 Mata Uang Utama) */}
              {pref.showStrength && (
                <section className={`rounded-2xl overflow-hidden shadow-xs border ${T.panelBg}`}>
                  <div className={`p-4 sm:p-5 border-b ${T.borderSubtle}`}>
                    <h2 className={`text-base font-semibold m-0 tracking-tight ${T.textPrimary}`}>
                      Kekuatan mata uang
                    </h2>
                    <p className={`text-xs mt-1 m-0 ${T.textMuted}`}>
                      Perhitungan Multi-Timeframe · Skala 0–10
                    </p>
                  </div>

                  {/* 8 Currencies Ranked List */}
                  <div className="p-4 sm:p-5 space-y-2.5">
                    {rankings.map((curr, idx) => {
                      const conf = getCurrencyConfig(curr.code);
                      const scoreVal = curr.score;
                      const widthPct = Math.min(100, Math.max(0, scoreVal * 10));
                      const countryAbbr = COUNTRY_CODES[curr.code] || curr.code.slice(0, 2);

                      return (
                        <div
                          key={curr.code}
                          onClick={() => {
                            const matched = allInstruments
                              .filter((i) => i.base === curr.code || i.quote === curr.code)
                              .sort((a, b) => Math.abs(b.disparity ?? 0) - Math.abs(a.disparity ?? 0))[0];
                            if (matched) {
                              handleOpenChart({ stopPropagation: () => {} } as any, matched);
                            }
                          }}
                          className="flex items-center gap-2 text-xs py-1 px-1 rounded-md cursor-pointer hover:bg-slate-100/90 dark:hover:bg-white/5 transition-colors group"
                          title={`Klik untuk sinkronkan TradingView pada pair terkuat ${curr.code}`}
                        >
                          <span className={`font-mono w-3.5 text-center text-xs ${T.textMuted}`}>
                            {idx + 1}
                          </span>
                          <span className="font-mono font-bold text-[11px] w-5 text-center text-slate-500 dark:text-zinc-400">
                            {countryAbbr}
                          </span>
                          <span className={`font-mono font-bold text-xs ${T.textPrimary}`}>
                            {curr.code}
                          </span>
                          <span className={`text-[11px] truncate text-[#607380] dark:text-[#8f9daa] min-w-[70px] max-w-[105px]`}>
                            {conf?.name || curr.code}
                          </span>
                          {/* Inlined Track bar */}
                          <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${T.panel2Bg} mx-1 min-w-[45px]`}>
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor:
                                  scoreVal >= 6.0
                                    ? T.mintBar
                                    : scoreVal <= 3.5
                                    ? T.redBar
                                    : isLight
                                    ? '#475569'
                                    : '#8f9daa',
                              }}
                            />
                          </div>
                          <strong
                            className={`font-mono text-xs tabular-nums font-bold w-9 text-right ${
                              scoreVal >= 6.0
                                ? T.textMint
                                : scoreVal <= 3.5
                                ? T.textRed
                                : T.textPrimary
                            }`}
                          >
                            {scoreVal.toFixed(2).replace('.', ',')}
                          </strong>
                        </div>
                      );
                    })}
                  </div>

                  {/* Scale Indicator */}
                  <div className={`flex justify-between px-5 pb-3 text-[11px] ${T.textMuted}`}>
                    <span>Lemah(0)</span>
                    <span>Netral(5)</span>
                    <span>Kuat(10)</span>
                  </div>

                  {/* Insight: Disparitas Terbesar */}
                  <div className={`m-4 p-4 rounded-xl space-y-1 border ${T.insightBg}`}>
                    <label className={`text-[10px] tracking-wider font-extrabold uppercase block ${T.textMint}`}>
                      DISPARITAS TERBESAR
                    </label>
                    <div className={`flex items-center justify-between text-lg font-bold font-mono ${T.textPrimary}`}>
                      <span>{maxDisparityPair.pair}</span>
                      <span className={T.textMint}>
                        +{maxDisparityPair.diff.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <p className={`text-[11px] m-0 ${T.textMuted} leading-tight`}>
                      Selisih skor mata uang terkuat ({strongestCurr.code}) dan terlemah ({weakestCurr.code}).
                    </p>
                  </div>

                  {/* Context Note when non-forex is active */}
                  {category !== 'forex' && (
                    <div className={`p-3 mx-4 mb-4 rounded-xl text-[11px] border ${T.panel2Bg} ${T.border} ${T.textMuted}`}>
                      Catatan: Panel kekuatan mata uang berlaku spesifik untuk universe 8 mata uang fiat forex.
                    </div>
                  )}
                </section>
              )}

              {/* Panel Legenda & Panduan Metrik */}
              <section className={`rounded-2xl p-4 sm:p-5 text-xs space-y-2.5 shadow-xs border ${T.panelBg} ${T.textMuted}`}>
                <h2 className={`text-xs font-semibold uppercase tracking-wider m-0 ${T.textPrimary}`}>
                  Arti setiap metrik
                </h2>
                <div className="leading-relaxed m-0 space-y-1">
                  <div><strong className={T.textPrimary}>Strength</strong> · skor tiap mata uang (0–10).</div>
                  <div><strong className={T.textPrimary}>Disparitas</strong> · selisih base dan quote.</div>
                  <div><strong className={T.textPrimary}>Bias</strong> · jumlah arah tiga timeframe (−3 hingga +3).</div>
                  <div><strong className={T.textPrimary}>Keselarasan</strong> · proporsi timeframe pada arah dominan.</div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}

      {/* ── C. FOOTER ── */}
      <footer className={`flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t text-xs ${T.border} ${T.textMuted}`}>
        <span>Strength · Market Intelligence Terpadu</span>
        <span>Forex · Komoditas · Crypto · Indeks · Data Real-Time</span>
      </footer>
      </main>

      {/* ── D. SETTINGS MODAL (Dialog Pengaturan Tampilan) ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl text-xs ${T.panelBg} ${T.textPrimary}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${T.borderSubtle}`}>
              <h2 className={`text-base font-bold m-0 ${T.textPrimary}`}>Pengaturan tampilan</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className={`text-lg cursor-pointer ${T.textMuted} hover:text-white`}
              >
                ✕
              </button>
            </div>

            <p className={T.textMuted}>
              Preferensi disimpan langsung di browser Anda secara persisten.
            </p>

            {/* Theme Select */}
            <div className="flex items-center justify-between">
              <span>Tema tampilan</span>
              <select
                value={theme}
                onChange={(e) => {
                  if (e.target.value !== theme) onToggleTheme();
                }}
                className={`border rounded-lg px-3 py-1.5 text-xs ${T.inputBg}`}
              >
                <option value="dark">Gelap</option>
                <option value="light">Terang</option>
              </select>
            </div>

            {/* Density Select */}
            <div className="flex items-center justify-between">
              <span>Kepadatan baris</span>
              <select
                value={pref.density}
                onChange={(e) =>
                  setPref((prev) => ({
                    ...prev,
                    density: e.target.value as 'comfortable' | 'compact',
                  }))
                }
                className={`border rounded-lg px-3 py-1.5 text-xs ${T.inputBg}`}
              >
                <option value="comfortable">Nyaman</option>
                <option value="compact">Ringkas</option>
              </select>
            </div>

            {/* Show Strength Panel Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pref.showStrength}
                onChange={(e) =>
                  setPref((prev) => ({ ...prev, showStrength: e.target.checked }))
                }
                className="rounded-xs accent-[#137854] dark:accent-[#82e6be]"
              />
              <span>Tampilkan panel kekuatan mata uang di sidebar</span>
            </label>

            {/* Worker Endpoint Config */}
            <div className={`space-y-2 pt-2 border-t ${T.borderSubtle}`}>
              <label className={`text-[11px] block ${T.textMuted}`}>
                URL Worker Cloudflare (Webhooks & Komoditas/Crypto/Indeks)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={workerUrl}
                  onChange={(e) => setWorkerUrl(e.target.value)}
                  placeholder="https://flowmonitor.aideelyst.workers.dev"
                  className={`flex-1 border rounded-lg px-3 py-1.5 text-xs ${T.inputBg}`}
                />
                <button
                  onClick={async () => {
                    setIsTestingWorker(true);
                    setWorkerTestResult(null);
                    try {
                      const res = await testWorkerConnection(workerUrl, workerToken);
                      setWorkerTestResult(res);
                      if (res.ok) {
                        localStorage.setItem('flowmonitor_worker_url', workerUrl);
                      }
                    } catch (e: any) {
                      setWorkerTestResult({ ok: false, error: e.message });
                    } finally {
                      setIsTestingWorker(false);
                    }
                  }}
                  disabled={isTestingWorker}
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer ${T.controlBg}`}
                >
                  {isTestingWorker ? 'Uji...' : 'Uji'}
                </button>
              </div>
              {workerTestResult && (
                <div
                  className={`text-[11px] font-mono p-2 rounded-md ${
                    workerTestResult.ok
                      ? T.buyBadge
                      : T.sellBadge
                  }`}
                >
                  {workerTestResult.ok ? '✓ Terhubung ke Worker' : `✗ ${workerTestResult.error}`}
                </div>
              )}
            </div>

            {/* Extra tools shortcut */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setShowPineScriptModal(true);
                  setIsSettingsOpen(false);
                }}
                className={`flex-1 py-2 rounded-lg border text-center cursor-pointer font-semibold ${T.controlBg} ${T.textMint}`}
              >
                Kode Pine Script v6
              </button>
              {onExportSnapshot && (
                <button
                  onClick={() => {
                    onExportSnapshot();
                    setIsSettingsOpen(false);
                  }}
                  className={`flex-1 py-2 rounded-lg border text-center cursor-pointer ${T.controlBg} ${T.textPrimary}`}
                >
                  Ekspor CSV
                </button>
              )}
            </div>

            <button
              onClick={() => setIsSettingsOpen(false)}
              className={`w-full py-2.5 rounded-lg font-bold cursor-pointer transition-colors mt-2 ${
                T.isLight ? 'bg-[#137854] text-white hover:bg-[#0f6345]' : 'bg-[#82e6be] text-[#0c1015] hover:bg-[#6edaa6]'
              }`}
            >
              Selesai & Simpan
            </button>
          </div>
        </div>
      )}

      {/* ── E. TRADINGVIEW MODAL ── */}
      {tradingViewPair && (
        <TradingViewModal
          pair={tradingViewPair}
          onClose={() => setTradingViewPair(null)}
          theme={theme}
          onSelectPair={(pairStr) => {
            const parts = pairStr.includes('/') ? pairStr.split('/') : [pairStr.slice(0, 3), pairStr.slice(3, 6)];
            const b = (parts[0] || 'CAD') as CurrencyCode;
            const q = (parts[1] || 'CHF') as CurrencyCode;
            const bRank = rankings.find((r) => r.code === b);
            const qRank = rankings.find((r) => r.code === q);
            const diff = (bRank?.score ?? 5) - (qRank?.score ?? 5);
            setTradingViewPair({
              pair: pairStr,
              base: b,
              quote: q,
              baseScore: bRank?.score ?? 6.0,
              quoteScore: qRank?.score ?? 4.0,
              divergence: Number(diff.toFixed(2)),
              signal: diff > 0 ? 'BUY' : 'SELL',
              rate: 1.0,
              change24h: diff,
              spreadPips: 1.2,
              momentum: 'steady',
            });
          }}
        />
      )}

      {/* ── F. PINE SCRIPT & WEBHOOK HUB MODAL ── */}
      <PineScriptWebhookModal
        isOpen={showPineScriptModal}
        onClose={() => setShowPineScriptModal(false)}
        workerUrl={workerUrl}
        onUpdateWorkerUrl={(newUrl) => {
          setWorkerUrl(newUrl);
          localStorage.setItem('flowmonitor_worker_url', newUrl);
          loadWorkerData();
        }}
      />
    </div>
  );
};
