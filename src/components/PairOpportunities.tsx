import React, { useState, useMemo } from 'react';
import {
  CurrencyCode,
  PairOpportunity,
} from '../types/forex';
import { CURRENCIES, formatScore } from '../services/currencyStrengthEngine';
import {
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpRight,
  LineChart,
} from 'lucide-react';

interface PairOpportunitiesProps {
  opportunities: PairOpportunity[];
  onSelectPairForChart?: (base: CurrencyCode, quote: CurrencyCode) => void;
  onOpenPairDetails: (pair: PairOpportunity) => void;
  onOpenTradingView?: (pair: PairOpportunity) => void;
  theme?: 'dark' | 'light';
}

export const PairOpportunities: React.FC<PairOpportunitiesProps> = ({
  opportunities,
  onOpenPairDetails,
  onOpenTradingView,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'>('ALL');
  const [sortBy, setSortBy] = useState<'divergence' | 'change' | 'spread'>('divergence');

  // Stats calculation
  const stats = useMemo(() => {
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    opportunities.forEach((o) => {
      if (o.divergence > 1.0) bullishCount++;
      else if (o.divergence < -1.0) bearishCount++;
      else neutralCount++;
    });
    return { bullishCount, bearishCount, neutralCount };
  }, [opportunities]);

  // Filtered & sorted pairs for the scanner table
  const filteredPairs = useMemo(() => {
    return opportunities
      .filter((opp) => {
        const matchesSearch =
          opp.pair.toLowerCase().includes(searchQuery.toLowerCase()) ||
          opp.base.toLowerCase().includes(searchQuery.toLowerCase()) ||
          opp.quote.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesFilter = true;
        if (filterDirection === 'BULLISH') {
          matchesFilter = opp.divergence > 1.0;
        } else if (filterDirection === 'BEARISH') {
          matchesFilter = opp.divergence < -1.0;
        } else if (filterDirection === 'NEUTRAL') {
          matchesFilter = Math.abs(opp.divergence) <= 1.0;
        }

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'divergence') {
          return Math.abs(b.divergence) - Math.abs(a.divergence);
        }
        if (sortBy === 'change') {
          return Math.abs(b.change24h) - Math.abs(a.change24h);
        }
        if (sortBy === 'spread') {
          return a.spreadPips - b.spreadPips;
        }
        return 0;
      });
  }, [opportunities, searchQuery, filterDirection, sortBy]);

  const getDirectionText = (divergence: number) => {
    if (divergence > 2.0) return 'BULLISH (KUAT)';
    if (divergence > 0.8) return 'BULLISH';
    if (divergence < -2.0) return 'BEARISH (KUAT)';
    if (divergence < -0.8) return 'BEARISH';
    return 'NETRAL';
  };

  const getDirectionStyle = (divergence: number) => {
    if (divergence > 2.0) return 'text-emerald-400 font-bold';
    if (divergence > 0.8) return 'text-emerald-400/90 font-medium';
    if (divergence < -2.0) return 'text-rose-400 font-bold';
    if (divergence < -0.8) return 'text-rose-400/90 font-medium';
    return 'text-slate-500 font-normal';
  };

  return (
    <div className="w-full space-y-3">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/[0.08]">
        {/* Left: Summary Quick Stats */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-zinc-400">
          <span className="font-semibold text-slate-900 dark:text-white">{opportunities.length} Pasangan Silang</span>
          <span className="text-slate-300 dark:text-zinc-700" aria-hidden="true">·</span>
          <span className="text-emerald-600 dark:text-emerald-400">{stats.bullishCount} Bias Bullish</span>
          <span className="text-slate-300 dark:text-zinc-700" aria-hidden="true">·</span>
          <span className="text-rose-600 dark:text-rose-400">{stats.bearishCount} Bias Bearish</span>
          <span className="text-slate-300 dark:text-zinc-700" aria-hidden="true">·</span>
          <span className="text-slate-500 dark:text-zinc-500">{stats.neutralCount} Netral</span>
        </div>

        {/* Right: Search, Filter Tabs & Sort */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Cari pair (EUR, JPY)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-white/30 font-mono w-44 shadow-2xs"
            />
          </div>

          {/* Filter Direction Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-medium">
            {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setFilterDirection(dir)}
                className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                  filterDirection === dir
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {dir === 'ALL' ? 'Semua' : dir === 'BULLISH' ? 'Bullish' : dir === 'BEARISH' ? 'Bearish' : 'Netral'}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-zinc-300 font-mono focus:outline-none focus:border-slate-400 dark:focus:border-white/30 cursor-pointer shadow-2xs"
          >
            <option value="divergence">Sort: Disparitas Flow</option>
            <option value="change">Sort: Performa 24h</option>
            <option value="spread">Sort: Spread Terendah</option>
          </select>
        </div>
      </div>

      {/* 28 Cross Pairs Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D1017] shadow-xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-[#11141D] text-slate-600 dark:text-zinc-400 font-mono border-b border-slate-200 dark:border-white/[0.06]">
            <tr>
              <th className="py-2.5 px-3 font-semibold">Pair Cross</th>
              <th className="py-2.5 px-3 font-semibold">Bias Arah Relatif</th>
              <th className="py-2.5 px-3 font-semibold text-right">Divergensi (Δ)</th>
              <th className="py-2.5 px-3 font-semibold text-center">Base vs Quote Skor</th>
              <th className="py-2.5 px-3 font-semibold text-right">Spot Rate</th>
              <th className="py-2.5 px-3 font-semibold text-right">24h Chg</th>
              <th className="py-2.5 px-3 font-semibold text-right">Spread</th>
              <th className="py-2.5 px-3 font-semibold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {filteredPairs.map((opp) => {
              const baseConf = CURRENCIES[opp.base];
              const quoteConf = CURRENCIES[opp.quote];
              const dirText = getDirectionText(opp.divergence);
              const dirStyle = getDirectionStyle(opp.divergence);

              return (
                <tr
                  key={opp.pair}
                  onClick={() => onOpenPairDetails(opp)}
                  className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                >
                  {/* Pair + Flags */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-sm -space-x-1">
                        <span>{baseConf.flag}</span>
                        <span>{quoteConf.flag}</span>
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-slate-950 dark:group-hover:text-white font-sans">
                        {opp.pair}
                      </span>
                    </div>
                  </td>

                  {/* Direction Bias */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className={`text-[11px] font-mono tracking-tight ${dirStyle}`}>
                      {dirText}
                    </span>
                  </td>

                  {/* Divergence */}
                  <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap font-mono tabular-nums">
                    <span
                      className={
                        opp.divergence > 0
                          ? 'text-emerald-400'
                          : opp.divergence < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }
                    >
                      {opp.divergence > 0
                        ? `+${opp.divergence.toFixed(2)}`
                        : opp.divergence.toFixed(2)}
                    </span>
                  </td>

                  {/* Base vs Quote Strength Bar */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-2 min-w-[130px] font-mono">
                      <span
                        style={{ color: baseConf.color }}
                        className="text-[10px] font-bold w-6 text-right tabular-nums"
                      >
                        {formatScore(opp.baseScore)}
                      </span>
                      <div className="w-20 h-1 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden flex border border-slate-300 dark:border-slate-800">
                        <div
                          style={{
                            width: `${(opp.baseScore / (opp.baseScore + opp.quoteScore)) * 100}%`,
                            backgroundColor: baseConf.color,
                          }}
                        />
                        <div
                          style={{
                            width: `${(opp.quoteScore / (opp.baseScore + opp.quoteScore)) * 100}%`,
                            backgroundColor: quoteConf.color,
                          }}
                        />
                      </div>
                      <span
                        style={{ color: quoteConf.color }}
                        className="text-[10px] font-bold w-6 tabular-nums"
                      >
                        {formatScore(opp.quoteScore)}
                      </span>
                    </div>
                  </td>

                  {/* Spot Rate */}
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-200 tabular-nums whitespace-nowrap font-mono">
                    {opp.rate < 10 ? opp.rate.toFixed(4) : opp.rate.toFixed(2)}
                  </td>

                  {/* 24h Change */}
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-mono">
                    <span
                      className={`inline-flex items-center gap-0.5 ${
                        opp.change24h > 0
                          ? 'text-emerald-400'
                          : opp.change24h < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {opp.change24h > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : opp.change24h < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      {opp.change24h > 0 ? `+${opp.change24h}%` : `${opp.change24h}%`}
                    </span>
                  </td>

                  {/* Spread */}
                  <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                    {opp.spreadPips.toFixed(1)} pip
                  </td>

                  {/* Action */}
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenTradingView) {
                            onOpenTradingView(opp);
                          } else {
                            onOpenPairDetails(opp);
                          }
                        }}
                        className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors cursor-pointer inline-flex items-center gap-1 ${
                          isDark
                            ? 'bg-zinc-900 hover:bg-zinc-800 border-white/[0.08] text-zinc-300 hover:text-white'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 shadow-2xs'
                        }`}
                        title="Buka Chart TradingView Langsung"
                      >
                        <LineChart className="w-3 h-3 text-cyan-500" />
                        <span>TV ↗</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPairDetails(opp);
                        }}
                        className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-zinc-900 hover:bg-zinc-800 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700 hover:text-slate-950 shadow-2xs'
                        }`}
                        title="Detail Disparitas"
                      >
                        Detail
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
