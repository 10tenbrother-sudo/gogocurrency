/**
 * Types and interfaces for FlowMonitor Currency Strength Dashboard
 */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'AUD' | 'CAD' | 'NZD';

export type TradingCategory = 'scalp' | 'intraday' | 'swing';

export type TimeframeKey =
  | '5M'
  | '10M'
  | '15M'
  | '1H'
  | '2H'
  | '3H'
  | '4H'
  | '6H'
  | '8H'
  | '1D';

export interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  country: string;
  flag: string;
  color: string;
  symbol: string;
  baseWeight: number;
}

export interface CurrencyStrengthScore {
  code: CurrencyCode;
  score: number; // 0.00 to 10.00
  delta: number; // change from previous period
  deltaPct: number; // percentage change
  rank: number; // 1 to 8
  sentiment: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
  velocity: number; // momentum acceleration
}

export interface StrengthSnapshot {
  timestamp: number;
  timeString: string;
  scores: Record<CurrencyCode, number>;
}

export interface PairRate {
  pair: string;
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number;
  change24h: number;
  spreadPips: number;
  high24h: number;
  low24h: number;
}

export interface PairOpportunity {
  pair: string;
  base: CurrencyCode;
  quote: CurrencyCode;
  baseScore: number;
  quoteScore: number;
  divergence: number; // baseScore - quoteScore
  signal: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
  rate: number;
  change24h: number;
  spreadPips: number;
  momentum: 'accelerating' | 'steady' | 'slowing';
}

export interface MarketSession {
  name: string;
  city: string;
  country: string;
  openUtc: number; // hour in UTC 0-23
  closeUtc: number; // hour in UTC 0-23
  isOpen: boolean;
  volatility: 'Low' | 'Medium' | 'High' | 'Peak';
  timeRemaining: string;
}

export interface AlertRule {
  id: string;
  currency: CurrencyCode;
  condition: 'ABOVE' | 'BELOW';
  threshold: number;
  enabled: boolean;
  lastTriggered?: number;
}

export interface AlertEvent {
  id: string;
  timestamp: number;
  currency: CurrencyCode;
  message: string;
  score: number;
  threshold: number;
}
