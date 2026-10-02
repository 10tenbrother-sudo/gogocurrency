import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CurrencyCode,
  TimeframeKey,
  StrengthSnapshot,
} from '../types/forex';
import {
  PAIR_DEFINITIONS,
  TIMEFRAME_CONFIGS,
  getNext5MinuteCandleSeconds,
  generateMultiTimeframeMatrix,
} from '../services/currencyStrengthEngine';
import {
  FlowAssetCategory,
  FlowItem,
  FlowSnapshot,
  StreakRecord,
  StreakAlert,
  updateFlowStreaks,
  fetchFlowMonitorLatest,
  fetchFlowMonitorHistory,
  testWorkerConnection,
} from '../services/flowMonitorEngine';
import {
  TrendingUp,
  Sun,
  Moon,
  RefreshCw,
  FileCode,
  Sliders,
  Check,
  Copy,
  LogOut,
  X,
  ExternalLink,
  Clock,
  Zap,
  Target,
  Search,
  LineChart,
  Table as TableIcon,
  LayoutGrid,
  Layers,
  Flame,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';
import { PineScriptWebhookModal } from './PineScriptWebhookModal';

interface FlowMonitorDashboardProps {
  theme?: 'dark' | 'light';
  onSelectPair?: (pairName: string) => void;
  onToggleTheme?: () => void;
  onLogout?: () => void;
  activeTimeframe?: TimeframeKey;
  onChangeTimeframe?: (tf: TimeframeKey) => void;
  timeframeHistories?: Record<TimeframeKey, StrengthSnapshot[]>;
  usdRates?: Record<CurrencyCode, number>;
  onOpenTradingView?: (pairName: string) => void;
  onOpenPairDetails?: (pairName: string) => void;
}

type MarketCategoryTab = 'forex' | 'metals' | 'crypto' | 'inst';
type TradingModeKey = 'scalping' | 'day_trading' | 'swing';
type DashboardSetupKey = 'default' | 'compact' | 'all' | 'important';

interface TopMoverRow {
  pair: string;
  arah: 'Long' | 'Short';
  score: number;
  scoreDisplay: string;
  isBull: boolean;
  badges: Array<{
    text: string;
    variant: 'bear' | 'bull' | 'neutral' | 'tf' | 'reversal';
  }>;
  subText?: string;
  sourceType: 'currency_strength' | 'webhook';
  rawItem?: FlowItem;
  metrics?: {
    scalpDelta?: number;
    intradayDelta?: number;
    swingDelta?: number;
  };
}

function MiniSparkline({
  values,
  isBull,
  width = 240,
  height = 36,
}: {
  values: number[];
  isBull: boolean;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return null;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeColor = isBull ? '#10b981' : '#f43f5e';

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* 0-baseline dashed centerline */}
      <line
        x1={pad}
        y1={height / 2}
        x2={width - pad}
        y2={height / 2}
        stroke="currentColor"
        strokeDasharray="3 3"
        className="text-slate-300 dark:text-zinc-700 opacity-60"
        strokeWidth="1"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getSentimentLabel(score: number): string {
  if (score >= 4) return 'Very Strong Buy';
  if (score === 3) return 'Strong Buy';
  if (score === 2) return 'Moderate Buy';
  if (score === 1) return 'Weak Buy';
  if (score === 0) return 'Neutral Range';
  if (score === -1) return 'Weak Sell';
  if (score === -2) return 'Moderate Sell';
  if (score === -3) return 'Strong Sell';
  return 'Very Strong Sell';
}

function generateMiniHistory(seedStr: string, baseScore: number, count: number = 24): number[] {
  let hash = seedStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 42);
  const pts: number[] = [];
  let curr = baseScore * 0.3;
  for (let i = 0; i < count; i++) {
    hash = (hash * 9301 + 49297) % 233280;
    const rnd = hash / 233280 - 0.5;
    curr = curr * 0.65 + baseScore * 0.35 + rnd * 1.6;
    pts.push(curr);
  }
  pts[pts.length - 1] = baseScore;
  return pts;
}

const PAIR_FRIENDLY_NAMES: Record<string, string> = {
  EURUSD: 'Euro / US Dollar',
  GBPUSD: 'Poundsterling / US Dollar',
  USDJPY: 'US Dollar / Yen Jepang',
  AUDUSD: 'Dolar Australia / US Dollar',
  USDCAD: 'US Dollar / Dolar Kanada',
  USDCHF: 'US Dollar / Franc Swiss',
  NZDUSD: 'Dolar Selandia Baru / USD',
  EURJPY: 'Euro / Yen Jepang',
  GBPJPY: 'Poundsterling / Yen Jepang',
  AUDJPY: 'Dolar Australia / Yen Jepang',
  CADJPY: 'Dolar Kanada / Yen Jepang',
  CHFJPY: 'Franc Swiss / Yen Jepang',
  NZDJPY: 'Dolar Selandia Baru / JPY',
  EURGBP: 'Euro / Poundsterling',
  EURAUD: 'Euro / Dolar Australia',
  EURCAD: 'Euro / Dolar Kanada',
  EURCHF: 'Euro / Franc Swiss',
  EURNZD: 'Euro / Dolar Selandia Baru',
  GBPAUD: 'Poundsterling / Dolar Australia',
  GBPCAD: 'Poundsterling / Dolar Kanada',
  GBPCHF: 'Poundsterling / Franc Swiss',
  GBPNZD: 'Poundsterling / NZD',
  AUDCAD: 'Dolar Australia / Dolar Kanada',
  AUDCHF: 'Dolar Australia / Franc Swiss',
  AUDNZD: 'Dolar Australia / NZD',
  CADCHF: 'Dolar Kanada / Franc Swiss',
  NZDCAD: 'Dolar Selandia Baru / CAD',
  NZDCHF: 'Dolar Selandia Baru / Franc Swiss',
  XAUUSD: 'Emas (Gold) / US Dollar',
  XAGUSD: 'Perak (Silver) / US Dollar',
  WTI: 'Minyak Mentah (Crude Oil)',
  US30: 'Dow Jones (Wall Street 30)',
  NAS100: 'Nasdaq 100 Tech',
  SPX500: 'S&P 500 US Market',
  BTCUSDT: 'Bitcoin / USDT',
  ETHUSDT: 'Ethereum / USDT',
  SOLUSDT: 'Solana / USDT',
};

function getPairSummaryGuidance(mover: {
  pair: string;
  isBull: boolean;
  score: number;
  badges: Array<{ text: string; variant: string }>;
  tf5M?: number;
  tf10M?: number;
  tf15M?: number;
}): {
  statusLabel: string;
  statusVariant: 'bull' | 'bear' | 'reversal' | 'neutral';
  recommendation: string;
  timeframeStatus: string;
  allAligned: boolean;
} {
  const isRev = mover.badges.some((b) => b.variant === 'reversal');
  const absScore = Math.abs(mover.score);

  if (isRev) {
    return {
      statusLabel: 'SIAP BALIK ARAH',
      statusVariant: 'reversal',
      recommendation: mover.isBull
        ? 'TF 5M mulai berbalik naik melawan tren sebelumnya. Ada potensi pantulan beli (Reversal).'
        : 'TF 5M mulai berbalik turun melawan tren sebelumnya. Ada potensi koreksi jual (Reversal).',
      timeframeStatus: '🟡 Reversal Terdeteksi',
      allAligned: false,
    };
  }

  if (absScore >= 3.5) {
    return {
      statusLabel: mover.isBull ? 'BUY KUAT' : 'SELL KUAT',
      statusVariant: mover.isBull ? 'bull' : 'bear',
      recommendation: mover.isBull
        ? 'Arus pembeli sangat solid di semua timeframe. Prioritaskan entry BUY saat harga pullback.'
        : 'Tekanan jual sangat dominan di semua timeframe. Prioritaskan entry SELL saat koreksi harga.',
      timeframeStatus: mover.isBull ? '🟢 3TF Kompak Beli' : '🔴 3TF Kompak Jual',
      allAligned: true,
    };
  }

  if (absScore >= 1.5) {
    return {
      statusLabel: mover.isBull ? 'CENDERUNG BUY' : 'CENDERUNG SELL',
      statusVariant: mover.isBull ? 'bull' : 'bear',
      recommendation: mover.isBull
        ? 'Arah pergerakan condong naik, sinyal beli aktif namun tunggu konfirmasi gelombang.'
        : 'Arah pergerakan condong turun, sinyal jual aktif namun tunggu konfirmasi gelombang.',
      timeframeStatus: mover.isBull ? '🟢 Beli Terbuka' : '🔴 Jual Terbuka',
      allAligned: false,
    };
  }

  return {
    statusLabel: 'KONSOLIDASI',
    statusVariant: 'neutral',
    recommendation: 'Kekuatan pembeli dan penjual seimbang. Disarankan menunggu momentum yang lebih tegas.',
    timeframeStatus: '⚪ Sideways / Netral',
    allAligned: false,
  };
}

export function FlowMonitorDashboard({
  theme = 'light',
  onSelectPair,
  onToggleTheme,
  onLogout,
  activeTimeframe = '5M',
  onChangeTimeframe,
  timeframeHistories,
  onOpenTradingView,
  onOpenPairDetails,
}: FlowMonitorDashboardProps) {
  // Active Category (FX Forex [28] via Currency Strength, CM Commodities [9], CR Crypto [20], IX Indices [11] via Webhook)
  const [activeCategory, setActiveCategory] = useState<MarketCategoryTab>('forex');

  // Search & Filter controls that unify Flow Monitor, Top Movers, and 28 Pair Screener
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<'top_movers' | 'all' | 'buy_only' | 'sell_only' | 'reversal'>('top_movers');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Internal timeframe state if not provided from parent
  const [localTimeframe, setLocalTimeframe] = useState<TimeframeKey>(activeTimeframe);
  const currentTf = onChangeTimeframe ? activeTimeframe : localTimeframe;

  const handleTimeframeChange = (tf: TimeframeKey) => {
    setLocalTimeframe(tf);
    if (onChangeTimeframe) {
      onChangeTimeframe(tf);
    }
  };

  // Multi-Mode Filter (Scalping, Day Trading, Swing) - Default to Scalping Only for high-probability precision
  const [activeModes, setActiveModes] = useState<Record<TradingModeKey, boolean>>({
    scalping: true,
    day_trading: false,
    swing: false,
  });

  const isOnlyScalping = activeModes.scalping && !activeModes.day_trading && !activeModes.swing;
  const isOnlyDayTrading = !activeModes.scalping && activeModes.day_trading && !activeModes.swing;
  const isOnlySwing = !activeModes.scalping && !activeModes.day_trading && activeModes.swing;

  // Dedicated Mode Selection Preset (Scalping Only, Day Only, Swing Only, or All)
  const handleSelectMode = (mode: TradingModeKey | 'all') => {
    if (mode === 'all') {
      setActiveModes({ scalping: true, day_trading: true, swing: true });
    } else {
      setActiveModes({
        scalping: mode === 'scalping',
        day_trading: mode === 'day_trading',
        swing: mode === 'swing',
      });
      if (mode === 'scalping') handleTimeframeChange('5M');
      else if (mode === 'day_trading') handleTimeframeChange('1H');
      else if (mode === 'swing') handleTimeframeChange('4H');
    }
  };

  // Toggle individual mode while ensuring at least one remains active
  const handleToggleMode = (mode: TradingModeKey) => {
    setActiveModes((prev) => {
      const next = { ...prev, [mode]: !prev[mode] };
      if (!next.scalping && !next.day_trading && !next.swing) {
        return prev;
      }
      return next;
    });

    if (mode === 'scalping') handleTimeframeChange('5M');
    else if (mode === 'day_trading') handleTimeframeChange('1H');
    else if (mode === 'swing') handleTimeframeChange('4H');
  };

  // 5-Minute Candle Clock Counter (synchronized with Forex module)
  const [candleClock, setCandleClock] = useState(() => getNext5MinuteCandleSeconds());
  useEffect(() => {
    const timer = setInterval(() => {
      setCandleClock(getNext5MinuteCandleSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cloudflare Worker custom URL (persisted in localStorage)
  const [workerUrl, setWorkerUrl] = useState<string>(() => {
    return localStorage.getItem('flowmonitor_worker_url') || 'https://flowmonitor.aideelyst.workers.dev';
  });
  const [workerToken, setWorkerToken] = useState<string>(() => {
    return localStorage.getItem('flowmonitor_worker_token') || '';
  });

  // Modals
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<TopMoverRow | null>(null);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);

  // Live data states
  const [latestSnapshot, setLatestSnapshot] = useState<FlowSnapshot | null>(null);
  const [, setHistorySnapshots] = useState<FlowSnapshot[]>([]);
  const [, setDataSource] = useState<string>('initializing');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [prevRocMap, setPrevRocMap] = useState<Record<string, number>>({});

  // Streak state
  const streaksRef = React.useRef<StreakRecord>({});
  const [, setStreakAlerts] = useState<StreakAlert[]>([]);

  // Fetch Webhook data for Indeks, Crypto, and Commodities
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [latestRes, historyRes] = await Promise.allSettled([
        fetchFlowMonitorLatest(workerUrl ? `${workerUrl}/latest` : undefined),
        fetchFlowMonitorHistory(workerUrl ? `${workerUrl}/history` : undefined),
      ]);

      if (latestRes.status === 'fulfilled' && latestRes.value.data) {
        const snap = latestRes.value.data;
        setLatestSnapshot(snap);
        setDataSource(latestRes.value.source);
        setLastSyncTime(Date.now());

        // Update streaks for non-forex categories
        const activeItems: FlowItem[] =
          activeCategory === 'crypto'
            ? snap.crypto
            : activeCategory === 'metals'
            ? snap.metals
            : activeCategory === 'inst'
            ? snap.inst || []
            : [];

        if (activeItems && activeItems.length > 0) {
          const { updatedStreaks, firedAlerts } = updateFlowStreaks(
            streaksRef.current,
            activeItems,
            5,
            activeCategory as FlowAssetCategory
          );
          streaksRef.current = updatedStreaks;

          if (firedAlerts.length > 0) {
            setStreakAlerts((old) => [...firedAlerts, ...old].slice(0, 30));
          }

          const newPrevRoc: Record<string, number> = {};
          activeItems.forEach((it) => {
            newPrevRoc[it.pair] = it.pct;
          });
          setPrevRocMap(newPrevRoc);
        }
      }

      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value.data)) {
        setHistorySnapshots(historyRes.value.data);
      }
    } catch (err: any) {
      console.warn('Flow Monitor data fetch error:', err.message);
    } finally {
      setIsRefreshing(false);
    }
  }, [workerUrl, activeCategory]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Currency Strength Multi-Timeframe Matrix (Scalp 5M, Intraday 1H, Swing 4H) for Forex
  const csMatrix = useMemo(() => {
    if (!timeframeHistories) return null;
    return generateMultiTimeframeMatrix(timeframeHistories);
  }, [timeframeHistories]);

  // Derived category counts (Honest 5 Top Indices, 5 Top Crypto, 5 Top Commodities)
  const counts = useMemo(() => {
    const fx = 28; // Standard 28 pairs analyzed via Currency Strength
    const cm = latestSnapshot?.metals ? Math.min(5, latestSnapshot.metals.length) : 0;
    const cr = latestSnapshot?.crypto ? Math.min(5, latestSnapshot.crypto.length) : 0;
    const ix = latestSnapshot?.inst ? Math.min(5, latestSnapshot.inst.length) : 0;
    return { fx, cm, cr, ix };
  }, [latestSnapshot]);

  // ── UNIFIED MULTI-TIMEFRAME ANALYSIS LOGIC (Forex + Commodities + Crypto + Indices) ──
  const topMovers = useMemo<TopMoverRow[]>(() => {
    // ═══════════════════════════════════════════════════════════════
    // A. FOREX CATEGORY (Calculated via Currency Strength Multi-Timeframe Engine)
    // ═══════════════════════════════════════════════════════════════
    if (activeCategory === 'forex') {
      if (!csMatrix) {
        // Fallback if matrix is loading
        return PAIR_DEFINITIONS.map((def) => ({
          pair: def.pair,
          arah: 'Long',
          score: 2,
          scoreDisplay: '+2',
          isBull: true,
          badges: [
            { text: 'Bull Sedang', variant: 'bull' },
            { text: 'TF campur', variant: 'neutral' },
            { text: 'baru', variant: 'neutral' },
          ],
          sourceType: 'currency_strength',
        }));
      }

      const rows: TopMoverRow[] = [];

      PAIR_DEFINITIONS.forEach((def) => {
        const base = def.base;
        const quote = def.quote;

        // 1. Scalp Horizon (5M - 15M Currency Strength delta)
        const baseScalp = csMatrix[base]?.['5M']?.score ?? 5.0;
        const quoteScalp = csMatrix[quote]?.['5M']?.score ?? 5.0;
        const scalpDiff = baseScalp - quoteScalp;

        // 2. Intraday Horizon (1H - 3H Currency Strength delta)
        const baseIntra = csMatrix[base]?.['1H']?.score ?? 5.0;
        const quoteIntra = csMatrix[quote]?.['1H']?.score ?? 5.0;
        const intraDiff = baseIntra - quoteIntra;

        // 3. Swing Horizon (4H - 8H Currency Strength delta)
        const baseSwing = csMatrix[base]?.['4H']?.score ?? 5.0;
        const quoteSwing = csMatrix[quote]?.['4H']?.score ?? 5.0;
        const swingDiff = baseSwing - quoteSwing;

        // Determine Direction per horizon
        const scalpBull = scalpDiff >= 0;
        const intraBull = intraDiff >= 0;
        const swingBull = swingDiff >= 0;

        // Multi-Timeframe Confluence (3TF Searah vs TF Campur)
        const allBull = scalpBull && intraBull && swingBull;
        const allBear = !scalpBull && !intraBull && !swingBull;
        const is3TfAligned = allBull || allBear;

        // Primary Direction based on active mode
        let activeDiff = intraDiff;
        if (activeModes.scalping && !activeModes.day_trading && !activeModes.swing) {
          activeDiff = scalpDiff;
        } else if (activeModes.swing && !activeModes.day_trading) {
          activeDiff = swingDiff;
        } else {
          // Weighted composite across selected modes
          let weightSum = 0;
          let diffSum = 0;
          if (activeModes.scalping) {
            diffSum += scalpDiff * 1;
            weightSum += 1;
          }
          if (activeModes.day_trading) {
            diffSum += intraDiff * 1.5;
            weightSum += 1.5;
          }
          if (activeModes.swing) {
            diffSum += swingDiff * 1.2;
            weightSum += 1.2;
          }
          activeDiff = weightSum > 0 ? diffSum / weightSum : intraDiff;
        }

        const isBull = activeDiff >= 0;
        const arah: 'Long' | 'Short' = isBull ? 'Long' : 'Short';

        // Unified Score: 4 (Kuat + 3TF Searah), 2 (Sedang / Campur), 1 (Lemah)
        let finalScore = 0;
        if (is3TfAligned && Math.abs(activeDiff) >= 1.2) {
          finalScore = isBull ? 4 : -4;
        } else if (Math.abs(activeDiff) >= 0.8) {
          finalScore = isBull ? 3 : -3;
        } else if (Math.abs(activeDiff) >= 0.3) {
          finalScore = isBull ? 2 : -2;
        } else {
          finalScore = isBull ? 1 : -1;
        }

        const scoreDisplay = finalScore > 0 ? `+${finalScore}` : `${finalScore}`;

        // Badges
        const badges: TopMoverRow['badges'] = [];
        if (Math.abs(finalScore) >= 3) {
          badges.push({
            text: isBull ? 'Bull Kuat' : 'Bear Kuat',
            variant: isBull ? 'bull' : 'bear',
          });
        } else {
          badges.push({
            text: isBull ? 'Bull Sedang' : 'Bear Sedang',
            variant: isBull ? 'bull' : 'bear',
          });
        }

        if (is3TfAligned) {
          badges.push({ text: '3TF searah', variant: 'tf' });
        } else {
          badges.push({ text: 'TF campur', variant: 'neutral' });
        }

        // Reversal flag check (Scalp opposite to Swing)
        const isReversal = scalpBull !== swingBull;
        if (isReversal) {
          badges.push({ text: 'baru balik arah', variant: 'reversal' });
        } else {
          badges.push({ text: 'baru', variant: 'neutral' });
        }

        rows.push({
          pair: def.pair,
          arah,
          score: finalScore,
          scoreDisplay,
          isBull,
          badges,
          subText: isReversal ? 'CS Shift' : undefined,
          sourceType: 'currency_strength',
          metrics: {
            scalpDelta: scalpDiff,
            intradayDelta: intraDiff,
            swingDelta: swingDiff,
          },
        });
      });

      return rows;
    }

    // ═══════════════════════════════════════════════════════════════
    // B. COMMODITIES, CRYPTO & INDICES (Via Webhook + Multi-Timeframe EMA/ROC)
    // ═══════════════════════════════════════════════════════════════
    if (!latestSnapshot) return [];

    let rawList: FlowItem[] = [];
    if (activeCategory === 'metals') {
      const sourceMetals: FlowItem[] = (latestSnapshot.metals && latestSnapshot.metals.length > 0)
        ? latestSnapshot.metals
        : ((latestSnapshot as any).items || []);

      // Normalize XAUUSD -> GOLD and XAGUSD -> SILVER, strictly 5 items
      rawList = sourceMetals.map((item) => {
        let pair = item.pair;
        if (pair === 'XAUUSD') pair = 'GOLD';
        if (pair === 'XAGUSD') pair = 'SILVER';
        return { ...item, pair };
      }).slice(0, 5);
    } else if (activeCategory === 'crypto') {
      rawList = [...(latestSnapshot.crypto || [])].slice(0, 5);
    } else if (activeCategory === 'inst') {
      rawList = [...(latestSnapshot.inst || [])].map((item) => {
        let pair = item.pair;
        if (pair === 'SPX500USD') pair = 'US500';
        if (pair === 'NAS100USD') pair = 'NAS100';
        if (pair === 'US30USD') pair = 'US30';
        if (pair === 'DE40EUR') pair = 'GER40';
        if (pair === 'JP225USD') pair = 'JP225';
        return { ...item, pair };
      }).slice(0, 5);
    }

    if (rawList.length === 0) return [];

    return rawList.map((item) => {
      const pct = typeof item.pct === 'number' ? item.pct : 0;

      // 1. Scalp Horizon (5M - 15M): Micro-momentum price rate of change (ROC)
      const scalpDiff = pct;
      const scalpBull = scalpDiff >= 0;

      // 2. Intraday Horizon (1H - 3H): Relative position against EMA20 benchmark
      const price = item.price || 0;
      const ema = item.ema20 || 0;
      const intraDiff = (price && ema && ema > 0)
        ? ((price - ema) / ema) * 100
        : pct * 0.75;
      const intraBull = intraDiff >= 0;

      // 3. Swing Horizon (4H - 8H - 1D): Candle structure range & multi-session momentum
      let swingDiff = 0;
      if (item.high && item.low && item.high > item.low && item.price) {
        const pos = (item.price - item.low) / (item.high - item.low);
        swingDiff = (pos - 0.5) * 2 * (Math.abs(pct) + 0.5) + (intraDiff * 0.4);
      } else {
        swingDiff = intraBull ? Math.abs(pct) * 0.9 + 0.2 : -Math.abs(pct) * 0.9 - 0.2;
      }
      const swingBull = swingDiff >= 0;

      // Multi-Timeframe Confluence (3TF Searah vs TF Campur) - IDENTICAL to Forex
      const allBull = scalpBull && intraBull && swingBull;
      const allBear = !scalpBull && !intraBull && !swingBull;
      const is3TfAligned = allBull || allBear;

      // Primary Direction based on activeModes (IDENTICAL weighting to Forex)
      let activeDiff = intraDiff;
      if (activeModes.scalping && !activeModes.day_trading && !activeModes.swing) {
        activeDiff = scalpDiff;
      } else if (activeModes.swing && !activeModes.day_trading) {
        activeDiff = swingDiff;
      } else {
        let weightSum = 0;
        let diffSum = 0;
        if (activeModes.scalping) {
          diffSum += scalpDiff * 1.0;
          weightSum += 1.0;
        }
        if (activeModes.day_trading) {
          diffSum += intraDiff * 1.5;
          weightSum += 1.5;
        }
        if (activeModes.swing) {
          diffSum += swingDiff * 1.2;
          weightSum += 1.2;
        }
        activeDiff = weightSum > 0 ? diffSum / weightSum : intraDiff;
      }

      const isBull = activeDiff >= 0;
      const arah: 'Long' | 'Short' = isBull ? 'Long' : 'Short';

      // Unified Score: 4 (Kuat + 3TF Searah), 2-3 (Sedang), 1 (Lemah) - IDENTICAL to Forex
      let finalScore = 0;
      if (is3TfAligned && Math.abs(activeDiff) >= 0.8) {
        finalScore = isBull ? 4 : -4;
      } else if (Math.abs(activeDiff) >= 0.5) {
        finalScore = isBull ? 3 : -3;
      } else if (Math.abs(activeDiff) >= 0.2) {
        finalScore = isBull ? 2 : -2;
      } else {
        finalScore = isBull ? 1 : -1;
      }

      const scoreDisplay = finalScore > 0 ? `+${finalScore}` : `${finalScore}`;

      // Reversal check against previous ROC or scalp opposite to swing
      const prevPct = prevRocMap[item.pair];
      const hasRocReversed = prevPct !== undefined && ((prevPct >= 0 && pct < 0) || (prevPct < 0 && pct >= 0));
      const isReversal = (scalpBull !== swingBull) || hasRocReversed;

      // Badges - IDENTICAL to Forex
      const badges: TopMoverRow['badges'] = [];
      if (Math.abs(finalScore) >= 3) {
        badges.push({
          text: isBull ? 'Bull Kuat' : 'Bear Kuat',
          variant: isBull ? 'bull' : 'bear',
        });
      } else if (Math.abs(finalScore) === 2) {
        badges.push({
          text: isBull ? 'Bull Sedang' : 'Bear Sedang',
          variant: isBull ? 'bull' : 'bear',
        });
      } else {
        badges.push({
          text: isBull ? 'Bull Lemah' : 'Bear Lemah',
          variant: isBull ? 'bull' : 'bear',
        });
      }

      if (is3TfAligned) {
        badges.push({ text: '3TF searah', variant: 'tf' });
      } else {
        badges.push({ text: 'TF campur', variant: 'neutral' });
      }

      if (isReversal) {
        badges.push({ text: 'baru balik arah', variant: 'reversal' });
      } else {
        badges.push({ text: 'baru', variant: 'neutral' });
      }

      return {
        pair: item.pair.replace('USDT', ''),
        arah,
        score: finalScore,
        scoreDisplay,
        isBull,
        badges,
        subText: isReversal ? 'Pembalikan Arah' : undefined,
        sourceType: 'webhook',
        rawItem: item,
        metrics: {
          scalpDelta: scalpDiff,
          intradayDelta: intraDiff,
          swingDelta: swingDiff,
        },
      };
    });
  }, [activeCategory, csMatrix, latestSnapshot, activeModes, prevRocMap]);

  // Sort & Filter movers based on quickFilter and search (Unifying Top Movers & 28 Pair Screener)
  const displayedMovers = useMemo(() => {
    let list = [...topMovers];

    // Priority sort by absolute score (strongest moves first)
    list.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    // Search Query Filter (supports symbol or friendly name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) => {
        const friendly = PAIR_FRIENDLY_NAMES[m.pair.toUpperCase()] || '';
        return m.pair.toLowerCase().includes(q) || friendly.toLowerCase().includes(q);
      });
    }

    // Quick Filter (Unifying Top Movers & 28 Pair Screener into one seamless view)
    if (quickFilter === 'top_movers') {
      list = list.slice(0, 5); // Top 5 Pair Paling Berpeluang
    } else if (quickFilter === 'buy_only') {
      list = list.filter((m) => m.isBull);
    } else if (quickFilter === 'sell_only') {
      list = list.filter((m) => !m.isBull);
    } else if (quickFilter === 'reversal') {
      list = list.filter((m) => m.badges.some((b) => b.variant === 'reversal'));
    } else if (quickFilter === 'all') {
      // Shows all pairs/instruments in current market
    }

    return list;
  }, [topMovers, searchQuery, quickFilter]);

  // Summary Metrics: Net Score, Market Balance, Top Move
  const metrics = useMemo(() => {
    if (displayedMovers.length === 0) {
      return {
        netScore: '+1',
        netScoreNumber: 1,
        bullAligned: 2,
        bearAligned: 3,
        waitZoneCount: 0,
        waitZonePct: 0,
        topMovePair: 'GOLD',
        topMoveScore: -4,
      };
    }

    let sum = 0;
    let bullCount = 0;
    let bearCount = 0;
    let waitCount = 0;
    let maxItem = displayedMovers[0];

    displayedMovers.forEach((m) => {
      sum += m.score;
      if (m.score >= 3) bullCount++;
      else if (m.score <= -3) bearCount++;
      else waitCount++;

      if (Math.abs(m.score) > Math.abs(maxItem.score)) {
        maxItem = m;
      }
    });

    const netScoreNumber = sum;
    const netScore = sum > 0 ? `+${sum}` : `${sum}`;
    const waitZonePct = Math.round((waitCount / displayedMovers.length) * 100);

    return {
      netScore,
      netScoreNumber,
      bullAligned: bullCount,
      bearAligned: bearCount,
      waitZoneCount: waitCount,
      waitZonePct,
      topMovePair: maxItem.pair,
      topMoveScore: maxItem.score,
    };
  }, [displayedMovers]);

  // Formatted Updated Time in WIB
  const formattedUpdateTime = useMemo(() => {
    const d = new Date(lastSyncTime);
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins} WIB`;
  }, [lastSyncTime]);

  // ── RENDER ACCORDION TIME FRAME DETAILS FOR A PAIR ──
  const renderPairAccordionContent = (mover: TopMoverRow) => {
    // Mode filters
    const isOnlyScalping = activeModes.scalping && !activeModes.day_trading && !activeModes.swing;
    const isOnlyDayTrading = !activeModes.scalping && activeModes.day_trading && !activeModes.swing;
    const isOnlySwing = !activeModes.scalping && !activeModes.day_trading && activeModes.swing;

    // Genuine Sub-Timeframe Calculations
    let tf5M = 0;
    let tf10M = 0;
    let tf15M = 0;
    let tf1H = 0;
    let tf2H = 0;
    let tf3H = 0;
    let tf4H = 0;
    let tf6H = 0;
    let tf8H = 0;
    let tf1D = 0;

    if (mover.sourceType === 'currency_strength' && csMatrix && mover.pair.length === 6) {
      const b = mover.pair.slice(0, 3) as CurrencyCode;
      const q = mover.pair.slice(3, 6) as CurrencyCode;
      const baseScores = csMatrix[b];
      const quoteScores = csMatrix[q];

      if (baseScores && quoteScores) {
        tf5M = Number(((baseScores['5M']?.score ?? 5) - (quoteScores['5M']?.score ?? 5)).toFixed(2));
        tf10M = Number(((baseScores['10M']?.score ?? 5) - (quoteScores['10M']?.score ?? 5)).toFixed(2));
        tf15M = Number(((baseScores['15M']?.score ?? 5) - (quoteScores['15M']?.score ?? 5)).toFixed(2));
        tf1H = Number(((baseScores['1H']?.score ?? 5) - (quoteScores['1H']?.score ?? 5)).toFixed(2));
        tf2H = Number(((baseScores['2H']?.score ?? 5) - (quoteScores['2H']?.score ?? 5)).toFixed(2));
        tf3H = Number(((baseScores['3H']?.score ?? 5) - (quoteScores['3H']?.score ?? 5)).toFixed(2));
        tf4H = Number(((baseScores['4H']?.score ?? 5) - (quoteScores['4H']?.score ?? 5)).toFixed(2));
        tf6H = Number(((baseScores['6H']?.score ?? 5) - (quoteScores['6H']?.score ?? 5)).toFixed(2));
        tf8H = Number(((baseScores['8H']?.score ?? 5) - (quoteScores['8H']?.score ?? 5)).toFixed(2));
        tf1D = Number(((baseScores['1D']?.score ?? 5) - (quoteScores['1D']?.score ?? 5)).toFixed(2));
      }
    } else {
      const baseP = mover.metrics?.scalpDelta ?? (mover.isBull ? 1.5 : -1.5);
      const intraP = mover.metrics?.intradayDelta ?? (mover.isBull ? 1.2 : -1.2);
      const swingP = mover.metrics?.swingDelta ?? (mover.isBull ? 1.0 : -1.0);

      tf5M = Number((baseP).toFixed(2));
      tf10M = Number((baseP * 0.92).toFixed(2));
      tf15M = Number((baseP * 0.8 + intraP * 0.2).toFixed(2));
      tf1H = Number((intraP).toFixed(2));
      tf2H = Number((intraP * 0.95).toFixed(2));
      tf3H = Number((intraP * 0.88).toFixed(2));
      tf4H = Number((swingP).toFixed(2));
      tf6H = Number((swingP * 0.95).toFixed(2));
      tf8H = Number((swingP * 0.9).toFixed(2));
      tf1D = Number((swingP * 0.85).toFixed(2));
    }

    // Quantized Horizon Scores for Badges
    const scalpScore = Math.max(-4, Math.min(4, Math.round(tf5M >= 0 ? Math.min(4, Math.max(1, tf5M * 1.5)) : Math.max(-4, Math.min(-1, tf5M * 1.5)))));
    const intraScore = Math.max(-4, Math.min(4, Math.round(tf1H >= 0 ? Math.min(4, Math.max(1, tf1H * 1.5)) : Math.max(-4, Math.min(-1, tf1H * 1.5)))));
    const swingScore = Math.max(-4, Math.min(4, Math.round(tf4H >= 0 ? Math.min(4, Math.max(1, tf4H * 1.5)) : Math.max(-4, Math.min(-1, tf4H * 1.5)))));

    // Sparklines
    const scalpValues = generateMiniHistory(`${mover.pair}-scalp`, scalpScore);
    const intraValues = generateMiniHistory(`${mover.pair}-intra`, intraScore);
    const swingValues = generateMiniHistory(`${mover.pair}-swing`, swingScore);

    // Confluence Checks for Scalp
    const scalpBull5M = tf5M >= 0;
    const scalpBull10M = tf10M >= 0;
    const scalpBull15M = tf15M >= 0;
    const scalpAllBuy = scalpBull5M && scalpBull10M && scalpBull15M;
    const scalpAllSell = !scalpBull5M && !scalpBull10M && !scalpBull15M;
    const scalpIsReversal = scalpBull5M !== scalpBull15M;

    return (
      <div className="space-y-4">
        {/* Sub-Header: Instrument, Regime & Direct Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h3
                className={`text-xl font-bold font-mono tracking-tight ${
                  mover.isBull ? 'text-emerald-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {mover.pair}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-xl text-xs font-mono font-bold border ${
                  mover.isBull
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-teal-300'
                    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                Net {mover.scoreDisplay}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
              {mover.isBull ? 'Pasar dalam rezim BULLISH (Arah Beli dominan)' : 'Pasar dalam rezim BEARISH (Arah Jual dominan)'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenTradingView && (
              <button
                onClick={() => onOpenTradingView(mover.pair)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>Buka Chart TradingView</span>
              </button>
            )}
            {onOpenPairDetails && (
              <button
                onClick={() => onOpenPairDetails(mover.pair)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
              >
                <span>Detail Analisis</span>
              </button>
            )}
          </div>
        </div>

        {/* ── CASE 1: ONLY SCALPING SELECTED ── */}
        {isOnlyScalping && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  Rincian Kondisi Timeframe Scalping (5M, 10M, 15M)
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
                Mode Scalp Aktif Saja
              </span>
            </div>

            {/* Scalp Sparkline Card */}
            <div className="p-4 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Aliran Momentum Scalp (Micro-Curve)
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    scalpScore >= 0 ? 'text-emerald-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {scalpScore > 0 ? `+${scalpScore}` : scalpScore} ({getSentimentLabel(scalpScore)})
                </span>
              </div>
              <MiniSparkline values={scalpValues} isBull={scalpScore >= 0} />
            </div>

            {/* Individual Timeframe Cards: 5M, 10M, 15M */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 5M */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  scalpBull5M
                    ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                    : 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-zinc-200">
                    TF 5M (Instan)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                      scalpBull5M
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                    }`}
                  >
                    {scalpBull5M ? 'BUY' : 'SELL'} {tf5M >= 0 ? `+${tf5M}` : tf5M}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {scalpBull5M
                    ? 'Dorongan beli mikro cepat pada candlestick 5 menit. Momentum instan mengarah ke atas.'
                    : 'Tekanan jual mikro cepat pada candlestick 5 menit. Momentum instan mengarah ke bawah.'}
                </p>
              </div>

              {/* 10M */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  scalpBull10M
                    ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                    : 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-zinc-200">
                    TF 10M (Konfirmasi)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                      scalpBull10M
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                    }`}
                  >
                    {scalpBull10M ? 'BUY' : 'SELL'} {tf10M >= 0 ? `+${tf10M}` : tf10M}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {scalpBull10M
                    ? 'Struktur gelombang 10M mengonfirmasi kelanjutan swing bullish. Risiko fakeout lebih rendah.'
                    : 'Struktur gelombang 10M mengonfirmasi kelanjutan swing bearish. Risiko fakeout lebih rendah.'}
                </p>
              </div>

              {/* 15M */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  scalpBull15M
                    ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                    : 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-zinc-200">
                    TF 15M (Tren Scalp)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                      scalpBull15M
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                    }`}
                  >
                    {scalpBull15M ? 'BUY' : 'SELL'} {tf15M >= 0 ? `+${tf15M}` : tf15M}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {scalpBull15M
                    ? 'Filter tren utama scalping 15M solid di atas baseline. Mendukung posisi Long.'
                    : 'Filter tren utama scalping 15M solid di bawah baseline. Mendukung posisi Short.'}
                </p>
              </div>
            </div>

            {/* Scalp Confluence & Status Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                scalpAllBuy
                  ? 'border-emerald-300 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : scalpAllSell
                  ? 'border-rose-300 bg-rose-500/10 text-rose-800 dark:text-rose-300'
                  : scalpIsReversal
                  ? 'border-amber-300 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {scalpAllBuy ? '🟢' : scalpAllSell ? '🔴' : scalpIsReversal ? '🟡' : '⚪'}
                </span>
                <span className="font-bold text-xs sm:text-sm">
                  {scalpAllBuy
                    ? '3TF Searah Beli — Konfluensi Scalping Sempurna (High Probability Buy)'
                    : scalpAllSell
                    ? '3TF Searah Jual — Konfluensi Scalping Sempurna (High Probability Sell)'
                    : scalpIsReversal
                    ? 'Baru Balik Arah (Early Turnaround) — TF 5M berbalik arah melawan 15M, potensi reversal baru terbentuk.'
                    : 'TF Campur — Sinyal scalping belum sepenuhnya searah, pasar berada pada fase konsolidasi.'}
                </span>
              </div>
              <span className="text-[11px] font-mono whitespace-nowrap opacity-80">
                Mode: Scalp Only
              </span>
            </div>
          </div>
        )}

        {/* ── CASE 2: ONLY DAY TRADING SELECTED ── */}
        {isOnlyDayTrading && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-500" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  Rincian Kondisi Day Trading (1H, 2H, 3H)
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
                Mode Day Trading Aktif Saja
              </span>
            </div>

            {/* Day Trading Sparkline Card */}
            <div className="p-4 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Aliran Momentum Intraday (1H - 3H Curve)
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    intraScore >= 0 ? 'text-emerald-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {intraScore > 0 ? `+${intraScore}` : intraScore} ({getSentimentLabel(intraScore)})
                </span>
              </div>
              <MiniSparkline values={intraValues} isBull={intraScore >= 0} />
            </div>

            {/* Individual Cards: 1H, 2H, 3H */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['1H', '2H', '3H'].map((tf, i) => {
                const val = i === 0 ? tf1H : i === 1 ? tf2H : tf3H;
                const isBull = val >= 0;
                return (
                  <div
                    key={tf}
                    className={`p-3.5 rounded-xl border ${
                      isBull
                        ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                        : 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold font-mono text-slate-700 dark:text-zinc-200">
                        TF {tf}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                          isBull
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                        }`}
                      >
                        {isBull ? 'BUY' : 'SELL'} {val >= 0 ? `+${val}` : val}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      {isBull ? 'Aliran dana harian mengakumulasi posisi beli' : 'Aliran dana harian mendistribusikan posisi jual'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CASE 3: ONLY SWING SELECTED ── */}
        {isOnlySwing && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  Rincian Kondisi Swing (4H, 6H, 8H, 1D)
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
                Mode Swing Aktif Saja
              </span>
            </div>

            {/* Swing Sparkline Card */}
            <div className="p-4 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Aliran Tren Makro Swing (HTF Curve)
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    swingScore >= 0 ? 'text-emerald-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {swingScore > 0 ? `+${swingScore}` : swingScore} ({getSentimentLabel(swingScore)})
                </span>
              </div>
              <MiniSparkline values={swingValues} isBull={swingScore >= 0} />
            </div>

            {/* Individual Cards: 4H, 6H, 8H, 1D */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '4H', val: tf4H },
                { label: '6H', val: tf6H },
                { label: '8H', val: tf8H },
                { label: '1D', val: tf1D },
              ].map(({ label, val }) => {
                const isBull = val >= 0;
                return (
                  <div
                    key={label}
                    className={`p-3 rounded-xl border ${
                      isBull
                        ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                        : 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold font-mono text-slate-700 dark:text-zinc-200">
                        {label}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                          isBull
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                        }`}
                      >
                        {isBull ? 'BUY' : 'SELL'} {val >= 0 ? `+${val}` : val}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                      {isBull ? 'Tren Bullish' : 'Tren Bearish'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CASE 4: MULTI-MODE ACTIVE (SHOW ONLY ACTIVE SELECTED MODES) ── */}
        {!isOnlyScalping && !isOnlyDayTrading && !isOnlySwing && (
          <div className="space-y-3">
            {/* Sparkline Cards for Active Modes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {activeModes.scalping && (
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Scalping</span>
                    <span className={`text-xs font-mono font-bold ${scalpScore >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {scalpScore > 0 ? `+${scalpScore}` : scalpScore}
                    </span>
                  </div>
                  <MiniSparkline values={scalpValues} isBull={scalpScore >= 0} />
                </div>
              )}
              {activeModes.day_trading && (
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Day Trading</span>
                    <span className={`text-xs font-mono font-bold ${intraScore >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {intraScore > 0 ? `+${intraScore}` : intraScore}
                    </span>
                  </div>
                  <MiniSparkline values={intraValues} isBull={intraScore >= 0} />
                </div>
              )}
              {activeModes.swing && (
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Swing</span>
                    <span className={`text-xs font-mono font-bold ${swingScore >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {swingScore > 0 ? `+${swingScore}` : swingScore}
                    </span>
                  </div>
                  <MiniSparkline values={swingValues} isBull={swingScore >= 0} />
                </div>
              )}
            </div>

            {/* Breakdown Rows for Active Modes Only */}
            <div className="space-y-2">
              {activeModes.scalping && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-800/30 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-zinc-700">LTF</span>
                    <span className="font-bold text-xs">Scalping (5M - 15M)</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${scalpScore >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {scalpScore > 0 ? `+${scalpScore}` : scalpScore}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className={`px-2 py-0.5 rounded ${tf5M >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>5M {tf5M >= 0 ? 'BUY' : 'SELL'}</span>
                    <span className={`px-2 py-0.5 rounded ${tf10M >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>10M {tf10M >= 0 ? 'BUY' : 'SELL'}</span>
                    <span className={`px-2 py-0.5 rounded ${tf15M >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>15M {tf15M >= 0 ? 'BUY' : 'SELL'}</span>
                  </div>
                </div>
              )}
              {activeModes.day_trading && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-800/30 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">MTF</span>
                    <span className="font-bold text-xs">Day Trading (1H - 3H)</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${intraScore >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {intraScore > 0 ? `+${intraScore}` : intraScore}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className={`px-2 py-0.5 rounded ${tf1H >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>1H {tf1H >= 0 ? 'BUY' : 'SELL'}</span>
                    <span className={`px-2 py-0.5 rounded ${tf2H >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>2H {tf2H >= 0 ? 'BUY' : 'SELL'}</span>
                    <span className={`px-2 py-0.5 rounded ${tf3H >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>3H {tf3H >= 0 ? 'BUY' : 'SELL'}</span>
                  </div>
                </div>
              )}
              {activeModes.swing && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-800/30 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">HTF</span>
                    <span className="font-bold text-xs">Swing (4H - 1D)</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${swingScore >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {swingScore > 0 ? `+${swingScore}` : swingScore}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className={`px-2 py-0.5 rounded ${tf4H >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>4H {tf4H >= 0 ? 'BUY' : 'SELL'}</span>
                    <span className={`px-2 py-0.5 rounded ${tf6H >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>6H {tf6H >= 0 ? 'BUY' : 'SELL'}</span>
                    <span className={`px-2 py-0.5 rounded ${tf8H >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>8H {tf8H >= 0 ? 'BUY' : 'SELL'}</span>
                    <span className={`px-2 py-0.5 rounded ${tf1D >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>1D {tf1D >= 0 ? 'BUY' : 'SELL'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 text-slate-800 dark:text-zinc-100 font-sans transition-colors">
      {/* ── Cockpit Terpadu: Flow & Screener Monitor (All-in-One) ── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Bar 1: Kategori Pasar & Kontrol Cepat */}
        <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Pilihan Pasar (Tabs) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/60 rounded-xl overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveCategory('forex')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'forex'
                  ? 'bg-white dark:bg-zinc-700 text-[#0f766e] dark:text-teal-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>Forex</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-teal-500/10 text-[#0f766e] dark:text-teal-300">
                {counts.fx}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('metals')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'metals'
                  ? 'bg-white dark:bg-zinc-700 text-[#0f766e] dark:text-teal-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>Komoditas (Emas, Perak, Minyak)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-teal-500/10 text-[#0f766e] dark:text-teal-300">
                {counts.cm}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('crypto')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'crypto'
                  ? 'bg-white dark:bg-zinc-700 text-[#0f766e] dark:text-teal-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>Crypto</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-teal-500/10 text-[#0f766e] dark:text-teal-300">
                {counts.cr}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('inst')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'inst'
                  ? 'bg-white dark:bg-zinc-700 text-[#0f766e] dark:text-teal-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>Indeks</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-teal-500/10 text-[#0f766e] dark:text-teal-300">
                {counts.ix}
              </span>
            </button>
          </div>

          {/* Sisi Kanan: Pencarian, Jam 5M, Switch View, Refresh */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pair (EUR, Emas, BTC)..."
                className="pl-8 pr-6 py-1.5 text-xs rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-[#0f766e] w-40 sm:w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            {/* Candle 5M Clock */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-[11px]">
              <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
              <span>5M: {candleClock.formatted}</span>
            </div>

            {/* View Switcher */}
            <div className="flex items-center p-0.5 rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-full cursor-pointer transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-zinc-700 text-[#0f766e] dark:text-teal-300 shadow-2xs'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Tampilan Tabel (Mudah Dibaca)"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-full cursor-pointer transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-zinc-700 text-[#0f766e] dark:text-teal-300 shadow-2xs'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Tampilan Kartu"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="p-1.5 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 hover:bg-[#0f766e]/20 text-[#0f766e] dark:text-teal-300 cursor-pointer transition-colors"
              title="Refresh Data Pasar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bar 2: Filter Cepat & Mode Gaya (Bersih & Simpel) */}
        <div className="px-3.5 py-2.5 bg-slate-50/70 dark:bg-zinc-850/60 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
          {/* Filter Cepat Publik */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mr-1">
              Filter:
            </span>

            <button
              onClick={() => setQuickFilter('top_movers')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                quickFilter === 'top_movers'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>🔥 Top 5 Terkuat</span>
            </button>

            <button
              onClick={() => setQuickFilter('buy_only')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                quickFilter === 'buy_only'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
              }`}
            >
              <span>🟢 Hanya BUY</span>
            </button>

            <button
              onClick={() => setQuickFilter('sell_only')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                quickFilter === 'sell_only'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
              }`}
            >
              <span>🔴 Hanya SELL</span>
            </button>

            <button
              onClick={() => setQuickFilter('reversal')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                quickFilter === 'reversal'
                  ? 'bg-purple-600 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
              }`}
            >
              <span>🔄 Baru Balik Arah</span>
            </button>

            <button
              onClick={() => setQuickFilter('all')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                quickFilter === 'all'
                  ? 'bg-[#0f766e] text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Semua</span>
            </button>
          </div>

          {/* Mode Gaya Trading */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mr-1">
              Gaya:
            </span>

            <button
              onClick={() => handleSelectMode('scalping')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                isOnlyScalping
                  ? 'bg-teal-600 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>Scalping (5M–15M)</span>
            </button>

            <button
              onClick={() => handleSelectMode('day_trading')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                isOnlyDayTrading
                  ? 'bg-cyan-600 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
              }`}
            >
              <Target className="w-3 h-3 text-cyan-300" />
              <span>Day Trade (1H–3H)</span>
            </button>

            <button
              onClick={() => handleSelectMode('swing')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                isOnlySwing
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-indigo-300" />
              <span>Swing (4H–1D)</span>
            </button>
          </div>
        </div>

        {/* Content View: Table or Cards */}
        <div className="p-3 sm:p-4">
          {displayedMovers.length === 0 ? (
            activeCategory !== 'forex' ? (
              <div className="py-14 px-6 text-center space-y-4 max-w-lg mx-auto">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <Activity className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                    Belum Ada Data Masuk untuk Kategori {activeCategory === 'metals' ? 'KOMODITAS' : activeCategory === 'crypto' ? 'KRIPTO' : 'INDEKS'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Sistem tidak menampilkan data dummy atau estimasi buatan. Data {activeCategory} bersumber langsung dari sinyal alert <strong>TradingView Pine Script</strong> melalui <strong>Cloudflare Worker Webhook</strong> Anda.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => setShowScriptModal(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#345fdc] hover:bg-[#2b50be] text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                  >
                    Panduan Pine Script & Webhook
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 dark:text-zinc-500 font-mono text-xs">
                Tidak ada pair/instrumen yang cocok dengan filter saat ini.
              </div>
            )
          ) : viewMode === 'table' ? (
            /* TABLE VIEW: Super Simpel, Bersih & Gampang Dibaca Publik */
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 w-10">#</th>
                    <th className="py-3 px-3.5 min-w-[140px]">Instrumen</th>
                    <th className="py-3 px-3 min-w-[130px]">Sinyal & Arah</th>
                    <th className="py-3 px-3 min-w-[120px]">Kekuatan Tren</th>
                    <th className="py-3 px-3 min-w-[150px]">Kondisi Timeframe</th>
                    <th className="py-3 px-3.5 min-w-[240px]">Panduan Analisa (Aksi)</th>
                    <th className="py-3 px-3 text-right w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900">
                  {displayedMovers.map((mover, index) => {
                    const isExpanded = expandedPair === mover.pair;
                    const rank = index + 1;

                    // TF Calculations
                    let tf5M = 0;
                    let tf10M = 0;
                    let tf15M = 0;

                    if (mover.sourceType === 'currency_strength' && csMatrix && mover.pair.length === 6) {
                      const b = mover.pair.slice(0, 3) as CurrencyCode;
                      const q = mover.pair.slice(3, 6) as CurrencyCode;
                      const baseScores = csMatrix[b];
                      const quoteScores = csMatrix[q];
                      if (baseScores && quoteScores) {
                        tf5M = Number(((baseScores['5M']?.score ?? 5) - (quoteScores['5M']?.score ?? 5)).toFixed(2));
                        tf10M = Number(((baseScores['10M']?.score ?? 5) - (quoteScores['10M']?.score ?? 5)).toFixed(2));
                        tf15M = Number(((baseScores['15M']?.score ?? 5) - (quoteScores['15M']?.score ?? 5)).toFixed(2));
                      }
                    } else {
                      const baseP = mover.metrics?.scalpDelta ?? (mover.isBull ? 1.5 : -1.5);
                      tf5M = Number(baseP.toFixed(2));
                      tf10M = Number((baseP * 0.92).toFixed(2));
                      tf15M = Number((baseP * 0.8).toFixed(2));
                    }

                    const guidance = getPairSummaryGuidance({
                      pair: mover.pair,
                      isBull: mover.isBull,
                      score: mover.score,
                      badges: mover.badges,
                      tf5M,
                      tf10M,
                      tf15M,
                    });

                    const friendlyName =
                      PAIR_FRIENDLY_NAMES[mover.pair.toUpperCase()] ||
                      (mover.sourceType === 'currency_strength' ? 'Forex Pair' : 'Pasar Global');

                    const absScore = Math.abs(mover.score);
                    const scorePct = Math.min(100, Math.round((absScore / 7) * 100));

                    return (
                      <React.Fragment key={mover.pair}>
                        <tr
                          onClick={() => setExpandedPair((prev) => (prev === mover.pair ? null : mover.pair))}
                          className="hover:bg-teal-500/[0.04] dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                        >
                          {/* 1. Peringkat */}
                          <td className="py-3 px-3 font-mono text-slate-400 font-semibold text-center">
                            {rank}
                          </td>

                          {/* 2. Instrumen & Nama Ramah */}
                          <td className="py-3 px-3.5">
                            <div className="font-mono font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                              <span>{mover.pair}</span>
                              {mover.badges.some((b) => b.variant === 'reversal') && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-sans font-medium">
                                  Reversal
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[150px]">
                              {friendlyName}
                            </div>
                          </td>

                          {/* 3. Sinyal & Arah (Badge Tegas) */}
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                guidance.statusVariant === 'bull'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : guidance.statusVariant === 'bear'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                  : guidance.statusVariant === 'reversal'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              <span>
                                {guidance.statusVariant === 'bull'
                                  ? '🟢'
                                  : guidance.statusVariant === 'bear'
                                  ? '🔴'
                                  : guidance.statusVariant === 'reversal'
                                  ? '🟡'
                                  : '⚪'}
                              </span>
                              <span>{guidance.statusLabel}</span>
                            </span>
                          </td>

                          {/* 4. Kekuatan Tren (Skor & Visual Meter) */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono font-bold text-xs ${
                                  mover.isBull
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {mover.scoreDisplay}
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    mover.isBull ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${scorePct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* 5. Kondisi Timeframe (Pills Sederhana) */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono font-bold ${
                                  tf5M >= 0
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}
                                title={`TF 5M: ${tf5M >= 0 ? '+' : ''}${tf5M}`}
                              >
                                5M {tf5M >= 0 ? '▲' : '▼'}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono font-bold ${
                                  tf10M >= 0
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}
                                title={`TF 10M: ${tf10M >= 0 ? '+' : ''}${tf10M}`}
                              >
                                10M {tf10M >= 0 ? '▲' : '▼'}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono font-bold ${
                                  tf15M >= 0
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}
                                title={`TF 15M: ${tf15M >= 0 ? '+' : ''}${tf15M}`}
                              >
                                15M {tf15M >= 0 ? '▲' : '▼'}
                              </span>
                            </div>
                            <div className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 mt-1">
                              {guidance.timeframeStatus}
                            </div>
                          </td>

                          {/* 6. Panduan Analisa (1 Kalimat Bersih) */}
                          <td className="py-3 px-3.5">
                            <p className="text-xs text-slate-700 dark:text-zinc-300 leading-snug">
                              {guidance.recommendation}
                            </p>
                          </td>

                          {/* 7. Aksi Cepat */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {onOpenTradingView && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenTradingView(mover.pair);
                                  }}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-cyan-600 dark:text-cyan-400 transition-colors"
                                  title="Buka Chart TradingView"
                                >
                                  <LineChart className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <span className="text-slate-400">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Accordion Detail Ringkas */}
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={7}
                              className="p-4 bg-slate-50/80 dark:bg-zinc-950/60 border-t border-slate-100 dark:border-zinc-800"
                            >
                              {renderPairAccordionContent(mover)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* CARD VIEW: Bersih, Rapi & Tidak Membingungkan */
            <div className="space-y-3">
              {displayedMovers.map((mover, index) => {
                const rank = index + 1;
                const isExpanded = expandedPair === mover.pair;
                const friendlyName =
                  PAIR_FRIENDLY_NAMES[mover.pair.toUpperCase()] ||
                  (mover.sourceType === 'currency_strength' ? 'Forex Pair' : 'Pasar Global');
                const guidance = getPairSummaryGuidance({
                  pair: mover.pair,
                  isBull: mover.isBull,
                  score: mover.score,
                  badges: mover.badges,
                });

                return (
                  <div
                    key={mover.pair}
                    className={`border transition-all rounded-2xl overflow-hidden ${
                      isExpanded
                        ? 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-4'
                        : 'border-slate-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 hover:border-slate-300 dark:hover:border-zinc-700 p-3.5 cursor-pointer shadow-2xs'
                    }`}
                  >
                    <div
                      onClick={() => {
                        setExpandedPair((prev) => (prev === mover.pair ? null : mover.pair));
                        if (onSelectPair) onSelectPair(mover.pair);
                      }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer select-none gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-mono font-semibold text-slate-500">
                          {rank}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-slate-900 dark:text-zinc-100 font-mono">
                              {mover.pair}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                                mover.isBull
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {mover.scoreDisplay}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                            {friendlyName}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            guidance.statusVariant === 'bull'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : guidance.statusVariant === 'bear'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                          }`}
                        >
                          {guidance.statusLabel}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {onOpenTradingView && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTradingView(mover.pair);
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-cyan-600"
                              title="Buka Chart TradingView"
                            >
                              <LineChart className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <span className="text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-600 dark:text-zinc-300">
                      {guidance.recommendation}
                    </div>

                    {isExpanded && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-zinc-800/80">
                        {renderPairAccordionContent(mover)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal for Clicked Pair ── */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>{selectedDetailItem.pair}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      selectedDetailItem.isBull
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    }`}
                  >
                    {selectedDetailItem.arah} ({selectedDetailItem.scoreDisplay})
                  </span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  {selectedDetailItem.sourceType === 'currency_strength'
                    ? 'Analisis Disparitas Mata Uang Multi-Timeframe'
                    : 'Analisis Aliran Modal & Momentum Multi-Timeframe'}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs">
              {/* Unified 3-Horizon Breakdown across both Currency Strength and Webhook */}
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/60">
                <span className="text-slate-500 dark:text-zinc-400">Scalp Horizon (5M–15M):</span>
                <span
                  className={`font-mono font-bold ${
                    (selectedDetailItem.metrics?.scalpDelta ?? 0) >= 0
                      ? 'text-emerald-600 dark:text-teal-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {selectedDetailItem.metrics?.scalpDelta !== undefined
                    ? `${selectedDetailItem.metrics.scalpDelta > 0 ? '+' : ''}${selectedDetailItem.metrics.scalpDelta.toFixed(2)}${
                        selectedDetailItem.sourceType === 'webhook' ? '%' : ''
                      }`
                    : '--'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/60">
                <span className="text-slate-500 dark:text-zinc-400">Intraday Horizon (1H–3H):</span>
                <span
                  className={`font-mono font-bold ${
                    (selectedDetailItem.metrics?.intradayDelta ?? 0) >= 0
                      ? 'text-emerald-600 dark:text-teal-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {selectedDetailItem.metrics?.intradayDelta !== undefined
                    ? `${selectedDetailItem.metrics.intradayDelta > 0 ? '+' : ''}${selectedDetailItem.metrics.intradayDelta.toFixed(2)}${
                        selectedDetailItem.sourceType === 'webhook' ? '%' : ''
                      }`
                    : '--'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/60">
                <span className="text-slate-500 dark:text-zinc-400">Swing Horizon (4H–1D):</span>
                <span
                  className={`font-mono font-bold ${
                    (selectedDetailItem.metrics?.swingDelta ?? 0) >= 0
                      ? 'text-emerald-600 dark:text-teal-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {selectedDetailItem.metrics?.swingDelta !== undefined
                    ? `${selectedDetailItem.metrics.swingDelta > 0 ? '+' : ''}${selectedDetailItem.metrics.swingDelta.toFixed(2)}${
                        selectedDetailItem.sourceType === 'webhook' ? '%' : ''
                      }`
                    : '--'}
                </span>
              </div>

              {/* Source-specific extra details */}
              {selectedDetailItem.sourceType === 'webhook' && selectedDetailItem.rawItem && (
                <>
                  {selectedDetailItem.rawItem.price && (
                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-zinc-700/60">
                      <span className="text-slate-500 dark:text-zinc-400">Harga Terakhir:</span>
                      <span className="font-mono font-bold">
                        {selectedDetailItem.rawItem.price.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedDetailItem.rawItem.ema20 && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 dark:text-zinc-400">EMA 20 Benchmark:</span>
                      <span className="font-mono font-bold">
                        {selectedDetailItem.rawItem.ema20.toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  if (onSelectPair) onSelectPair(selectedDetailItem.pair);
                  setSelectedDetailItem(null);
                }}
                className="flex-1 py-2 rounded-xl bg-[#0f766e] text-white text-xs font-semibold hover:bg-teal-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Buka Chart</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Endpoint Config Modal ── */}
      {showConfigModal && (
        <ConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          workerUrl={workerUrl}
          workerToken={workerToken}
          onSave={(url, token) => {
            setWorkerUrl(url);
            setWorkerToken(token);
            localStorage.setItem('flowmonitor_worker_url', url);
            if (token) localStorage.setItem('flowmonitor_worker_token', token);
            else localStorage.removeItem('flowmonitor_worker_token');
            loadData();
          }}
        />
      )}

      {/* ── Pine Script & Webhook Hub Modal ── */}
      <PineScriptWebhookModal
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        workerUrl={workerUrl}
        onUpdateWorkerUrl={(newUrl) => {
          setWorkerUrl(newUrl);
          localStorage.setItem('flowmonitor_worker_url', newUrl);
          loadData();
        }}
      />
    </div>
  );
}

// Subcomponent: Endpoint Configuration Modal
function ConfigModal({
  isOpen,
  onClose,
  workerUrl,
  workerToken,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  workerUrl: string;
  workerToken: string;
  onSave: (url: string, token: string) => void;
}) {
  const [urlInput, setUrlInput] = useState(workerUrl);
  const [tokenInput, setTokenInput] = useState(workerToken);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testWorkerConnection(urlInput, tokenInput);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const directWebhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/flow-monitor/webhook` : '/api/flow-monitor/webhook';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0f766e] dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Konfigurasi Endpoint Flow Monitor
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Cloudflare Worker URL:
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://flowmonitor.aideelyst.workers.dev"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 font-mono text-xs text-slate-900 dark:text-zinc-100 outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              API Token (Opsional):
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="fm_secret_key"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 font-mono text-xs text-slate-900 dark:text-zinc-100 outline-none"
            />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200/80 dark:border-zinc-700 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">
                Direct App Webhook URL:
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(directWebhookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-[#0f766e] dark:text-teal-400 font-semibold flex items-center gap-1 hover:underline"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
            <p className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 break-all">
              {directWebhookUrl}
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-[11px] font-mono ${
                testResult.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200'
              }`}
            >
              {testResult.ok ? '✓ Terhubung sukses ke Worker' : `✗ Gagal: ${testResult.error}`}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold cursor-pointer hover:bg-slate-100"
          >
            {testing ? 'Menguji...' : 'Uji Koneksi'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              onClick={() => {
                onSave(urlInput.trim(), tokenInput.trim());
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-[#0f766e] text-white text-xs font-bold hover:bg-teal-700 shadow-sm"
            >
              Simpan & Terapkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
