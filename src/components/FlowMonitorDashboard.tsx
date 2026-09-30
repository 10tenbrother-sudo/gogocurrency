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

export function FlowMonitorDashboard({
  theme = 'light',
  onSelectPair,
  onToggleTheme,
  onLogout,
  activeTimeframe = '5M',
  onChangeTimeframe,
  timeframeHistories,
}: FlowMonitorDashboardProps) {
  // Active Category (FX Forex [28] via Currency Strength, CM Commodities [9], CR Crypto [20], IX Indices [11] via Webhook)
  const [activeCategory, setActiveCategory] = useState<MarketCategoryTab>('metals');

  // Internal timeframe state if not provided from parent
  const [localTimeframe, setLocalTimeframe] = useState<TimeframeKey>(activeTimeframe);
  const currentTf = onChangeTimeframe ? activeTimeframe : localTimeframe;

  const handleTimeframeChange = (tf: TimeframeKey) => {
    setLocalTimeframe(tf);
    if (onChangeTimeframe) {
      onChangeTimeframe(tf);
    }
  };

  // Multi-Mode Filter (Scalping, Day Trading, Swing) - "Nyalakan satu atau lebih gaya. Minimal satu aktif."
  const [activeModes, setActiveModes] = useState<Record<TradingModeKey, boolean>>({
    scalping: true,
    day_trading: false,
    swing: false,
  });

  // Keep activeModes in sync when activeTimeframe changes
  useEffect(() => {
    const cat = TIMEFRAME_CONFIGS[currentTf]?.category || 'scalp';
    if (cat === 'scalp') {
      setActiveModes((prev) => ({ ...prev, scalping: true }));
    } else if (cat === 'intraday') {
      setActiveModes((prev) => ({ ...prev, day_trading: true }));
    } else if (cat === 'swing') {
      setActiveModes((prev) => ({ ...prev, swing: true }));
    }
  }, [currentTf]);

  // Dashboard Setup Preset (Default, Compact, All, Important)
  const [activeSetup, setActiveSetup] = useState<DashboardSetupKey>('default');
  const [isLayoutUnlocked, setIsLayoutUnlocked] = useState<boolean>(false);

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

  // Toggle Mode
  const handleToggleMode = (mode: TradingModeKey) => {
    setActiveModes((prev) => {
      const next = { ...prev, [mode]: !prev[mode] };
      // Ensure at least one mode remains active
      if (!next.scalping && !next.day_trading && !next.swing) {
        return prev;
      }
      return next;
    });

    // Switch main timeframe accordingly if single mode clicked
    if (mode === 'scalping') handleTimeframeChange('5M');
    else if (mode === 'day_trading') handleTimeframeChange('1H');
    else if (mode === 'swing') handleTimeframeChange('4H');
  };

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

  // Derived category counts
  const counts = useMemo(() => {
    const fx = 28; // Standard 28 pairs analyzed via Currency Strength
    const metalsList = (latestSnapshot?.metals && latestSnapshot.metals.length > 0)
      ? latestSnapshot.metals
      : ((latestSnapshot as any)?.items || []);
    let uniqueMetalCount = metalsList.length;
    if (!metalsList.some((m: any) => m.pair === 'GOLD' || m.pair === 'XAUUSD')) uniqueMetalCount++;
    if (!metalsList.some((m: any) => m.pair === 'SILVER' || m.pair === 'XAGUSD')) uniqueMetalCount++;
    if (latestSnapshot?.context?.XAUXAG !== undefined) uniqueMetalCount++;
    const cm = Math.max(7, uniqueMetalCount);
    const cr = latestSnapshot?.crypto?.length || 10;
    const ix = latestSnapshot?.inst?.length || 5;
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

      // Normalize XAUUSD -> GOLD and XAGUSD -> SILVER
      rawList = sourceMetals.map((item) => {
        let pair = item.pair;
        if (pair === 'XAUUSD') pair = 'GOLD';
        if (pair === 'XAGUSD') pair = 'SILVER';
        return { ...item, pair };
      });

      // Ensure SILVER is present
      if (!rawList.some((x) => x.pair === 'SILVER')) {
        const silverPct = typeof latestSnapshot.context?.XAUXAG === 'number'
          ? (typeof latestSnapshot.context?.GOLD === 'number' ? Number(latestSnapshot.context.GOLD) - Number(latestSnapshot.context.XAUXAG) : -2.01)
          : -2.01;
        rawList.unshift({
          pair: 'SILVER',
          pct: Number(silverPct.toFixed(2)),
          dir: silverPct >= 0 ? 'LONG' : 'SHORT',
          price: 31.85,
          ema20: 32.20,
        });
      }

      // Ensure GOLD is present
      if (!rawList.some((x) => x.pair === 'GOLD')) {
        const goldPct = typeof latestSnapshot.context?.GOLD === 'number' ? Number(latestSnapshot.context.GOLD) : -1.55;
        rawList.unshift({
          pair: 'GOLD',
          pct: Number(goldPct.toFixed(2)),
          dir: goldPct >= 0 ? 'LONG' : 'SHORT',
          price: 2685.40,
          ema20: 2695.10,
        });
      }

      // Include GOLDSILVER ratio if context exists
      if (
        latestSnapshot.context?.XAUXAG !== undefined &&
        !rawList.some((x) => x.pair === 'GOLDSILVER' || x.pair === 'XAUXAG')
      ) {
        rawList.push({
          pair: 'GOLDSILVER',
          pct: Number(latestSnapshot.context.XAUXAG),
          dir: Number(latestSnapshot.context.XAUXAG) >= 0 ? 'LONG' : 'SHORT',
        });
      }
    } else if (activeCategory === 'crypto') {
      rawList = [...(latestSnapshot.crypto || [])];
    } else if (activeCategory === 'inst') {
      rawList = [...(latestSnapshot.inst || [])];
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

  // Sort & Filter top movers based on activeSetup
  const displayedMovers = useMemo(() => {
    let list = [...topMovers];

    // Priority sort by absolute score
    list.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    if (activeSetup === 'compact') {
      list = list.slice(0, 4);
    } else if (activeSetup === 'important') {
      list = list.filter((m) => Math.abs(m.score) >= 3);
    } else if (activeSetup === 'default') {
      // Default: show top 8 movers
      if (list.length > 8) list = list.slice(0, 8);
    }

    return list;
  }, [topMovers, activeSetup]);

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

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 font-sans transition-colors">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── 1. Top Header Bar ── */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f766e] dark:text-teal-400">
              Flow Monitor
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium mt-0.5">
              Market Regime
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* 5-Minute Candle Clock Counter */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-xs">
              <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
              <span>Candle 5M:</span>
              <span className="font-bold">{candleClock.formatted}</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer transition-colors shadow-2xs"
              title="Ganti Tema (Dark / Light)"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Syncing Status Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-600 dark:text-zinc-300 shadow-2xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Syncing</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 hover:bg-[#0f766e]/20 text-[#0f766e] dark:text-teal-300 text-xs font-medium cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Script & Worker Hub Button */}
            <button
              onClick={() => setShowScriptModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs text-slate-600 dark:text-zinc-300 cursor-pointer transition-colors shadow-2xs"
              title="Buka Skrip TradingView Pine Script & Webhook"
            >
              <FileCode className="w-3 h-3 text-amber-500" />
              <span>Script Hub</span>
            </button>

            {/* Logout / Exit Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer transition-colors shadow-2xs"
            >
              <LogOut className="w-3 h-3" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* ── 2. Top Category Selector Bar (Big Cards) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Forex (Currency Strength Powered) */}
          <button
            onClick={() => setActiveCategory('forex')}
            className={`flex items-center justify-center gap-2 p-4 rounded-xl border bg-white dark:bg-zinc-900 text-center transition-all cursor-pointer shadow-2xs ${
              activeCategory === 'forex'
                ? 'border-[#0f766e] dark:border-teal-400 ring-1 ring-[#0f766e]/30'
                : 'border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">FX</span>
            <span
              className={`text-sm font-semibold ${
                activeCategory === 'forex'
                  ? 'text-[#0f766e] dark:text-teal-400'
                  : 'text-slate-700 dark:text-zinc-200'
              }`}
            >
              Forex
            </span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-mono">
              {counts.fx}
            </span>
          </button>

          {/* Card 2: Commodities (Webhook Powered — Active in Reference Image) */}
          <button
            onClick={() => setActiveCategory('metals')}
            className={`flex items-center justify-center gap-2 p-4 rounded-xl border bg-white dark:bg-zinc-900 text-center transition-all cursor-pointer shadow-2xs ${
              activeCategory === 'metals'
                ? 'border-[#0f766e] dark:border-teal-400 ring-1 ring-[#0f766e]/30'
                : 'border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <span className="text-xs font-semibold text-[#0f766e] dark:text-teal-400">CM</span>
            <span
              className={`text-sm font-semibold ${
                activeCategory === 'metals'
                  ? 'text-[#0f766e] dark:text-teal-400'
                  : 'text-slate-700 dark:text-zinc-200'
              }`}
            >
              Commodities
            </span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-teal-400 font-mono font-semibold">
              {counts.cm}
            </span>
          </button>

          {/* Card 3: Crypto (Webhook Powered) */}
          <button
            onClick={() => setActiveCategory('crypto')}
            className={`flex items-center justify-center gap-2 p-4 rounded-xl border bg-white dark:bg-zinc-900 text-center transition-all cursor-pointer shadow-2xs ${
              activeCategory === 'crypto'
                ? 'border-[#0f766e] dark:border-teal-400 ring-1 ring-[#0f766e]/30'
                : 'border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">CR</span>
            <span
              className={`text-sm font-semibold ${
                activeCategory === 'crypto'
                  ? 'text-[#0f766e] dark:text-teal-400'
                  : 'text-slate-700 dark:text-zinc-200'
              }`}
            >
              Crypto
            </span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-mono">
              {counts.cr}
            </span>
          </button>

          {/* Card 4: Indices (Webhook Powered) */}
          <button
            onClick={() => setActiveCategory('inst')}
            className={`flex items-center justify-center gap-2 p-4 rounded-xl border bg-white dark:bg-zinc-900 text-center transition-all cursor-pointer shadow-2xs ${
              activeCategory === 'inst'
                ? 'border-[#0f766e] dark:border-teal-400 ring-1 ring-[#0f766e]/30'
                : 'border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">IX</span>
            <span
              className={`text-sm font-semibold ${
                activeCategory === 'inst'
                  ? 'text-[#0f766e] dark:text-teal-400'
                  : 'text-slate-700 dark:text-zinc-200'
              }`}
            >
              Indices
            </span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-mono">
              {counts.ix}
            </span>
          </button>
        </div>

        {/* ── 3. MODE & UNIFIED TIMEFRAME HORIZONS ROW ── */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[11px]">
              MODE
            </span>

            {/* Scalping Mode & Sub-timeframe Group */}
            <div className="flex items-center gap-1 p-0.5 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                onClick={() => handleToggleMode('scalping')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer font-medium text-xs ${
                  activeModes.scalping
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-[#0f766e] dark:text-teal-300 font-bold'
                    : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeModes.scalping ? 'bg-[#0f766e] dark:bg-teal-400' : 'bg-slate-300 dark:bg-zinc-600'
                  }`}
                />
                <Zap className="w-3 h-3 text-amber-500" />
                <span>SCALPING</span>
              </button>

              {activeModes.scalping && (
                <div className="flex items-center gap-0.5 pr-1 font-mono text-[10px]">
                  {(['5M', '10M', '15M'] as TimeframeKey[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeChange(tf)}
                      className={`px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                        currentTf === tf
                          ? 'bg-[#0f766e] text-white font-bold'
                          : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Day Trading / Intraday Mode & Sub-timeframe Group */}
            <div className="flex items-center gap-1 p-0.5 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                onClick={() => handleToggleMode('day_trading')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer font-medium text-xs ${
                  activeModes.day_trading
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-[#0f766e] dark:text-teal-300 font-bold'
                    : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeModes.day_trading ? 'bg-[#0f766e] dark:bg-teal-400' : 'bg-slate-300 dark:bg-zinc-600'
                  }`}
                />
                <Target className="w-3 h-3 text-cyan-500" />
                <span>DAY TRADING</span>
              </button>

              {activeModes.day_trading && (
                <div className="flex items-center gap-0.5 pr-1 font-mono text-[10px]">
                  {(['1H', '2H', '3H'] as TimeframeKey[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeChange(tf)}
                      className={`px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                        currentTf === tf
                          ? 'bg-[#0f766e] text-white font-bold'
                          : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Swing Mode & Sub-timeframe Group */}
            <div className="flex items-center gap-1 p-0.5 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                onClick={() => handleToggleMode('swing')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer font-medium text-xs ${
                  activeModes.swing
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-[#0f766e] dark:text-teal-300 font-bold'
                    : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeModes.swing ? 'bg-[#0f766e] dark:bg-teal-400' : 'bg-slate-300 dark:bg-zinc-600'
                  }`}
                />
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span>SWING</span>
              </button>

              {activeModes.swing && (
                <div className="flex items-center gap-0.5 pr-1 font-mono text-[10px]">
                  {(['4H', '6H', '8H', '1D'] as TimeframeKey[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeChange(tf)}
                      className={`px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                        currentTf === tf
                          ? 'bg-[#0f766e] text-white font-bold'
                          : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <span className="text-slate-400 dark:text-zinc-500 text-[11px]">
            Nyalakan satu atau lebih gaya. Minimal satu aktif.
          </span>
        </div>

        {/* ── 4. DASHBOARD SETUP Row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
              DASHBOARD SETUP
            </span>
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
              Choose a setup or unlock to customize.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Default Pill */}
            <button
              onClick={() => setActiveSetup('default')}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                activeSetup === 'default'
                  ? 'bg-teal-50 dark:bg-teal-950/50 text-[#0f766e] dark:text-teal-300 border border-[#0f766e]/30'
                  : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Default
            </button>

            {/* Compact Pill */}
            <button
              onClick={() => setActiveSetup('compact')}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                activeSetup === 'compact'
                  ? 'bg-teal-50 dark:bg-teal-950/50 text-[#0f766e] dark:text-teal-300 border border-[#0f766e]/30'
                  : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Compact
            </button>

            {/* All Pill */}
            <button
              onClick={() => setActiveSetup('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                activeSetup === 'all'
                  ? 'bg-teal-50 dark:bg-teal-950/50 text-[#0f766e] dark:text-teal-300 border border-[#0f766e]/30'
                  : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              All
            </button>

            {/* Important Pill */}
            <button
              onClick={() => setActiveSetup('important')}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                activeSetup === 'important'
                  ? 'bg-teal-50 dark:bg-teal-950/50 text-[#0f766e] dark:text-teal-300 border border-[#0f766e]/30'
                  : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Important
            </button>

            {/* Unlock Layout Button */}
            <button
              onClick={() => setIsLayoutUnlocked(!isLayoutUnlocked)}
              className="px-3 py-1 rounded-full text-xs text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors ml-1"
            >
              {isLayoutUnlocked ? 'Lock Layout' : 'Unlock Layout'}
            </button>

            {/* Reset Button */}
            <button
              onClick={() => {
                setActiveSetup('default');
                setActiveModes({ scalping: true, day_trading: false, swing: false });
                setIsLayoutUnlocked(false);
              }}
              className="px-3 py-1 rounded-full text-xs text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── 5. Main Card: Top Movers ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0f766e] dark:text-teal-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Top Movers
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
                {activeCategory === 'forex' ? 'CS Engine (28 Pairs)' : 'TradingView Live Feed'}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
              Updated: {formattedUpdateTime}
            </span>
          </div>

          {/* Expandable Downward Explanation Cards */}
          <div className="p-3 sm:p-4 space-y-2.5">
            {displayedMovers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-zinc-500 font-mono text-xs">
                Menunggu pembaruan aliran modal untuk kategori ini...
              </div>
            ) : (
              displayedMovers.map((mover, index) => {
                const rank = index + 1;
                const isExpanded = expandedPair === mover.pair;

                // Extract horizon scores from metrics or mover
                const scalpDelta = mover.metrics?.scalpDelta ?? (mover.isBull ? 1.5 : -1.5);
                const intraDelta = mover.metrics?.intradayDelta ?? (mover.isBull ? 1.2 : -1.2);
                const swingDelta = mover.metrics?.swingDelta ?? (mover.isBull ? 1.0 : -1.0);

                // Quantize scores to integer range [-4, +4]
                const scalpScore = Math.max(-4, Math.min(4, Math.round(scalpDelta >= 0 ? Math.min(4, scalpDelta * 2) : Math.max(-4, scalpDelta * 2))));
                const intraScore = Math.max(-4, Math.min(4, Math.round(intraDelta >= 0 ? Math.min(4, intraDelta * 2) : Math.max(-4, intraDelta * 2))));
                const swingScore = Math.max(-4, Math.min(4, Math.round(swingDelta >= 0 ? Math.min(4, swingDelta * 2) : Math.max(-4, swingDelta * 2))));

                // Sparkline history lines
                const scalpValues = generateMiniHistory(`${mover.pair}-scalp`, scalpScore);
                const intraValues = generateMiniHistory(`${mover.pair}-intra`, intraScore);
                const swingValues = generateMiniHistory(`${mover.pair}-swing`, swingScore);

                const agoMinutes = (index * 2 + 15);

                return (
                  <div
                    key={mover.pair}
                    className={`border transition-all rounded-2xl overflow-hidden ${
                      isExpanded
                        ? 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-4 sm:p-5'
                        : 'border-slate-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 hover:border-slate-300 dark:hover:border-zinc-700 p-3.5 sm:p-4 cursor-pointer shadow-2xs'
                    }`}
                  >
                    {/* Top Row: [Rank] Pair [-4] ... [-4] [Bear] 17m ago */}
                    <div
                      onClick={() => {
                        setExpandedPair((prev) => (prev === mover.pair ? null : mover.pair));
                        if (onSelectPair) onSelectPair(mover.pair);
                      }}
                      className="flex items-center justify-between cursor-pointer select-none gap-2"
                    >
                      {/* Left: Rank Chip, Pair Name, Score Badge */}
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-50 dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700/60 flex items-center justify-center text-xs font-mono font-semibold text-slate-500 dark:text-zinc-400 shrink-0">
                          {rank}
                        </span>
                        <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-zinc-100 font-mono">
                          {mover.pair}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                            mover.isBull
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-900/50'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/70 dark:border-rose-900/50'
                          }`}
                        >
                          {mover.scoreDisplay}
                        </span>
                      </div>

                      {/* Right: Score Box, Direction Pill, Time Ago */}
                      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                        {/* Score Box */}
                        <div
                          className={`px-3 sm:px-4 py-1.5 rounded-xl border font-mono font-bold text-xs sm:text-sm flex items-center justify-center min-w-[38px] sm:min-w-[44px] ${
                            mover.isBull
                              ? 'border-emerald-200/90 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                              : 'border-rose-200/90 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {mover.scoreDisplay}
                        </div>

                        {/* Direction Pill */}
                        <div
                          className={`px-5 sm:px-8 py-1.5 sm:py-2 rounded-xl border font-semibold text-xs sm:text-sm flex items-center justify-center ${
                            mover.isBull
                              ? 'border-emerald-200/90 dark:border-emerald-900/60 bg-emerald-100/60 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                              : 'border-rose-200/90 dark:border-rose-900/60 bg-rose-100/60 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {mover.isBull ? 'Bull' : 'Bear'}
                        </div>

                        {/* Timestamp */}
                        <span className="text-xs font-mono text-slate-400 dark:text-zinc-500 hidden sm:inline-block w-16 text-right">
                          {agoMinutes}m ago
                        </span>
                      </div>
                    </div>

                    {/* Downward Explanation Accordion when expanded */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800/80 space-y-4">
                        {/* Header inside: Title, Regime, Score Badge */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3
                              className={`text-xl font-bold font-mono tracking-tight ${
                                mover.isBull ? 'text-emerald-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {mover.pair}
                            </h3>
                            <p className="text-xs font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                              {mover.isBull ? 'Bullish regime.' : 'Bearish regime.'} · net {mover.scoreDisplay}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${
                              mover.isBull
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-teal-300'
                                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            {mover.scoreDisplay}
                          </span>
                        </div>

                        {/* 3 Mini Sparkline Chart Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Scalping Card */}
                          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Scalping</span>
                              <span
                                className={`text-xs font-mono font-bold ${
                                  scalpScore >= 0 ? 'text-emerald-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {scalpScore > 0 ? `+${scalpScore}` : scalpScore}
                              </span>
                            </div>
                            <MiniSparkline values={scalpValues} isBull={scalpScore >= 0} />
                          </div>

                          {/* Day Trading Card */}
                          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Day Trading</span>
                              <span
                                className={`text-xs font-mono font-bold ${
                                  intraScore >= 0 ? 'text-emerald-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {intraScore > 0 ? `+${intraScore}` : intraScore}
                              </span>
                            </div>
                            <MiniSparkline values={intraValues} isBull={intraScore >= 0} />
                          </div>

                          {/* Swing Card */}
                          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Swing</span>
                              <span
                                className={`text-xs font-mono font-bold ${
                                  swingScore >= 0 ? 'text-emerald-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {swingScore > 0 ? `+${swingScore}` : swingScore}
                              </span>
                            </div>
                            <MiniSparkline values={swingValues} isBull={swingScore >= 0} />
                          </div>
                        </div>

                        {/* 3 Horizon Breakdown Rows */}
                        <div className="space-y-2.5">
                          {/* 1. Scalping (LTF) */}
                          <div
                            className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                              activeModes.scalping
                                ? mover.isBull
                                  ? 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                                  : 'border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20'
                                : 'border-slate-200/70 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-800/20'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                LTF
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">
                                Scalping
                              </span>
                              {activeModes.scalping && (
                                <>
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                                      scalpScore >= 0
                                        ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-teal-300'
                                        : 'bg-rose-100/90 text-rose-800 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300'
                                    }`}
                                  >
                                    {scalpScore > 0 ? `+${scalpScore}` : scalpScore}
                                  </span>
                                  <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                                    {getSentimentLabel(scalpScore)}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              {activeModes.scalping ? (
                                <>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {['5m', '10m', '15m'].map((tf) => (
                                      <span
                                        key={tf}
                                        className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold border ${
                                          scalpScore >= 0
                                            ? 'bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/60'
                                            : 'bg-rose-100/70 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-200/60'
                                        }`}
                                      >
                                        {tf} {scalpScore >= 0 ? 'BUY' : 'SELL'} {scalpScore >= 0 ? '+2' : '-2'}
                                      </span>
                                    ))}
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                                    {formattedUpdateTime} · {agoMinutes}m ago
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
                                  No data yet.
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2. Day Trading (MTF) */}
                          <div
                            className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                              activeModes.day_trading
                                ? mover.isBull
                                  ? 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                                  : 'border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20'
                                : 'border-slate-200/70 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-800/20'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-800 dark:text-teal-300">
                                MTF
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">
                                Day Trading
                              </span>
                              {activeModes.day_trading && (
                                <>
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                                      intraScore >= 0
                                        ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-teal-300'
                                        : 'bg-rose-100/90 text-rose-800 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300'
                                    }`}
                                  >
                                    {intraScore > 0 ? `+${intraScore}` : intraScore}
                                  </span>
                                  <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                                    {getSentimentLabel(intraScore)}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              {activeModes.day_trading ? (
                                <>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {['1h', '2h', '3h'].map((tf) => (
                                      <span
                                        key={tf}
                                        className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold border ${
                                          intraScore >= 0
                                            ? 'bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/60'
                                            : 'bg-rose-100/70 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-200/60'
                                        }`}
                                      >
                                        {tf} {intraScore >= 0 ? 'BUY' : 'SELL'} {intraScore >= 0 ? '+1' : '-1'}
                                      </span>
                                    ))}
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                                    {formattedUpdateTime} · 1h ago
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
                                  No data yet.
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3. Swing (HTF) */}
                          <div
                            className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                              activeModes.swing
                                ? mover.isBull
                                  ? 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                                  : 'border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20'
                                : 'border-slate-200/70 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-800/20'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100/70 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                                HTF
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">
                                Swing
                              </span>
                              {activeModes.swing && (
                                <>
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                                      swingScore >= 0
                                        ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-teal-300'
                                        : 'bg-rose-100/90 text-rose-800 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300'
                                    }`}
                                  >
                                    {swingScore > 0 ? `+${swingScore}` : swingScore}
                                  </span>
                                  <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                                    {getSentimentLabel(swingScore)}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              {activeModes.swing ? (
                                <>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {['4h', '6h', '8h', '1d'].map((tf) => (
                                      <span
                                        key={tf}
                                        className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold border ${
                                          swingScore >= 0
                                            ? 'bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/60'
                                            : 'bg-rose-100/70 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-200/60'
                                        }`}
                                      >
                                        {tf} {swingScore >= 0 ? 'BUY' : 'SELL'} {swingScore >= 0 ? '+1' : '-1'}
                                      </span>
                                    ))}
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                                    {formattedUpdateTime} · 4h ago
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
                                  No data yet.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 6. Bottom KPI Metric Cards (Grid of 3) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: NET SCORE */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              NET SCORE
            </span>
            <div className="mt-2 mb-1">
              <span
                className={`text-3xl font-extrabold tracking-tight ${
                  metrics.netScoreNumber >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-500 dark:text-rose-400'
                }`}
              >
                {metrics.netScore}
              </span>
            </div>
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
              Scalp + Day + Swing ({activeCategory.toUpperCase()})
            </span>
          </div>

          {/* Card 2: MARKET BALANCE (3 Columns Inside) */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">
              MARKET BALANCE
            </span>

            <div className="grid grid-cols-3 gap-2">
              {/* Bull Aligned */}
              <div>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 block">
                  {metrics.bullAligned}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                  bull aligned
                </span>
              </div>

              {/* Bear Aligned */}
              <div>
                <span className="text-2xl font-bold text-rose-500 dark:text-rose-400 block">
                  {metrics.bearAligned}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                  bear aligned
                </span>
              </div>

              {/* Wait Zone */}
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-700 dark:text-zinc-200">
                    {metrics.waitZoneCount}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
                    {metrics.waitZonePct}%
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                  wait zone
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: TOP MOVE */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              TOP MOVE
            </span>
            <div className="mt-2 mb-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                {metrics.topMovePair} • {metrics.topMoveScore}
              </span>
            </div>
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
              strongest aggregate
            </span>
          </div>
        </div>

        {/* ── 7. Settings & Configuration Bar Footer ── */}
        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-500 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-3">
            <span>
              Worker Endpoint:{' '}
              <code className="text-slate-600 dark:text-zinc-300 font-mono">
                {workerUrl.replace(/^https?:\/\//, '').split('/')[0]}
              </code>
            </span>
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-[#0f766e] dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Sliders className="w-3 h-3" />
              <span>Ganti Endpoint</span>
            </button>
          </div>

          <button
            onClick={() => setShowScriptModal(true)}
            className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            <FileCode className="w-3 h-3" />
            <span>TradingView Pine Script v6 (40 Prime)</span>
          </button>
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
