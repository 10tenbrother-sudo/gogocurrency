/**
 * Flow Monitor Engine - Bitcoin, Commodities & Multi-Asset Momentum Logic
 * Derived from aideelyst/flowmonitor TradingView Pine Script & Cloudflare Worker architecture
 */

export type FlowAssetCategory = 'crypto' | 'metals' | 'inst' | 'forex';

export interface FlowItem {
  pair: string;
  pct: number;
  dir: 'LONG' | 'SHORT';
  rank?: number;
  price?: number;
  open?: number;
  high?: number;
  low?: number;
  vol?: number;
  ema20?: number;
  src?: string;
}

export interface MarketContext {
  US10Y?: number;
  DXY?: number;
  AUDNZD?: number;
  CHFJPY?: number;
  EURGBP?: number;
  USDCAD?: number;
  XAUXAG?: number;
  GOLD?: number;
  SILVER?: number;
  [key: string]: number | undefined;
}

export interface FlowSnapshot {
  time: string;
  timestamp?: number;
  mode?: string;
  forex: FlowItem[];
  metals: FlowItem[];
  crypto: FlowItem[];
  inst?: FlowItem[];
  context: MarketContext;
}

export type StreakRecord = Record<string, number>;

export interface StreakAlert {
  id: string;
  pair: string;
  roc: number;
  streak: number;
  timestamp: number;
  timeString: string;
  dir: 'LONG' | 'SHORT';
  category: FlowAssetCategory;
}

export interface FlowValidationState {
  timeStatus: 'VALID' | 'INITIALIZING' | 'LATE_ENTRY';
  timeWindowValid: boolean;
  currentMinute: number;
  currentSeconds: number;
  secondsRemainingInWindow: number;
  confluenceValid: boolean;
  dominantDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
  dominantCount: number;
  totalActiveCount: number;
  longCount: number;
  shortCount: number;
  thresholdValid: boolean;
  topRocValues: { pair: string; roc: number }[];
  overallSignal: 'STRONG_VALID' | 'CONDITIONAL' | 'FILTERED_OUT';
  summaryReason: string;
}

export interface AssetMeta {
  code: string;
  fullName: string;
  category: FlowAssetCategory;
  icon: string;
  unit?: string;
  description: string;
}

export const ASSET_METAS: Record<string, AssetMeta> = {
  // Crypto
  BTC: { code: 'BTC', fullName: 'Bitcoin Index', category: 'crypto', icon: '₿', unit: '$', description: 'Arus modal kripto utama dan barometer likuiditas global' },
  ETH: { code: 'ETH', fullName: 'Ethereum Flow', category: 'crypto', icon: 'Ξ', unit: '$', description: 'Barometer smart contract & DeFi risk appetite' },
  SOL: { code: 'SOL', fullName: 'Solana Flow', category: 'crypto', icon: '◎', unit: '$', description: 'High-beta momentum altcoin layer-1' },
  BNB: { code: 'BNB', fullName: 'Binance Coin', category: 'crypto', icon: '🔶', unit: '$', description: 'Ekosistem bursa kripto & likuiditas retail' },
  XRP: { code: 'XRP', fullName: 'Ripple Flow', category: 'crypto', icon: '✕', unit: '$', description: 'Arus pembayaran lintas batas perbankan' },
  DOGE: { code: 'DOGE', fullName: 'Dogecoin', category: 'crypto', icon: '🐕', unit: '$', description: 'Sentiment spekulatif retail & meme momentum' },
  ADA: { code: 'ADA', fullName: 'Cardano Flow', category: 'crypto', icon: '₳', unit: '$', description: 'Layer-1 PoS token flow' },

  // Commodities & Metals
  GOLD: { code: 'GOLD', fullName: 'Gold Spot (XAU/USD)', category: 'metals', icon: '🥇', unit: '$', description: 'Aset safe-haven utama terhadap inflasi & devaluasi fiat' },
  SILVER: { code: 'SILVER', fullName: 'Silver Spot (XAG/USD)', category: 'metals', icon: '🥈', unit: '$', description: 'Logam mulia ganda: safe haven + permintaan industri' },
  USOIL: { code: 'USOIL', fullName: 'WTI Crude Oil', category: 'metals', icon: '🛢️', unit: '$', description: 'Minyak mentah acuan Texas & korelasi CAD/energi' },
  UKOIL: { code: 'UKOIL', fullName: 'Brent Crude Oil', category: 'metals', icon: '⛽', unit: '$', description: 'Minyak mentah acuan global perkapalan Eropa/Asia' },
  COPPER: { code: 'COPPER', fullName: 'High Grade Copper', category: 'metals', icon: '🥉', unit: '$', description: 'Dr. Copper - Barometer kesehatan ekonomi manufaktur dunia' },
  NGAS: { code: 'NGAS', fullName: 'Natural Gas', category: 'metals', icon: '🔥', unit: '$', description: 'Komoditas gas alam pemanas & industri' },

  // Indices
  US500: { code: 'US500', fullName: 'S&P 500 Index', category: 'inst', icon: '📈', unit: 'pts', description: 'Acuan 500 korporasi terbesar pasar modal AS' },
  NAS100: { code: 'NAS100', fullName: 'Nasdaq 100 Index', category: 'inst', icon: '💻', unit: 'pts', description: 'Indeks teknologi terdepan & sensitif suku bunga' },
  US30: { code: 'US30', fullName: 'Dow Jones Industrial', category: 'inst', icon: '🏛️', unit: 'pts', description: '30 raksasa industri blue-chip Amerika' },
  GER40: { code: 'GER40', fullName: 'DAX 40 Germany', category: 'inst', icon: '🇩🇪', unit: 'pts', description: 'Lokomotif industri dan ekspor utama zona Eropa' },
  JP225: { code: 'JP225', fullName: 'Nikkei 225 Japan', category: 'inst', icon: '🇯🇵', unit: 'pts', description: 'Indeks bursa Tokyo - korelasi invers dengan JPY' },
};

/**
 * Evaluates the 4 core rules from Flow Monitor:
 * 1. ⏱ SIGNAL VALID: X:05 — X:30
 * 2. 🚫 SKIP JIKA LEWAT X:30 (Late entry filter)
 * 3. 🎯 MIN 4 PAIR / ASET SEARAH (Confluence filter)
 * 4. ⚡ SEMUA ≥ 0.10% (Momentum threshold filter)
 */
export function evaluateFlowValidationRules(
  items: FlowItem[],
  customDate?: Date
): FlowValidationState {
  const d = customDate || new Date();
  const minute = d.getMinutes();
  const seconds = d.getSeconds();

  // Rule 1 & 2: Execution Time Window
  let timeStatus: 'VALID' | 'INITIALIZING' | 'LATE_ENTRY';
  let timeWindowValid = false;
  let secondsRemainingInWindow = 0;

  if (minute < 5) {
    timeStatus = 'INITIALIZING';
    timeWindowValid = false;
    secondsRemainingInWindow = (5 - minute) * 60 - seconds;
  } else if (minute <= 30) {
    timeStatus = 'VALID';
    timeWindowValid = true;
    secondsRemainingInWindow = (30 - minute) * 60 + (60 - seconds);
  } else {
    timeStatus = 'LATE_ENTRY';
    timeWindowValid = false;
    secondsRemainingInWindow = 0;
  }

  // Rule 3: Minimum 4 pairs in same direction (LONG vs SHORT)
  const longItems = items.filter((it) => it.dir === 'LONG');
  const shortItems = items.filter((it) => it.dir === 'SHORT');
  const longCount = longItems.length;
  const shortCount = shortItems.length;

  let dominantDirection: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let dominantCount = 0;

  if (longCount >= shortCount) {
    dominantDirection = 'LONG';
    dominantCount = longCount;
  } else {
    dominantDirection = 'SHORT';
    dominantCount = shortCount;
  }

  // If list is small (e.g. metals has 2-4 items), adjust required confluence dynamically:
  // For lists >= 5: requires at least 4 in same direction
  // For lists 3-4: requires at least 3 in same direction
  // For lists <= 2: requires both (2) in same direction
  const requiredConfluence = items.length >= 5 ? 4 : Math.max(2, items.length);
  const confluenceValid = dominantCount >= requiredConfluence;

  // Rule 4: All top items >= 0.10% absolute momentum (avoid chop / zero noise)
  const sortedByAbsRoc = [...items].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const topCheckCount = Math.min(items.length, 3);
  const topItems = sortedByAbsRoc.slice(0, topCheckCount);
  const thresholdValid = topItems.length > 0 && topItems.every((it) => Math.abs(it.pct) >= 0.10);

  // Overall signal synthesis
  let overallSignal: 'STRONG_VALID' | 'CONDITIONAL' | 'FILTERED_OUT' = 'FILTERED_OUT';
  let summaryReason = '';

  if (timeWindowValid && confluenceValid && thresholdValid) {
    overallSignal = 'STRONG_VALID';
    summaryReason = `Sinyal TERKONFIRMASI LENGKAP: Window X:${String(minute).padStart(2, '0')} valid, ${dominantCount} aset ${dominantDirection}, momentum kuat ≥0.10%.`;
  } else if (timeWindowValid && (confluenceValid || thresholdValid)) {
    overallSignal = 'CONDITIONAL';
    summaryReason = `Sinyal BERSYARAT: Window valid, namun ${!confluenceValid ? 'arah belum cukup homogen' : 'sebagian momentum tipis di bawah 0.10%'}.`;
  } else if (!timeWindowValid) {
    overallSignal = 'FILTERED_OUT';
    summaryReason = timeStatus === 'LATE_ENTRY'
      ? `FILTER AKTIF: Menit X:${String(minute).padStart(2, '0')} melewati batas X:30. Hindari entry terlambat.`
      : `MENUNGGU: Menit X:${String(minute).padStart(2, '0')} masih dalam fase inisiasi candle (00–05).`;
  } else {
    overallSignal = 'FILTERED_OUT';
    summaryReason = `FILTER AKTIF: Konfluensi dan momentum belum memenuhi syarat minimum Flow Monitor.`;
  }

  return {
    timeStatus,
    timeWindowValid,
    currentMinute: minute,
    currentSeconds: seconds,
    secondsRemainingInWindow,
    confluenceValid,
    dominantDirection,
    dominantCount,
    totalActiveCount: items.length,
    longCount,
    shortCount,
    thresholdValid,
    topRocValues: topItems.map((it) => ({ pair: it.pair, roc: it.pct })),
    overallSignal,
    summaryReason,
  };
}

/**
 * Streak tracking logic from cloudflare-worker.js:
 * Sorted by |ROC|, top 5 assets gain +1 streak.
 * When dropped out of top 5, streak resets.
 * When streak hits threshold, generates an alert event.
 */
export function updateFlowStreaks(
  prevStreaks: StreakRecord,
  items: FlowItem[],
  threshold: number = 5,
  category: FlowAssetCategory = 'crypto'
): { updatedStreaks: StreakRecord; firedAlerts: StreakAlert[] } {
  const sorted = [...items].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const topNames = sorted.slice(0, 5).map((p) => p.pair);
  const allKnown = new Set([...Object.keys(prevStreaks), ...topNames]);
  const updatedStreaks: StreakRecord = {};
  const firedAlerts: StreakAlert[] = [];

  for (const item of allKnown) {
    if (topNames.includes(item)) {
      const newCount = (prevStreaks[item] || 0) + 1;
      updatedStreaks[item] = newCount;
      if (newCount === threshold) {
        const itemData = items.find((p) => p.pair === item);
        const roc = itemData ? itemData.pct : 0;
        const dir = itemData ? itemData.dir : roc >= 0 ? 'LONG' : 'SHORT';
        const now = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        firedAlerts.push({
          id: `fm-alert-${now}-${item}-${rand}`,
          pair: item,
          roc,
          streak: threshold,
          timestamp: now,
          timeString: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          dir,
          category,
        });
      }
    } else {
      // Fell out of top 5 - streak resets
    }
  }

  return { updatedStreaks, firedAlerts };
}

/**
 * Fetch latest Flow Monitor snapshot via backend proxy
 */
export async function fetchFlowMonitorLatest(customWorkerUrl?: string): Promise<{
  source: string;
  data: FlowSnapshot;
}> {
  const param = customWorkerUrl ? `?workerUrl=${encodeURIComponent(customWorkerUrl)}` : '';
  const res = await fetch(`/api/flow-monitor/latest${param}`);
  if (!res.ok) {
    throw new Error(`Flow monitor request failed: ${res.status}`);
  }
  return await res.json();
}

/**
 * Fetch historical Flow Monitor snapshots via backend proxy
 */
export async function fetchFlowMonitorHistory(customWorkerUrl?: string): Promise<{
  source: string;
  data: FlowSnapshot[];
}> {
  const param = customWorkerUrl ? `?workerUrl=${encodeURIComponent(customWorkerUrl)}` : '';
  const res = await fetch(`/api/flow-monitor/history${param}`);
  if (!res.ok) {
    throw new Error(`Flow monitor history request failed: ${res.status}`);
  }
  return await res.json();
}

/**
 * Test user's custom Cloudflare Worker connection
 */
export async function testWorkerConnection(
  workerUrl: string,
  token?: string
): Promise<{
  ok: boolean;
  endpointUsed?: string;
  latencyMs?: number;
  format?: string;
  error?: string;
  sample?: any;
  note?: string;
}> {
  const res = await fetch('/api/flow-monitor/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerUrl, token }),
  });
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}: Gagal memanggil endpoint verifikasi` };
  }
  return await res.json();
}
