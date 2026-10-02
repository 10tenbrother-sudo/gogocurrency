import {
  CurrencyCode,
  CurrencyConfig,
  CurrencyStrengthScore,
  MarketSession,
  PairOpportunity,
  PairRate,
  StrengthSnapshot,
  TimeframeKey,
} from '../types/forex';

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    country: 'United States',
    flag: '🇺🇸',
    color: '#ff9900', // Orange (Exact currency-strength.com)
    symbol: '$',
    baseWeight: 1.0,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    country: 'Eurozone',
    flag: '🇪🇺',
    color: '#ff0000', // Red (Exact currency-strength.com)
    symbol: '€',
    baseWeight: 1.0,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    country: 'United Kingdom',
    flag: '🇬🇧',
    color: '#00cc00', // Green (Exact currency-strength.com)
    symbol: '£',
    baseWeight: 0.95,
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    country: 'Japan',
    flag: '🇯🇵',
    color: '#00ccff', // Light Blue / Cyan (Exact currency-strength.com)
    symbol: '¥',
    baseWeight: 0.9,
  },
  CHF: {
    code: 'CHF',
    name: 'Swiss Franc',
    country: 'Switzerland',
    flag: '🇨🇭',
    color: '#996600', // Brown (Exact currency-strength.com)
    symbol: 'Fr',
    baseWeight: 0.85,
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    country: 'Australia',
    flag: '🇦🇺',
    color: '#0033ff', // Blue (Exact currency-strength.com)
    symbol: 'A$',
    baseWeight: 0.85,
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    country: 'Canada',
    flag: '🇨🇦',
    color: '#9900ff', // Purple (Exact currency-strength.com)
    symbol: 'C$',
    baseWeight: 0.85,
  },
  NZD: {
    code: 'NZD',
    name: 'New Zealand Dollar',
    country: 'New Zealand',
    flag: '🇳🇿',
    color: '#ff33cc', // Pink (Exact currency-strength.com)
    symbol: 'NZ$',
    baseWeight: 0.8,
  },
};

export const CURRENCY_CODES: CurrencyCode[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'
];

export function getCurrencyConfig(code: string): CurrencyConfig {
  if (code && CURRENCIES[code as CurrencyCode]) {
    return CURRENCIES[code as CurrencyCode];
  }
  const u = (code || '').toUpperCase().trim();
  if (u === 'XAU' || u === 'GOLD') {
    return {
      code: 'XAU' as CurrencyCode,
      name: 'Emas (Gold)',
      country: 'Komoditas Logam',
      flag: '🪙',
      color: '#eab308',
      symbol: '$',
      baseWeight: 1.0,
    };
  }
  if (u === 'XAG' || u === 'SILVER') {
    return {
      code: 'XAG' as CurrencyCode,
      name: 'Perak (Silver)',
      country: 'Komoditas Logam',
      flag: '🥈',
      color: '#94a3b8',
      symbol: '$',
      baseWeight: 1.0,
    };
  }
  if (u === 'WTI' || u === 'OIL' || u === 'USOIL') {
    return {
      code: 'WTI' as CurrencyCode,
      name: 'Minyak Mentah (Crude Oil)',
      country: 'Komoditas Energi',
      flag: '🛢️',
      color: '#f97316',
      symbol: '$',
      baseWeight: 1.0,
    };
  }
  if (u === 'BTC') {
    return {
      code: 'BTC' as CurrencyCode,
      name: 'Bitcoin',
      country: 'Crypto Asset',
      flag: '₿',
      color: '#f59e0b',
      symbol: '₿',
      baseWeight: 1.0,
    };
  }
  if (u === 'ETH') {
    return {
      code: 'ETH' as CurrencyCode,
      name: 'Ethereum',
      country: 'Crypto Asset',
      flag: 'Ξ',
      color: '#6366f1',
      symbol: 'Ξ',
      baseWeight: 1.0,
    };
  }
  if (u === 'SOL') {
    return {
      code: 'SOL' as CurrencyCode,
      name: 'Solana',
      country: 'Crypto Asset',
      flag: '◎',
      color: '#a855f7',
      symbol: '◎',
      baseWeight: 1.0,
    };
  }
  if (u === 'US30' || u === 'DJI') {
    return {
      code: 'US30' as CurrencyCode,
      name: 'Dow Jones 30',
      country: 'Indeks Saham AS',
      flag: '📈',
      color: '#0ea5e9',
      symbol: 'pts',
      baseWeight: 1.0,
    };
  }
  if (u === 'NAS100' || u === 'NDX') {
    return {
      code: 'NAS100' as CurrencyCode,
      name: 'Nasdaq 100',
      country: 'Indeks Saham AS',
      flag: '💻',
      color: '#06b6d4',
      symbol: 'pts',
      baseWeight: 1.0,
    };
  }
  if (u === 'SPX500' || u === 'SPX') {
    return {
      code: 'SPX500' as CurrencyCode,
      name: 'S&P 500',
      country: 'Indeks Saham AS',
      flag: '🏛️',
      color: '#3b82f6',
      symbol: 'pts',
      baseWeight: 1.0,
    };
  }
  if (u === 'USDT') {
    return {
      code: 'USDT' as CurrencyCode,
      name: 'Tether USD',
      country: 'Stablecoin',
      flag: '💵',
      color: '#10b981',
      symbol: '$',
      baseWeight: 1.0,
    };
  }
  return {
    code: (code || 'USD') as CurrencyCode,
    name: code || 'Asset',
    country: 'Pasar Global',
    flag: '🌐',
    color: '#0ea5e9',
    symbol: code || '',
    baseWeight: 1.0,
  };
}

export interface TimeframeConfig {
  key: TimeframeKey;
  label: string;
  category: 'scalp' | 'intraday' | 'swing';
  categoryLabel: string;
  minutes: number;
  tickVolatility: number; // Max tick random variation (Scalping is high, Intraday/Swing is low/stable)
  inertia: number; // Momentum resistance to change (0.0 to 1.0)
  lookbackDelta: number; // Lookback bars to calculate delta to prevent sub-second direction flipping
  description: string;
}

export const TIMEFRAME_CONFIGS: Record<TimeframeKey, TimeframeConfig> = {
  // SCALPING (5 Menit, 10 Menit, 15 Menit) - Update per 5 menit
  '5M': {
    key: '5M',
    label: '5M',
    category: 'scalp',
    categoryLabel: 'Scalping',
    minutes: 5,
    tickVolatility: 0.045,
    inertia: 0.32,
    lookbackDelta: 1, // 1 bar (5 menit)
    description: 'Mikro volatilitas cepat 5 menit (update per 5 menit bar close).',
  },
  '10M': {
    key: '10M',
    label: '10M',
    category: 'scalp',
    categoryLabel: 'Scalping',
    minutes: 10,
    tickVolatility: 0.035,
    inertia: 0.45,
    lookbackDelta: 2, // 2 bar (10 menit)
    description: 'Konfirmasi scalping 10 menit (evaluasi 2 bar interval 5m).',
  },
  '15M': {
    key: '15M',
    label: '15M',
    category: 'scalp',
    categoryLabel: 'Scalping',
    minutes: 15,
    tickVolatility: 0.025,
    inertia: 0.58,
    lookbackDelta: 3, // 3 bar (15 menit)
    description: 'Momentum breakout scalping 15 menit (evaluasi 3 bar interval 5m).',
  },

  // INTRADAY (1 Jam, 2 Jam, 3 Jam)
  '1H': {
    key: '1H',
    label: '1H',
    category: 'intraday',
    categoryLabel: 'Intraday',
    minutes: 60,
    tickVolatility: 0.012,
    inertia: 0.82,
    lookbackDelta: 6,
    description: 'Tren Intraday 1 Jam - Dominasi sesi Tokyo, London, atau New York.',
  },
  '2H': {
    key: '2H',
    label: '2H',
    category: 'intraday',
    categoryLabel: 'Intraday',
    minutes: 120,
    tickVolatility: 0.009,
    inertia: 0.87,
    lookbackDelta: 8,
    description: 'Tren Intraday 2 Jam - Blok siklus peralihan sesi pasar dunia.',
  },
  '3H': {
    key: '3H',
    label: '3H',
    category: 'intraday',
    categoryLabel: 'Intraday',
    minutes: 180,
    tickVolatility: 0.007,
    inertia: 0.91,
    lookbackDelta: 10,
    description: 'Tren Intraday 3 Jam - Konfirmasi momentum golden overlap London-NY.',
  },

  // SWING (4 Jam, 6 Jam, 8 Jam, 1 Hari)
  '4H': {
    key: '4H',
    label: '4H',
    category: 'swing',
    categoryLabel: 'Swing',
    minutes: 240,
    tickVolatility: 0.005,
    inertia: 0.94,
    lookbackDelta: 8,
    description: 'Swing 4 Jam - Aliran likuiditas multi-sesi dan support/resistance kunci.',
  },
  '6H': {
    key: '6H',
    label: '6H',
    category: 'swing',
    categoryLabel: 'Swing',
    minutes: 360,
    tickVolatility: 0.0035,
    inertia: 0.96,
    lookbackDelta: 10,
    description: 'Swing 6 Jam - Struktur gelombang pergerakan harga 1/4 harian.',
  },
  '8H': {
    key: '8H',
    label: '8H',
    category: 'swing',
    categoryLabel: 'Swing',
    minutes: 480,
    tickVolatility: 0.0025,
    inertia: 0.98,
    lookbackDelta: 12,
    description: 'Swing 8 Jam - Satu siklus rotasi shift pasar global 8-jam penuh.',
  },
  '1D': {
    key: '1D',
    label: '1D',
    category: 'swing',
    categoryLabel: 'Swing',
    minutes: 1440,
    tickVolatility: 0.0015,
    inertia: 0.99,
    lookbackDelta: 14,
    description: 'Macro 1 Hari - Bias fundamental harian & sentimen rilis berita besar.',
  },
};

export const ALL_TIMEFRAME_KEYS: TimeframeKey[] = [
  '5M',
  '10M',
  '15M',
  '1H',
  '2H',
  '3H',
  '4H',
  '6H',
  '8H',
  '1D',
];

/**
 * Calculates countdown and progress to the next 5-minute candle close
 * Currency-strength feeds refresh precisely on 5-minute ticks (:00, :05, :10, :15, ...)
 */
export function getNext5MinuteCandleSeconds(nowDate: Date = new Date()): {
  remainingSeconds: number;
  formatted: string;
  progressPercent: number;
  nextCloseTime: string;
} {
  const minutes = nowDate.getMinutes();
  const seconds = nowDate.getSeconds();
  const currentTotalSeconds = minutes * 60 + seconds;
  const fiveMinSeconds = 5 * 60;
  const elapsedInBar = currentTotalSeconds % fiveMinSeconds;
  const remainingSeconds = fiveMinSeconds - elapsedInBar;
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedInBar / fiveMinSeconds) * 100)));

  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const nextCloseDate = new Date(nowDate.getTime() + remainingSeconds * 1000);
  const nextCloseTime = nextCloseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return { remainingSeconds, formatted, progressPercent, nextCloseTime };
}

// Baseline real-world FX exchange rates against USD
export const DEFAULT_USD_RATES: Record<CurrencyCode, number> = {
  USD: 1.0,
  EUR: 0.9245,
  GBP: 0.7712,
  JPY: 153.24,
  CHF: 0.8842,
  AUD: 1.5420,
  CAD: 1.3855,
  NZD: 1.6845,
};

// 28 major pairs configuration
export const PAIR_DEFINITIONS: Array<{ pair: string; base: CurrencyCode; quote: CurrencyCode; spread: number }> = [
  { pair: 'EUR/USD', base: 'EUR', quote: 'USD', spread: 0.8 },
  { pair: 'GBP/USD', base: 'GBP', quote: 'USD', spread: 1.1 },
  { pair: 'USD/JPY', base: 'USD', quote: 'JPY', spread: 0.9 },
  { pair: 'USD/CHF', base: 'USD', quote: 'CHF', spread: 1.2 },
  { pair: 'AUD/USD', base: 'AUD', quote: 'USD', spread: 1.0 },
  { pair: 'USD/CAD', base: 'USD', quote: 'CAD', spread: 1.3 },
  { pair: 'NZD/USD', base: 'NZD', quote: 'USD', spread: 1.5 },

  { pair: 'EUR/GBP', base: 'EUR', quote: 'GBP', spread: 1.2 },
  { pair: 'EUR/JPY', base: 'EUR', quote: 'JPY', spread: 1.4 },
  { pair: 'EUR/CHF', base: 'EUR', quote: 'CHF', spread: 1.5 },
  { pair: 'EUR/AUD', base: 'EUR', quote: 'AUD', spread: 1.7 },
  { pair: 'EUR/CAD', base: 'EUR', quote: 'CAD', spread: 1.8 },
  { pair: 'EUR/NZD', base: 'EUR', quote: 'NZD', spread: 2.1 },

  { pair: 'GBP/JPY', base: 'GBP', quote: 'JPY', spread: 1.8 },
  { pair: 'GBP/CHF', base: 'GBP', quote: 'CHF', spread: 2.0 },
  { pair: 'GBP/AUD', base: 'GBP', quote: 'AUD', spread: 2.2 },
  { pair: 'GBP/CAD', base: 'GBP', quote: 'CAD', spread: 2.1 },
  { pair: 'GBP/NZD', base: 'GBP', quote: 'NZD', spread: 2.6 },

  { pair: 'AUD/JPY', base: 'AUD', quote: 'JPY', spread: 1.6 },
  { pair: 'AUD/CHF', base: 'AUD', quote: 'CHF', spread: 1.9 },
  { pair: 'AUD/CAD', base: 'AUD', quote: 'CAD', spread: 1.8 },
  { pair: 'AUD/NZD', base: 'AUD', quote: 'NZD', spread: 1.7 },

  { pair: 'NZD/JPY', base: 'NZD', quote: 'JPY', spread: 2.0 },
  { pair: 'NZD/CHF', base: 'NZD', quote: 'CHF', spread: 2.2 },
  { pair: 'NZD/CAD', base: 'NZD', quote: 'CAD', spread: 2.2 },

  { pair: 'CAD/JPY', base: 'CAD', quote: 'JPY', spread: 1.7 },
  { pair: 'CAD/CHF', base: 'CAD', quote: 'CHF', spread: 2.1 },
  { pair: 'CHF/JPY', base: 'CHF', quote: 'JPY', spread: 2.0 },
];

/**
 * Computes standard cross rate from USD rates
 */
export function calculateCrossRate(base: CurrencyCode, quote: CurrencyCode, usdRates: Record<CurrencyCode, number>): number {
  if (base === quote) return 1.0;
  // rate(Base/Quote) = usdRates[Quote] / usdRates[Base]
  const baseVsUsd = usdRates[base];
  const quoteVsUsd = usdRates[quote];
  return quoteVsUsd / baseVsUsd;
}

/**
 * Calculates sentiment category from score (0.0 to 10.0 scale)
 */
export function getSentiment(score: number): CurrencyStrengthScore['sentiment'] {
  if (score >= 7.5) return 'strong_bullish';
  if (score >= 5.8) return 'bullish';
  if (score >= 4.2) return 'neutral';
  if (score >= 2.5) return 'bearish';
  return 'strong_bearish';
}

/**
 * Formats score with 2 decimals
 */
export function formatScore(score: number): string {
  return score.toFixed(2);
}

/**
 * Calculates current market sessions and open status
 */
export function getMarketSessions(nowDate: Date = new Date()): MarketSession[] {
  const currentUtcHour = nowDate.getUTCHours() + nowDate.getUTCMinutes() / 60;

  // Session definition in UTC hours
  // Sydney: 21:00 UTC - 06:00 UTC
  // Tokyo: 00:00 UTC - 09:00 UTC
  // London: 07:00 UTC - 16:00 UTC
  // New York: 12:00 UTC - 21:00 UTC
  const isSydneyOpen = currentUtcHour >= 21 || currentUtcHour < 6;
  const isTokyoOpen = currentUtcHour >= 0 && currentUtcHour < 9;
  const isLondonOpen = currentUtcHour >= 7 && currentUtcHour < 16;
  const isNewYorkOpen = currentUtcHour >= 12 && currentUtcHour < 21;

  // Overlap volatility calculation
  const getVolatility = (name: string, isOpen: boolean): MarketSession['volatility'] => {
    if (!isOpen) return 'Low';
    if (isLondonOpen && isNewYorkOpen) return 'Peak'; // Golden London/NY overlap
    if (name === 'London' || name === 'New York') return 'High';
    if (name === 'Tokyo') return 'Medium';
    return 'Low';
  };

  const getTimeRemaining = (openHour: number, closeHour: number, isOpen: boolean): string => {
    if (isOpen) {
      let hoursLeft = closeHour - currentUtcHour;
      if (hoursLeft < 0) hoursLeft += 24;
      const h = Math.floor(hoursLeft);
      const m = Math.floor((hoursLeft - h) * 60);
      return `Closes in ${h}h ${m}m`;
    } else {
      let hoursUntil = openHour - currentUtcHour;
      if (hoursUntil < 0) hoursUntil += 24;
      const h = Math.floor(hoursUntil);
      const m = Math.floor((hoursUntil - h) * 60);
      return `Opens in ${h}h ${m}m`;
    }
  };

  return [
    {
      name: 'London',
      city: 'London',
      country: 'UK',
      openUtc: 7,
      closeUtc: 16,
      isOpen: isLondonOpen,
      volatility: getVolatility('London', isLondonOpen),
      timeRemaining: getTimeRemaining(7, 16, isLondonOpen),
    },
    {
      name: 'New York',
      city: 'New York',
      country: 'USA',
      openUtc: 12,
      closeUtc: 21,
      isOpen: isNewYorkOpen,
      volatility: getVolatility('New York', isNewYorkOpen),
      timeRemaining: getTimeRemaining(12, 21, isNewYorkOpen),
    },
    {
      name: 'Tokyo',
      city: 'Tokyo',
      country: 'Japan',
      openUtc: 0,
      closeUtc: 9,
      isOpen: isTokyoOpen,
      volatility: getVolatility('Tokyo', isTokyoOpen),
      timeRemaining: getTimeRemaining(0, 9, isTokyoOpen),
    },
    {
      name: 'Sydney',
      city: 'Sydney',
      country: 'Australia',
      openUtc: 21,
      closeUtc: 6,
      isOpen: isSydneyOpen,
      volatility: getVolatility('Sydney', isSydneyOpen),
      timeRemaining: getTimeRemaining(21, 6, isSydneyOpen),
    },
  ];
}

/**
 * Generates synthetic historical time series for a timeframe
 * Creates realistic, smooth, correlated currency momentum trajectories.
 */
export function generateInitialHistory(timeframe: TimeframeKey, count: number = 60): StrengthSnapshot[] {
  const result: StrengthSnapshot[] = [];
  const now = Date.now();

  let intervalMs = 60 * 1000 * 5; // 5M default
  if (timeframe === '5M') intervalMs = 60 * 1000 * 5;
  else if (timeframe === '10M') intervalMs = 60 * 1000 * 10;
  else if (timeframe === '15M') intervalMs = 60 * 1000 * 15;
  else if (timeframe === '1H') intervalMs = 60 * 1000 * 60;
  else if (timeframe === '2H') intervalMs = 60 * 1000 * 120;
  else if (timeframe === '3H') intervalMs = 60 * 1000 * 180;
  else if (timeframe === '4H') intervalMs = 60 * 1000 * 240;
  else if (timeframe === '6H') intervalMs = 60 * 1000 * 360;
  else if (timeframe === '8H') intervalMs = 60 * 1000 * 480;
  else if (timeframe === '1D') intervalMs = 24 * 60 * 1000 * 60;

  // Initial baseline scores calibrated to match live Currency-Strength snapshot
  const baseScores: Record<CurrencyCode, number> = {
    CHF: 8.33,
    JPY: 8.20,
    NZD: 5.84,
    AUD: 5.21,
    GBP: 4.53,
    EUR: 3.69,
    USD: 2.68,
    CAD: 1.47,
  };

  // Trajectory directions and phases
  const phases: Record<CurrencyCode, number> = {
    USD: 0.1,
    EUR: 1.8,
    GBP: 2.5,
    AUD: 3.2,
    CAD: 4.1,
    CHF: 5.0,
    NZD: 5.8,
    JPY: 0.7,
  };

  const frequencies: Record<CurrencyCode, number> = {
    USD: 0.04,
    EUR: 0.05,
    GBP: 0.06,
    AUD: 0.045,
    CAD: 0.055,
    CHF: 0.035,
    NZD: 0.05,
    JPY: 0.04,
  };

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * intervalMs;
    const date = new Date(timestamp);
    const timeString = timeframe === '1D'
      ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const stepIndex = count - 1 - i;
    const scores: Record<CurrencyCode, number> = {} as Record<CurrencyCode, number>;

    CURRENCY_CODES.forEach((code) => {
      const p = phases[code];
      const f = frequencies[code];
      const base = baseScores[code];
      if (i === 0) {
        // Anchor the latest bar exactly to the target calibrated score
        scores[code] = base;
      } else {
        // Earlier history steps have gentle organic wave
        const wave = (Math.sin((count - 1 - i) * f + p) * 0.45);
        const noise = (Math.sin((count - 1 - i) * 11 + p * 5) * 0.12);
        const rawVal = base + wave + noise;
        scores[code] = Math.max(0.6, Math.min(9.8, Number(rawVal.toFixed(2))));
      }
    });

    result.push({
      timestamp,
      timeString,
      scores,
    });
  }

  return result;
}

/**
 * Computes live currency strength rankings from the latest snapshot
 */
export function computeRankings(
  currentSnapshot: StrengthSnapshot,
  previousSnapshot?: StrengthSnapshot
): CurrencyStrengthScore[] {
  const scoresArray = CURRENCY_CODES.map((code) => {
    const score = currentSnapshot.scores[code];
    const prevScore = previousSnapshot ? previousSnapshot.scores[code] : score;
    const delta = Number((score - prevScore).toFixed(2));
    const deltaPct = prevScore > 0 ? Number(((delta / prevScore) * 100).toFixed(2)) : 0;
    const sentiment = getSentiment(score);

    return {
      code,
      score,
      delta,
      deltaPct,
      rank: 1, // calculated next
      sentiment,
      velocity: Number((delta * 1.5).toFixed(2)),
    };
  });

  // Sort descending by score to assign ranks 1 to 8
  scoresArray.sort((a, b) => b.score - a.score);
  scoresArray.forEach((item, index) => {
    item.rank = index + 1;
  });

  return scoresArray;
}

/**
 * Computes 28 pairs divergence opportunities from current currency strength scores
 */
export function computePairOpportunities(
  strengthMap: Record<CurrencyCode, number>,
  usdRates: Record<CurrencyCode, number>
): PairOpportunity[] {
  return PAIR_DEFINITIONS.map(({ pair, base, quote, spread }) => {
    const baseScore = strengthMap[base] ?? 5.0;
    const quoteScore = strengthMap[quote] ?? 5.0;
    const divergence = Number((baseScore - quoteScore).toFixed(2));
    const rate = calculateCrossRate(base, quote, usdRates);

    let signal: PairOpportunity['signal'] = 'NEUTRAL';
    if (divergence >= 3.5) signal = 'STRONG BUY';
    else if (divergence >= 1.5) signal = 'BUY';
    else if (divergence <= -3.5) signal = 'STRONG SELL';
    else if (divergence <= -1.5) signal = 'SELL';

    // 24h simulated change correlated with divergence
    const change24h = Number((divergence * 0.32 + (base === 'USD' ? 0.15 : -0.1)).toFixed(2));

    const momentum: PairOpportunity['momentum'] =
      Math.abs(divergence) > 4.0 ? 'accelerating' : Math.abs(divergence) > 2.0 ? 'steady' : 'slowing';

    return {
      pair,
      base,
      quote,
      baseScore,
      quoteScore,
      divergence,
      signal,
      rate,
      change24h,
      spreadPips: spread,
      momentum,
    };
  }).sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence));
}

/**
 * Computes full multi-timeframe matrix data
 * Extracts genuine historical snapshots from each timeframe so that:
 * - Scalping (5M/15M) shows fast-reaction momentum
 * - Intraday (1H) shows steady session momentum
 * - Swing (4H/1D) shows fundamental swing & macro trend
 */
export function generateMultiTimeframeMatrix(
  source: Record<TimeframeKey, StrengthSnapshot[]> | CurrencyStrengthScore[]
): Record<CurrencyCode, Record<TimeframeKey, { score: number; sentiment: CurrencyStrengthScore['sentiment'] }>> {
  const result: Record<CurrencyCode, Record<TimeframeKey, { score: number; sentiment: CurrencyStrengthScore['sentiment'] }>> = {} as any;
  const timeframes: TimeframeKey[] = ALL_TIMEFRAME_KEYS;

  const isHistoriesMap = !Array.isArray(source);

  CURRENCY_CODES.forEach((code) => {
    result[code] = {} as any;

    if (isHistoriesMap) {
      const histories = source as Record<TimeframeKey, StrengthSnapshot[]>;
      timeframes.forEach((tf) => {
        const list = histories[tf];
        const latestPoint = list && list.length > 0 ? list[list.length - 1] : undefined;
        const score = latestPoint ? (latestPoint.scores[code] ?? 5.0) : 5.0;
        result[code][tf] = {
          score,
          sentiment: getSentiment(score),
        };
      });
    } else {
      const baseRankings = source as CurrencyStrengthScore[];
      const currentScore = baseRankings.find((r) => r.code === code)?.score || 5.0;
      timeframes.forEach((tf) => {
        result[code][tf] = {
          score: currentScore,
          sentiment: getSentiment(currentScore),
        };
      });
    }
  });

  return result;
}

export interface ScalpSignalAlert {
  timeframe: '5M' | '10M' | '15M';
  minutes: number;
  strongest: { code: CurrencyCode; score: number; delta: number };
  weakest: { code: CurrencyCode; score: number; delta: number };
  bestPair: string;
  bias: 'BUY' | 'SELL';
  divergence: number;
  recommendation: string;
}

/**
 * Analyzes momentum over scalp horizons (5M = 1 bar, 10M = 2 bars, 15M = 3 bars)
 * Identifies micro breakout divergence between strongest and weakest currencies
 */
export function evaluateScalpSignal(
  history: StrengthSnapshot[],
  timeframe: '5M' | '10M' | '15M'
): ScalpSignalAlert | null {
  if (!history || history.length < 2) return null;

  const latest = history[history.length - 1];
  const lookbackBars = timeframe === '5M' ? 1 : timeframe === '10M' ? 2 : 3;
  const prevIndex = Math.max(0, history.length - 1 - lookbackBars);
  const previous = history[prevIndex];

  // Calculate delta over this scalp window
  const currencyDeltas = CURRENCY_CODES.map((code) => {
    const cur = latest.scores[code] ?? 5.0;
    const old = previous.scores[code] ?? 5.0;
    const delta = Number((cur - old).toFixed(2));
    return { code, score: cur, delta };
  });

  // Sort by delta (momentum acceleration)
  currencyDeltas.sort((a, b) => b.delta - a.delta);
  const strongest = currencyDeltas[0];
  const weakest = currencyDeltas[currencyDeltas.length - 1];

  // Find if a valid 28-pair exists between strongest and weakest
  let bestPair = `${strongest.code}/${weakest.code}`;
  let bias: 'BUY' | 'SELL' = 'BUY';

  const directPair = PAIR_DEFINITIONS.find((p) => p.base === strongest.code && p.quote === weakest.code);
  const invertedPair = PAIR_DEFINITIONS.find((p) => p.base === weakest.code && p.quote === strongest.code);

  if (directPair) {
    bestPair = directPair.pair;
    bias = 'BUY';
  } else if (invertedPair) {
    bestPair = invertedPair.pair;
    bias = 'SELL';
  }

  const divergence = Number((strongest.score - weakest.score).toFixed(2));
  const minutes = timeframe === '5M' ? 5 : timeframe === '10M' ? 10 : 15;

  const recommendation =
    bias === 'BUY'
      ? `Scalp ${bestPair} LONG (Momentum +${strongest.delta.toFixed(2)} vs ${weakest.delta.toFixed(2)} dlm ${minutes}m)`
      : `Scalp ${bestPair} SHORT (Momentum -${Math.abs(weakest.delta).toFixed(2)} vs +${strongest.delta.toFixed(2)} dlm ${minutes}m)`;

  return {
    timeframe,
    minutes,
    strongest,
    weakest,
    bestPair,
    bias,
    divergence,
    recommendation,
  };
}

/**
 * Plays subtle synthesized Web Audio alert beep
 */
export function playAlertChime(type: 'bullish' | 'bearish' | 'warning' = 'bullish') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'bullish') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    } else if (type === 'bearish') {
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.15); // A4
    } else {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    }

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (err) {
    // Audio might be blocked until user interaction
  }
}

/**
 * ============================================================================
 * ADVANCED HISTORICAL CROSSOVER & EXPANSION / ZERO-CHOP ANALYZER ENGINE
 * ============================================================================
 * Resolves the issue where currencies hover and repeatedly cross around 0.0
 * without genuine divergence (chop noise). Tracks:
 * 1. "Bersilangan dari kapan" (exact timestamp, time label, and elapsed duration/bars)
 * 2. Expansion status (is gap widening, or is it trapped in zero-chop?)
 * 3. Whipsaw / cross frequency in zone 0 to filter out false breakouts
 */

export type CrossExpansionStatus =
  | 'STRONG_EXPANSION' // 🚀 Ekspansi Kuat: gap melebar signifikan, trend divergence solid
  | 'EMERGING_EXPANSION' // 📈 Mulai Melebar: baru cross 1-4 bar lalu, momentum mulai terbentuk
  | 'CHOP_ZERO_NO_EXPANSION' // ⚠️ Chop di Area 0: bolak-balik crossing di level netral tanpa ekspansi
  | 'CONTRACTING'; // 📉 Melemah/Menyempit: sempat ekspansi tapi gap kini menguncup

export interface PairCrossRecord {
  pair: string; // e.g. "GBP/AUD", "AUD/JPY"
  base: CurrencyCode;
  quote: CurrencyCode;
  lastCrossIndex: number;
  lastCrossTime: string;
  lastCrossTimestamp: number;
  barsAgo: number;
  minutesAgo: number;
  timeAgoFormatted: string; // e.g. "45 mnt lalu (9 bar)" or "2 jam 15 mnt lalu"
  crossLevel: number; // strength value at crossing (e.g. +0.1 or -0.3)
  isNearZero: boolean; // occurred within neutral zone [-2.5, +2.5]
  bullish: CurrencyCode; // currency currently on top
  bearish: CurrencyCode; // currency currently below
  currentBaseScore: number;
  currentQuoteScore: number;
  signalBias: 'BUY' | 'SELL'; // BUY if base is bullish, SELL if base is bearish
  currentGap: number; // absolute difference right now
  maxGapSinceCross: number; // maximum divergence achieved since crossing
  whipsawCount: number; // crosses count in recent window (e.g. 20 bars)
  isChopNoExpansion: boolean; // true if hovering in zone 0 with low gap
  status: CrossExpansionStatus;
  statusLabel: string;
  statusBadgeColor: string;
  description: string;
  historyPoints?: { index: number; time: string; diff: number; baseVal: number; quoteVal: number }[];
}

/**
 * Formats elapsed bars into human-readable duration
 */
export function formatTimeAgoFromBars(barsAgo: number, timeframeMinutes: number = 5): string {
  if (barsAgo === 0) return 'Baru saja (candle ini)';
  const totalMinutes = barsAgo * timeframeMinutes;
  if (totalMinutes < 60) {
    return `${totalMinutes} mnt lalu (${barsAgo} bar)`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  if (remainingMins === 0) {
    return `${hours} jam lalu (${barsAgo} bar)`;
  }
  return `${hours} jam ${remainingMins} mnt lalu (${barsAgo} bar)`;
}

/**
 * Analyzes historical crossing & expansion for a specific base/quote currency pair
 */
export function analyzePairCrossHistory(
  baseSeries: { val: number; ts?: number; time?: string }[],
  quoteSeries: { val: number; ts?: number; time?: string }[],
  base: CurrencyCode,
  quote: CurrencyCode,
  timeframeMinutes: number = 5,
  pairName?: string
): PairCrossRecord | null {
  const len = Math.min(baseSeries.length, quoteSeries.length);
  if (len < 3) return null;

  const resolvedPair = pairName || `${base}/${quote}`;

  // 1. Scan from newest to oldest to find the latest crossing point
  let lastCrossIdx = -1;
  let whipsawCount = 0;
  const recentWindow = Math.min(24, len - 1); // check whipsaws in last 24 bars

  for (let i = len - 1; i >= 1; i--) {
    const diffCurr = baseSeries[i].val - quoteSeries[i].val;
    const diffPrev = baseSeries[i - 1].val - quoteSeries[i - 1].val;

    // Detect crossover
    if (diffCurr * diffPrev <= 0 && (diffCurr !== 0 || diffPrev !== 0)) {
      if (lastCrossIdx === -1) {
        lastCrossIdx = i;
      }
      if (len - 1 - i <= recentWindow) {
        whipsawCount++;
      }
    }
  }

  // If no cross in entire available history, fallback to earliest index
  if (lastCrossIdx === -1) {
    lastCrossIdx = 0;
  }

  const barsAgo = len - 1 - lastCrossIdx;
  const minutesAgo = barsAgo * timeframeMinutes;
  const crossPointBase = baseSeries[lastCrossIdx];
  const crossPointQuote = quoteSeries[lastCrossIdx];
  const crossLevel = Number(((crossPointBase.val + crossPointQuote.val) / 2).toFixed(2));
  const isNearZero = Math.abs(crossLevel) <= 2.5;

  const currentBase = baseSeries[len - 1].val;
  const currentQuote = quoteSeries[len - 1].val;
  const currentGap = Number(Math.abs(currentBase - currentQuote).toFixed(2));

  // Determine current dominant / bullish currency
  const bullish: CurrencyCode = currentBase >= currentQuote ? base : quote;
  const bearish: CurrencyCode = currentBase >= currentQuote ? quote : base;
  const signalBias: 'BUY' | 'SELL' = currentBase >= currentQuote ? 'BUY' : 'SELL';

  // Calculate maximum divergence achieved since the cross point
  let maxGapSinceCross = currentGap;
  for (let k = lastCrossIdx; k < len; k++) {
    const g = Math.abs(baseSeries[k].val - quoteSeries[k].val);
    if (g > maxGapSinceCross) {
      maxGapSinceCross = g;
    }
  }
  maxGapSinceCross = Number(maxGapSinceCross.toFixed(2));

  // 2. Classify Expansion vs Zero-Chop Noise
  // User insight: mata uang yang hanya ada di area 0 bolak-balik bersilangan tanpa ekspansi
  const isChopNoExpansion =
    (isNearZero && maxGapSinceCross < 1.6 && currentGap < 1.4) ||
    (whipsawCount >= 3 && currentGap < 1.8) ||
    (barsAgo >= 6 && maxGapSinceCross < 1.2 && isNearZero);

  let status: CrossExpansionStatus;
  let statusLabel: string;
  let statusBadgeColor: string;
  let description: string;

  if (isChopNoExpansion) {
    status = 'CHOP_ZERO_NO_EXPANSION';
    statusLabel = 'Chop Area 0 (Tanpa Ekspansi)';
    statusBadgeColor = 'rose';
    description = `${base} & ${quote} berfluktuasi tipis di sekitar level 0 (${crossLevel}) dan bersilangan ${whipsawCount}x tanpa pelebaran gap (Gap saat ini hanya ${currentGap} poin). Hindari entry, belum ada breakout ekspansi momentum.`;
  } else if (currentGap >= 2.5 || maxGapSinceCross >= 3.0) {
    status = 'STRONG_EXPANSION';
    statusLabel = 'Ekspansi Kuat (Divergensi Valid)';
    statusBadgeColor = 'emerald';
    description = `${bullish} menguat terhadap ${bearish} setelah bersilangan di level ${crossLevel}. Gap melebar konsisten hingga Δ+${currentGap} poin (Peak: Δ+${maxGapSinceCross}). Momentum tren sangat solid.`;
  } else if (barsAgo <= 5 && currentGap >= 1.0) {
    status = 'EMERGING_EXPANSION';
    statusLabel = 'Mulai Berekspansi (Fresh Cross)';
    statusBadgeColor = 'cyan';
    description = `Persilangan baru terjadi ${formatTimeAgoFromBars(barsAgo, timeframeMinutes)}. ${bullish} mulai memimpin dengan gap awal Δ+${currentGap} poin. Potensi awal pergerakan.`;
  } else if (maxGapSinceCross >= 2.0 && currentGap < maxGapSinceCross * 0.55) {
    status = 'CONTRACTING';
    statusLabel = 'Ekspansi Meredup (Menyempit)';
    statusBadgeColor = 'amber';
    description = `Sempat ekspansi hingga Δ+${maxGapSinceCross} poin, kini gap menyusut ke Δ+${currentGap} poin. ${bearish} mulai memotong ketertinggalan dan mendekati persilangan balik.`;
  } else {
    status = 'STRONG_EXPANSION';
    statusLabel = 'Ekspansi Aktif';
    statusBadgeColor = 'blue';
    description = `${bullish} memimpin terhadap ${bearish} dengan disparitas Δ+${currentGap} poin sejak bersilangan di level ${crossLevel}.`;
  }

  const crossTime = crossPointBase.time || (crossPointBase.ts ? new Date(crossPointBase.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '');

  return {
    pair: resolvedPair,
    base,
    quote,
    lastCrossIndex: lastCrossIdx,
    lastCrossTime: crossTime || '00:00',
    lastCrossTimestamp: crossPointBase.ts || 0,
    barsAgo,
    minutesAgo,
    timeAgoFormatted: formatTimeAgoFromBars(barsAgo, timeframeMinutes),
    crossLevel,
    isNearZero,
    bullish,
    bearish,
    currentBaseScore: Number(currentBase.toFixed(2)),
    currentQuoteScore: Number(currentQuote.toFixed(2)),
    signalBias,
    currentGap,
    maxGapSinceCross,
    whipsawCount,
    isChopNoExpansion,
    status,
    statusLabel,
    statusBadgeColor,
    description,
  };
}

/**
 * Scans all 28 standard forex pairs and analyzes crossing & expansion history
 */
export function analyzeAllForexPairsCrossHistory(
  seriesByCurrency: Record<CurrencyCode, { val: number; ts?: number; time?: string }[]>,
  timeframeMinutes: number = 5
): {
  allCrosses: PairCrossRecord[];
  expandingCrosses: PairCrossRecord[];
  chopZeroCrosses: PairCrossRecord[];
} {
  const allCrosses: PairCrossRecord[] = [];

  for (const p of PAIR_DEFINITIONS) {
    const sBase = seriesByCurrency[p.base];
    const sQuote = seriesByCurrency[p.quote];

    if (sBase && sQuote && sBase.length >= 3 && sQuote.length >= 3) {
      const record = analyzePairCrossHistory(
        sBase,
        sQuote,
        p.base,
        p.quote,
        timeframeMinutes,
        p.pair
      );
      if (record) {
        allCrosses.push(record);
      }
    }
  }

  // Sort by expansion strength, then recent crossing
  allCrosses.sort((a, b) => {
    // Put expanding first, then by gap
    if (a.isChopNoExpansion !== b.isChopNoExpansion) {
      return a.isChopNoExpansion ? 1 : -1;
    }
    return b.currentGap - a.currentGap;
  });

  const expandingCrosses = allCrosses.filter((c) => !c.isChopNoExpansion);
  const chopZeroCrosses = allCrosses.filter((c) => c.isChopNoExpansion);

  return {
    allCrosses,
    expandingCrosses,
    chopZeroCrosses,
  };
}

