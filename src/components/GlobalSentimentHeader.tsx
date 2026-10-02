import React, { useState, useRef, useEffect } from 'react';
import { CurrencyStrengthScore, CurrencyCode } from '../types/forex';
import { CURRENCIES, formatScore } from '../services/currencyStrengthEngine';
import {
  ShieldAlert,
  Flame,
  Scale,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronDown,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalSentimentHeaderProps {
  rankings: CurrencyStrengthScore[];
  className?: string;
}

export interface SentimentAnalysis {
  indexScore: number; // 0 to 100
  regime: 'extreme_risk_on' | 'risk_on' | 'neutral' | 'risk_off' | 'extreme_risk_off';
  label: string;
  subLabel: string;
  riskOnAvg: number;
  safeHavenAvg: number;
  spread: number;
  dominantDriver: {
    code: CurrencyCode;
    name: string;
    score: number;
    role: 'risk_leader' | 'safe_haven_anchor';
  };
  tradeImplication: string;
}

export const computeGlobalSentiment = (rankings: CurrencyStrengthScore[]): SentimentAnalysis => {
  if (!rankings || rankings.length === 0) {
    return {
      indexScore: 50,
      regime: 'neutral',
      label: 'NETRAL',
      subLabel: 'Menunggu Likuiditas',
      riskOnAvg: 5.0,
      safeHavenAvg: 5.0,
      spread: 0,
      dominantDriver: {
        code: 'USD',
        name: 'US Dollar',
        score: 5.0,
        role: 'safe_haven_anchor',
      },
      tradeImplication: 'Pasar konsolidasi; fokus pada setup breakout teknikal.',
    };
  }

  const scoreMap = new Map<CurrencyCode, number>();
  rankings.forEach((r) => scoreMap.set(r.code, r.score));

  // High-Beta Commodity / Growth Basket (Risk-Seeking)
  const riskOnCurrencies: CurrencyCode[] = ['AUD', 'NZD', 'CAD'];
  const riskScores = riskOnCurrencies.map((c) => scoreMap.get(c) ?? 5.0);
  const riskOnAvg = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;

  // Safe Haven / Defensive Basket (Risk-Aversion)
  const safeCurrencies: CurrencyCode[] = ['JPY', 'CHF', 'USD'];
  const safeScores = safeCurrencies.map((c) => scoreMap.get(c) ?? 5.0);
  const safeHavenAvg = safeScores.reduce((a, b) => a + b, 0) / safeScores.length;

  // Net Beta Spread (typically between -4.0 and +4.0)
  const spread = riskOnAvg - safeHavenAvg;

  // Normalize into 0 - 100 Sentiment Index
  // 50 = perfectly neutral, >50 = Risk-On, <50 = Risk-Off
  const rawScore = 50 + (spread / 3.5) * 50;
  const indexScore = Math.max(5, Math.min(95, Math.round(rawScore)));

  // Determine Regime
  let regime: SentimentAnalysis['regime'] = 'neutral';
  let label = 'NETRAL';
  let subLabel = 'Aliran Campuran';
  let tradeImplication = 'Rotasi modal selektif antar pasangan silang.';

  if (indexScore >= 70) {
    regime = 'extreme_risk_on';
    label = 'EXTREME RISK-ON';
    subLabel = 'Akumulasi Aset Risiko Tinggi';
    tradeImplication = 'Prioritaskan posisi BUY pada AUD/JPY, NZD/JPY, CAD/CHF.';
  } else if (indexScore >= 56) {
    regime = 'risk_on';
    label = 'RISK-ON';
    subLabel = 'Sentimen Pasar Positif';
    tradeImplication = 'Dukungan kuat pada mata uang komoditas & ekuitas global.';
  } else if (indexScore <= 30) {
    regime = 'extreme_risk_off';
    label = 'EXTREME RISK-OFF';
    subLabel = 'Pelarian ke Safe Haven';
    tradeImplication = 'Hindari beli mata uang berisiko tinggi; JPY & CHF sangat dominan.';
  } else if (indexScore <= 44) {
    regime = 'risk_off';
    label = 'RISK-OFF';
    subLabel = 'Aversi Risiko / Defensif';
    tradeImplication = 'Tekanan jual pada AUD & NZD; Safe haven mendapat aliran modal.';
  } else {
    regime = 'neutral';
    label = 'NETRAL / SEIMBANG';
    subLabel = 'Pasar Berimbang';
    tradeImplication = 'Keseimbangan safe-haven vs komoditas; trading range-bound.';
  }

  // Dominant Driver Identification
  const sorted = [...rankings].sort((a, b) => b.score - a.score);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  let dominantDriver = {
    code: highest.code,
    name: CURRENCIES[highest.code]?.name || highest.code,
    score: highest.score,
    role: riskOnCurrencies.includes(highest.code)
      ? ('risk_leader' as const)
      : ('safe_haven_anchor' as const),
  };

  if (regime.includes('risk_off') && safeCurrencies.includes(highest.code)) {
    dominantDriver = {
      code: highest.code,
      name: CURRENCIES[highest.code]?.name || highest.code,
      score: highest.score,
      role: 'safe_haven_anchor',
    };
  }

  return {
    indexScore,
    regime,
    label,
    subLabel,
    riskOnAvg,
    safeHavenAvg,
    spread,
    dominantDriver,
    tradeImplication,
  };
};

export const GlobalSentimentHeader: React.FC<GlobalSentimentHeaderProps> = ({
  rankings,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const sentiment = computeGlobalSentiment(rankings);

  // Close popover when clicked outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const isRiskOn = sentiment.regime.includes('risk_on');
  const isRiskOff = sentiment.regime.includes('risk_off');

  const themeColors = isRiskOn
    ? {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/25',
        dot: 'bg-emerald-400',
        glow: 'shadow-[0_0_12px_rgba(16,185,129,0.2)]',
        gaugeBar: 'bg-emerald-500',
      }
    : isRiskOff
    ? {
        text: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/25',
        dot: 'bg-rose-400',
        glow: 'shadow-[0_0_12px_rgba(244,63,94,0.2)]',
        gaugeBar: 'bg-rose-500',
      }
    : {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/25',
        dot: 'bg-amber-400',
        glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]',
        gaugeBar: 'bg-amber-500',
      };

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      {/* Quick-Glance Sentiment Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all cursor-pointer select-none hover:bg-white/[0.04] ${themeColors.bg} ${themeColors.border} ${themeColors.glow}`}
        title="Klik untuk membuka Analisis Sentimen Pasar Global (Risk-On / Risk-Off)"
      >
        {/* Dynamic Sentiment Mood Icon */}
        <div className="flex items-center gap-1.5">
          {isRiskOn ? (
            <Flame className={`w-3.5 h-3.5 ${themeColors.text} animate-pulse`} />
          ) : isRiskOff ? (
            <ShieldAlert className={`w-3.5 h-3.5 ${themeColors.text} animate-pulse`} />
          ) : (
            <Scale className={`w-3.5 h-3.5 ${themeColors.text}`} />
          )}

          <div className="flex flex-col text-left leading-none">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-sans font-semibold">
              Global Sentiment
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`font-bold text-[11px] tracking-tight ${themeColors.text}`}>
                {sentiment.label}
              </span>
              <span className="text-zinc-500 text-[10px]">({sentiment.indexScore})</span>
            </div>
          </div>
        </div>

        {/* Mini Meter Needle Preview */}
        <div className="w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden md:block">
          <div
            className={`h-full rounded-full transition-all duration-500 ${themeColors.gaugeBar}`}
            style={{ width: `${sentiment.indexScore}%` }}
          />
        </div>

        <ChevronDown
          className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Expandable Comprehensive Global Sentiment Matrix Sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-[340px] sm:w-[380px] bg-white dark:bg-[#0E1119] border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-2xl p-4 z-50 space-y-4 backdrop-blur-xl text-slate-800 dark:text-zinc-200 transition-colors"
          >
            {/* Header: Title + Close */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/[0.07] pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                  <Compass className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Indeks Sentimen Makro Global</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                  Agregasi 8 Mata Uang Mayor (Risk-On vs Safe Haven)
                </p>
              </div>

              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase ${themeColors.bg} ${themeColors.text} ${themeColors.border}`}
              >
                {sentiment.label}
              </span>
            </div>

            {/* Gauge Dial & Score */}
            <div className="bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-white/[0.06] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                  <span>Skor Sentimen Terkini:</span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${themeColors.text}`}>
                  {sentiment.indexScore} / 100
                </span>
              </div>

              {/* Multi-Spectrum Bar */}
              <div className="relative pt-1 pb-1">
                <div className="w-full h-2.5 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 p-0.5 shadow-inner">
                  {/* Gauge indicator thumb */}
                  <div
                    className="w-3.5 h-3.5 bg-white border-2 border-slate-900 rounded-full shadow-md -translate-y-1 transition-all duration-300"
                    style={{ marginLeft: `calc(${sentiment.indexScore}% - 7px)` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 dark:text-zinc-500 mt-1">
                  <span className="text-rose-500 dark:text-rose-400">0 Safe Haven</span>
                  <span className="text-amber-500 dark:text-amber-400">50 Netral</span>
                  <span className="text-emerald-500 dark:text-emerald-400">100 Risk-On</span>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium pt-1">
                {sentiment.subLabel}
              </p>
            </div>

            {/* Breakdown: High Beta (Risk) vs Safe Haven */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {/* Risk-Seeking Basket */}
              <div className="bg-slate-50 dark:bg-[#121520] border border-emerald-500/20 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-[10px]">
                  <span>KERANJANG RISK-ON</span>
                  <ArrowUpRight className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {sentiment.riskOnAvg.toFixed(2)}{' '}
                  <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-normal">avg</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                  <span>AUD 🇦🇺</span>
                  <span>NZD 🇳🇿</span>
                  <span>CAD 🇨🇦</span>
                </div>
              </div>

              {/* Safe Haven Basket */}
              <div className="bg-slate-50 dark:bg-[#121520] border border-rose-500/20 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-[10px]">
                  <span>KERANJANG SAFE HAVEN</span>
                  <ArrowDownRight className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                </div>
                <div className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {sentiment.safeHavenAvg.toFixed(2)}{' '}
                  <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-normal">avg</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                  <span>JPY 🇯🇵</span>
                  <span>CHF 🇨🇭</span>
                  <span>USD 🇺🇸</span>
                </div>
              </div>
            </div>

            {/* Dominant Driver & Trading Implication */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-white/[0.06] text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400 text-[11px]">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  <span>Penggerak Utama Pasar:</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <span>{CURRENCIES[sentiment.dominantDriver.code]?.flag || '🌐'}</span>
                  <span>{sentiment.dominantDriver.code}</span>
                  <span className="text-emerald-500 dark:text-emerald-400">
                    ({formatScore(sentiment.dominantDriver.score)})
                  </span>
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/[0.06] space-y-1">
                <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  Rekomendasi Bias Transaksi
                </div>
                <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-sans">
                  {sentiment.tradeImplication}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
