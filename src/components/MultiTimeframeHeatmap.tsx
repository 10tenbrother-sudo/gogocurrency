import React, { useState, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  CurrencyCode,
  TimeframeKey,
  CurrencyStrengthScore,
} from '../types/forex';
import {
  CURRENCIES,
  CURRENCY_CODES,
  getCurrencyConfig,
} from '../services/currencyStrengthEngine';

export interface MultiTimeframeHeatmapProps {
  matrixData?: Record<
    CurrencyCode,
    Record<TimeframeKey, { score: number; sentiment: CurrencyStrengthScore['sentiment'] }>
  >;
  selectedCurrencies?: Set<CurrencyCode>;
  onToggleCurrency?: (code: CurrencyCode) => void;
  onSoloCurrency?: (code: CurrencyCode) => void;
  onOpenTradingView?: (pairSymbol: string) => void;
  theme?: 'dark' | 'light';
}

const ALL_TIMEFRAMES: TimeframeKey[] = [
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

interface HorizonGroupDef {
  name: string;
  short: string;
  key: 'scalp' | 'intra' | 'swing';
  ids: number[]; // indices in ALL_TIMEFRAMES
  tfs: TimeframeKey[];
}

const HORIZON_GROUPS: HorizonGroupDef[] = [
  {
    name: 'SCALPING',
    short: 'Scalp',
    key: 'scalp',
    ids: [0, 1, 2],
    tfs: ['5M', '10M', '15M'],
  },
  {
    name: 'INTRADAY',
    short: 'Intraday',
    key: 'intra',
    ids: [3, 4, 5],
    tfs: ['1H', '2H', '3H'],
  },
  {
    name: 'SWING & MAKRO',
    short: 'Swing',
    key: 'swing',
    ids: [6, 7, 8, 9],
    tfs: ['4H', '6H', '8H', '1D'],
  },
];

const REGION_CODES: Record<CurrencyCode, string> = {
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  JPY: 'JP',
  CHF: 'CH',
  AUD: 'AU',
  CAD: 'CA',
  NZD: 'NZ',
};

// Fallback baseline values matching reference snapshot if matrixData is still initializing
const DEFAULT_SCORES: Record<CurrencyCode, number> = {
  CHF: 9.8,
  AUD: 8.64,
  USD: 6.62,
  CAD: 6.4,
  GBP: 2.85,
  EUR: 1.77,
  NZD: 1.65,
  JPY: 1.15,
};

type DirectionKey = 'bull' | 'bear' | 'neutral';
type LevelKey = 'strong' | 'bull' | 'neutral' | 'weak' | 'bear';

const LEVEL_NAMES: Record<LevelKey, string> = {
  strong: 'Kuat bullish',
  bull: 'Bullish moderat',
  neutral: 'Netral',
  weak: 'Lemah / bearish',
  bear: 'Kuat bearish',
};

export const MultiTimeframeHeatmap: React.FC<MultiTimeframeHeatmapProps> = ({
  matrixData,
  selectedCurrencies,
  onToggleCurrency,
  onSoloCurrency,
  onOpenTradingView,
  theme = 'light',
}) => {
  const isLight = theme === 'light';

  // 1. State Filter & Selection
  const [horizonKey, setHorizonKey] = useState<'all' | 'scalp' | 'intra' | 'swing'>('all');
  const [filterDirection, setFilterDirection] = useState<'all' | 'bull' | 'bear' | 'neutral'>('all');
  const [sortKey, setSortKey] = useState<'original' | 'strong' | 'weak' | 'name'>('original');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('CHF');
  const [selectedTfIndex, setSelectedTfIndex] = useState<number>(3); // default 1H (index 3)
  const [isSoloActive, setIsSoloActive] = useState<boolean>(false);

  // 2. Active Timeframe indices based on Horizon
  const activeTfIndices = useMemo(() => {
    if (horizonKey === 'all') return ALL_TIMEFRAMES.map((_, i) => i);
    const grp = HORIZON_GROUPS.find((g) => g.key === horizonKey);
    return grp ? grp.ids : ALL_TIMEFRAMES.map((_, i) => i);
  }, [horizonKey]);

  // Format number with Indonesian comma
  const fmt = (v: number) => v.toFixed(2).replace('.', ',');

  // Level thresholds (0–10 scale)
  const getLevel = (v: number): LevelKey => {
    if (v >= 7.5) return 'strong';
    if (v >= 5.8) return 'bull';
    if (v >= 4.2) return 'neutral';
    if (v >= 2.5) return 'weak';
    return 'bear';
  };

  const getDir = (v: number): DirectionKey => {
    if (v >= 5.8) return 'bull';
    if (v < 4.2) return 'bear';
    return 'neutral';
  };

  // Build rows data from matrixData or default fallback
  const currencyRows = useMemo(() => {
    return CURRENCY_CODES.map((code) => {
      const conf = getCurrencyConfig(code) || CURRENCIES[code];
      const region = REGION_CODES[code] || code.slice(0, 2);

      // Extract scores across all 10 TFs
      const values = ALL_TIMEFRAMES.map((tf, i) => {
        if (matrixData && matrixData[code] && matrixData[code][tf]) {
          return matrixData[code][tf].score;
        }
        // Fallback with slight organic nuance (e.g. CHF 4H 9.70)
        const base = DEFAULT_SCORES[code] ?? 5.0;
        if (code === 'CHF' && tf === '4H') return 9.7;
        return base;
      });

      return {
        code,
        name: conf?.name || code,
        region,
        values,
      };
    });
  }, [matrixData]);

  // Compute alignment for a row across active indices
  const getAlignment = (row: (typeof currencyRows)[0]) => {
    const counts: Record<DirectionKey, number> = { bull: 0, bear: 0, neutral: 0 };
    activeTfIndices.forEach((idx) => {
      counts[getDir(row.values[idx])]++;
    });

    const win = (Object.keys(counts) as DirectionKey[]).sort(
      (a, b) => counts[b] - counts[a]
    )[0];

    const count = counts[win];
    const total = activeTfIndices.length;

    let label = 'Campuran';
    if (count === total) {
      label = win === 'bull' ? 'Bullish penuh' : win === 'bear' ? 'Bearish penuh' : 'Netral penuh';
    }

    return {
      win,
      count,
      total,
      counts,
      label,
    };
  };

  // Compute average score for a row across given indices
  const getAvg = (row: (typeof currencyRows)[0], indices = activeTfIndices) => {
    if (indices.length === 0) return 5;
    const sum = indices.reduce((acc, i) => acc + row.values[i], 0);
    return sum / indices.length;
  };

  // 3. Top Overview Stats
  const { strongest, weakest, bullCount, bearCount } = useMemo(() => {
    const sorted = [...currencyRows].sort((a, b) => getAvg(b) - getAvg(a));
    const strongRow = sorted[0];
    const weakRow = sorted[sorted.length - 1];

    let fullBull = 0;
    let fullBear = 0;
    currencyRows.forEach((r) => {
      const a = getAlignment(r);
      if (a.counts.bull === activeTfIndices.length) fullBull++;
      if (a.counts.bear === activeTfIndices.length) fullBear++;
    });

    return {
      strongest: { code: strongRow.code, avg: getAvg(strongRow) },
      weakest: { code: weakRow.code, avg: getAvg(weakRow) },
      bullCount: fullBull,
      bearCount: fullBear,
    };
  }, [currencyRows, activeTfIndices]);

  // 4. Filter and Sort Rows
  const filteredRows = useMemo(() => {
    let list = currencyRows.filter((r) => {
      const matchQuery = (r.code + ' ' + r.name).toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchQuery) return false;
      if (isSoloActive && r.code !== selectedCurrency) return false;
      if (filterDirection !== 'all') {
        const a = getAlignment(r);
        if (a.counts[filterDirection] <= activeTfIndices.length / 2) return false;
      }
      return true;
    });

    if (sortKey === 'strong') {
      list.sort((a, b) => getAvg(b) - getAvg(a));
    } else if (sortKey === 'weak') {
      list.sort((a, b) => getAvg(a) - getAvg(b));
    } else if (sortKey === 'name') {
      list.sort((a, b) => a.code.localeCompare(b.code));
    }

    return list;
  }, [currencyRows, searchQuery, isSoloActive, selectedCurrency, filterDirection, sortKey, activeTfIndices]);

  // 5. Selected Row and Cell
  const activeSelectedRow = useMemo(() => {
    return currencyRows.find((r) => r.code === selectedCurrency) || currencyRows[0];
  }, [currencyRows, selectedCurrency]);

  const activeSelectedVal = activeSelectedRow.values[selectedTfIndex] ?? 5.0;
  const activeSelectedLevel = getLevel(activeSelectedVal);
  const activeSelectedAlignment = getAlignment(activeSelectedRow);

  // Reset filters
  const handleResetFilters = () => {
    setHorizonKey('all');
    setFilterDirection('all');
    setSortKey('original');
    setSearchQuery('');
    setIsSoloActive(false);
  };

  // Toggle Solo mode
  const handleToggleSolo = () => {
    const next = !isSoloActive;
    setIsSoloActive(next);
    if (onSoloCurrency) onSoloCurrency(selectedCurrency);
  };

  // Active Horizon Groups present in the table
  const activeGroupsInView = useMemo(() => {
    return HORIZON_GROUPS.filter((g) => g.ids.some((i) => activeTfIndices.includes(i)));
  }, [activeTfIndices]);

  // Style helper classes matching design tokens
  const T = useMemo(
    () => ({
      panelBg: isLight ? 'bg-white' : 'bg-[#172434]',
      border: isLight ? 'border-[#e1e8f0]' : 'border-[#2a3b50]',
      textInk: isLight ? 'text-[#192c45]' : 'text-[#e6edf7]',
      textMute: isLight ? 'text-[#6e7e94]' : 'text-[#98a9c0]',
      softBg: isLight ? 'bg-[#edf2fa]' : 'bg-[#25364b]',
      blue: isLight ? '#345fdc' : '#8aa9ff',
      strongText: isLight ? 'text-[#08785d]' : 'text-[#79d8b7]',
      strongBg: isLight ? 'bg-[#d9f3e8]' : 'bg-[#1e443a]',
      bullText: isLight ? 'text-[#337966]' : 'text-[#a0cfbf]',
      bullBg: isLight ? 'bg-[#ecf7f1]' : 'bg-[#253d35]',
      neutralText: isLight ? 'text-[#6b7789]' : 'text-[#b0bdd0]',
      neutralBg: isLight ? 'bg-[#eef1f5]' : 'bg-[#29374a]',
      weakText: isLight ? 'text-[#b96a55]' : 'text-[#e0b1a1]',
      weakBg: isLight ? 'bg-[#fff0e9]' : 'bg-[#403129]',
      bearText: isLight ? 'text-[#b44464]' : 'text-[#efa8bc]',
      bearBg: isLight ? 'bg-[#fce4ed]' : 'bg-[#432b39]',
    }),
    [isLight]
  );

  const getCellClasses = (val: number, isSelected: boolean) => {
    const lvl = getLevel(val);
    let colorCls = '';
    if (lvl === 'strong') colorCls = `${T.strongBg} ${T.strongText}`;
    else if (lvl === 'bull') colorCls = `${T.bullBg} ${T.bullText}`;
    else if (lvl === 'neutral') colorCls = `${T.neutralBg} ${T.neutralText}`;
    else if (lvl === 'weak') colorCls = `${T.weakBg} ${T.weakText}`;
    else colorCls = `${T.bearBg} ${T.bearText}`;

    const outlineCls = isSelected
      ? 'outline-2 outline-[#345fdc] dark:outline-[#8aa9ff] outline-offset-2 font-bold ring-2 ring-[#345fdc]/20'
      : '';

    return `w-full max-w-[68px] mx-auto block py-2.5 px-1 rounded-md text-xs sm:text-sm font-mono font-bold text-center transition-all cursor-pointer hover:brightness-95 ${colorCls} ${outlineCls}`;
  };

  const getConfluenceColor = (dir: DirectionKey) => {
    if (dir === 'bull') return T.strongText;
    if (dir === 'bear') return T.bearText;
    return T.neutralText;
  };

  return (
    <div className={`space-y-6 font-sans antialiased transition-colors ${T.textInk}`}>
      {/* ── 1. INTRO / PAGE HEADER ── */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-[1.5px] uppercase text-[#345fdc] dark:text-[#8aa9ff] mb-1">
            CURRENCY INTELLIGENCE / CONFLUENCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight m-0">
            Satu matriks. Sepuluh perspektif.
          </h1>
          <p className={`text-xs sm:text-sm mt-1 m-0 ${T.textMute}`}>
            Bandingkan kekuatan mata uang dari scalping hingga horizon harian.
          </p>
        </div>

        <div className={`text-left sm:text-right text-xs ${T.textMute}`}>
          <span className="block leading-relaxed">
            Klik nilai untuk melihat detail.
            <br />
            Klik mata uang untuk memilih; klik dua kali untuk solo.
          </span>
        </div>
      </section>

      {/* ── 2. OVERVIEW STAT CARDS (4 STATS GRID) ── */}
      <section className={`grid grid-cols-2 lg:grid-cols-4 rounded-xl border divide-y sm:divide-y-0 sm:divide-x overflow-hidden shadow-xs ${T.panelBg} ${T.border}`}>
        {/* Stat 1: Strongest */}
        <div className="p-4 sm:p-5">
          <label className={`text-xs block ${T.textMute}`}>Mata uang terkuat</label>
          <div className={`flex items-baseline gap-2 my-1 text-2xl sm:text-3xl font-bold font-mono ${T.strongText}`}>
            <span>{strongest.code}</span>
            <small className={`text-xs font-normal ${T.textMute}`}>
              {fmt(strongest.avg)} / 10
            </small>
          </div>
          <p className={`text-xs m-0 ${T.textMute}`}>
            Rata-rata {activeTfIndices.length} timeframe aktif
          </p>
        </div>

        {/* Stat 2: Weakest */}
        <div className="p-4 sm:p-5">
          <label className={`text-xs block ${T.textMute}`}>Mata uang terlemah</label>
          <div className={`flex items-baseline gap-2 my-1 text-2xl sm:text-3xl font-bold font-mono ${T.bearText}`}>
            <span>{weakest.code}</span>
            <small className={`text-xs font-normal ${T.textMute}`}>
              {fmt(weakest.avg)} / 10
            </small>
          </div>
          <p className={`text-xs m-0 ${T.textMute}`}>
            Rata-rata {activeTfIndices.length} timeframe aktif
          </p>
        </div>

        {/* Stat 3: Bullish Alignment */}
        <div className="p-4 sm:p-5">
          <label className={`text-xs block ${T.textMute}`}>Selaras bullish</label>
          <div className="flex items-baseline gap-2 my-1 text-2xl sm:text-3xl font-bold font-mono">
            <span>{bullCount}</span>
            <small className={`text-xs font-normal ${T.textMute}`}>/ 8 mata uang</small>
          </div>
          <p className={`text-xs m-0 ${T.textMute}`}>Seluruh timeframe aktif &ge; 5,8</p>
        </div>

        {/* Stat 4: Bearish Alignment */}
        <div className="p-4 sm:p-5">
          <label className={`text-xs block ${T.textMute}`}>Selaras bearish</label>
          <div className="flex items-baseline gap-2 my-1 text-2xl sm:text-3xl font-bold font-mono">
            <span>{bearCount}</span>
            <small className={`text-xs font-normal ${T.textMute}`}>/ 8 mata uang</small>
          </div>
          <p className={`text-xs m-0 ${T.textMute}`}>Seluruh timeframe aktif &lt; 4,2</p>
        </div>
      </section>

      {/* ── 3. MAIN MATRIX PANEL ── */}
      <section className={`rounded-xl border overflow-hidden shadow-xs ${T.panelBg} ${T.border}`}>
        {/* Panel Head */}
        <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b ${T.border}`}>
          <div className="flex items-baseline gap-2">
            <h2 className="text-base sm:text-lg font-bold m-0 tracking-tight">Strength matrix</h2>
            <small className={`text-xs ${T.textMute}`}>
              {filteredRows.length} mata uang / {activeTfIndices.length} timeframe
            </small>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Box */}
            <input
              type="search"
              placeholder="Cari mata uang…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs focus:outline-hidden ${
                isLight ? 'bg-white' : 'bg-[#101925]'
              } ${T.border} ${T.textInk}`}
            />

            {/* Sort Dropdown */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className={`px-3 py-1.5 rounded-lg border text-xs focus:outline-hidden cursor-pointer ${
                isLight ? 'bg-white' : 'bg-[#101925]'
              } ${T.border} ${T.textInk}`}
            >
              <option value="original">Urutan referensi</option>
              <option value="strong">Terkuat dahulu</option>
              <option value="weak">Terlemah dahulu</option>
              <option value="name">Nama A–Z</option>
            </select>
          </div>
        </div>

        {/* Toolbar: Horizon Segmented Control + Direction Filters */}
        <div className={`px-4 sm:px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${T.border}`}>
          {/* Horizon Segmented Control */}
          <div className={`p-1 rounded-lg border flex items-center gap-1 text-xs ${T.softBg} ${T.border}`}>
            <button
              onClick={() => {
                setHorizonKey('all');
                if (!ALL_TIMEFRAMES.map((_, i) => i).includes(selectedTfIndex)) {
                  setSelectedTfIndex(0);
                }
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                horizonKey === 'all'
                  ? 'bg-white dark:bg-[#172434] text-[#345fdc] dark:text-[#8aa9ff] shadow-xs'
                  : T.textMute
              }`}
            >
              Semua · 10 TF
            </button>
            <button
              onClick={() => {
                setHorizonKey('scalp');
                setSelectedTfIndex(0); // 5M
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                horizonKey === 'scalp'
                  ? 'bg-white dark:bg-[#172434] text-[#345fdc] dark:text-[#8aa9ff] shadow-xs'
                  : T.textMute
              }`}
            >
              Scalping
            </button>
            <button
              onClick={() => {
                setHorizonKey('intra');
                setSelectedTfIndex(3); // 1H
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                horizonKey === 'intra'
                  ? 'bg-white dark:bg-[#172434] text-[#345fdc] dark:text-[#8aa9ff] shadow-xs'
                  : T.textMute
              }`}
            >
              Intraday
            </button>
            <button
              onClick={() => {
                setHorizonKey('swing');
                setSelectedTfIndex(6); // 4H
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                horizonKey === 'swing'
                  ? 'bg-white dark:bg-[#172434] text-[#345fdc] dark:text-[#8aa9ff] shadow-xs'
                  : T.textMute
              }`}
            >
              Swing & makro
            </button>
          </div>

          {/* Direction Filter Buttons */}
          <div className="flex items-center gap-3 text-xs">
            {(
              [
                { key: 'all', label: 'Semua arah' },
                { key: 'bull', label: 'Bullish' },
                { key: 'bear', label: 'Bearish' },
                { key: 'neutral', label: 'Netral' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => setFilterDirection(item.key)}
                className={`py-1 cursor-pointer transition-colors ${
                  filterDirection === item.key
                    ? 'text-[#345fdc] dark:text-[#8aa9ff] font-bold border-b-2 border-[#345fdc] dark:border-[#8aa9ff]'
                    : `${T.textMute} hover:text-[#192c45] dark:hover:text-white`
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scope Info Bar */}
        <div className={`px-4 sm:px-5 py-2.5 bg-[#f3f6fa] dark:bg-[#101925] border-b text-xs flex items-center justify-between ${T.border} ${T.textMute}`}>
          <span>
            {horizonKey === 'all'
              ? 'Seluruh horizon'
              : HORIZON_GROUPS.find((g) => g.key === horizonKey)?.name}
            {' · '}Keselarasan dihitung dari {activeTfIndices.length} TF aktif
            {isSoloActive ? ` · Solo ${selectedCurrency}` : ''}
          </span>
          <button
            onClick={handleResetFilters}
            className="text-[#345fdc] dark:text-[#8aa9ff] font-semibold cursor-pointer hover:underline"
          >
            Reset filter
          </button>
        </div>

        {/* Heatmap Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs min-w-[940px]">
            <thead>
              {/* Group Colspan Headers */}
              <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${T.border}`}>
                <th
                  rowSpan={2}
                  className={`text-left p-3 pl-5 font-bold sticky left-0 z-10 ${T.panelBg} w-[180px] border-r ${T.border}`}
                >
                  MATA UANG
                </th>

                {activeGroupsInView.map((g) => {
                  const grpActiveTfs = g.ids.filter((i) => activeTfIndices.includes(i));
                  if (grpActiveTfs.length === 0) return null;

                  const grpColor =
                    g.key === 'scalp'
                      ? isLight
                        ? 'bg-[#fdf6e9] text-[#ac7a22]'
                        : 'bg-[#382f20] text-[#d4b479]'
                      : g.key === 'intra'
                      ? isLight
                        ? 'bg-[#edf3ff] text-[#4374b7]'
                        : 'bg-[#24334c] text-[#9bb7e5]'
                      : isLight
                      ? 'bg-[#edf7f2] text-[#2b8975]'
                      : 'bg-[#213c35] text-[#8cc9b5]';

                  return (
                    <th
                      key={g.key}
                      colSpan={grpActiveTfs.length}
                      className={`py-2 px-1 text-center font-bold tracking-widest ${grpColor} border-r ${T.border}`}
                    >
                      {g.name}
                    </th>
                  );
                })}

                <th
                  rowSpan={2}
                  className={`text-left p-3 pl-4 font-bold ${T.panelBg} w-[200px] border-l ${T.border}`}
                >
                  KESELARASAN
                </th>
              </tr>

              {/* Individual Timeframe Header Row */}
              <tr className={`border-b text-[11px] font-mono font-bold ${T.border} ${T.textMute}`}>
                {activeTfIndices.map((idx) => {
                  const isEndGroup = [2, 5, 9].includes(idx);
                  return (
                    <th
                      key={idx}
                      className={`py-2 px-1 text-center ${isEndGroup ? `border-r ${T.border}` : ''}`}
                    >
                      {ALL_TIMEFRAMES[idx]}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={activeTfIndices.length + 2} className={`py-12 text-center text-xs ${T.textMute}`}>
                    Tidak ada mata uang yang cocok dengan kriteria filter. Silakan klik Reset filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isRowSelected = selectedCurrency === row.code;
                  const alignMeta = getAlignment(row);

                  return (
                    <tr
                      key={row.code}
                      className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 ${
                        isRowSelected ? (isLight ? 'bg-slate-50/90' : 'bg-[#192737]') : ''
                      }`}
                    >
                      {/* 1. Currency Code & Name Cell */}
                      <td
                        className={`p-2.5 pl-5 text-left sticky left-0 z-10 transition-colors border-r ${T.border} ${
                          isRowSelected
                            ? isLight
                              ? 'bg-slate-50'
                              : 'bg-[#192737]'
                            : T.panelBg
                        }`}
                      >
                        <button
                          onClick={() => setSelectedCurrency(row.code)}
                          onDoubleClick={() => {
                            setSelectedCurrency(row.code);
                            handleToggleSolo();
                          }}
                          className="flex items-center gap-2.5 text-left w-full cursor-pointer"
                          title="Klik untuk memilih; klik dua kali untuk solo"
                        >
                          <span className={`w-7 h-7 rounded-full border grid place-items-center text-[10px] font-mono font-bold shrink-0 ${T.softBg} ${T.border} ${T.textMute}`}>
                            {row.region}
                          </span>
                          <div>
                            <strong
                              className={`text-sm font-mono font-bold block ${
                                isRowSelected ? 'text-[#345fdc] dark:text-[#8aa9ff]' : T.textInk
                              }`}
                            >
                              {row.code}
                            </strong>
                            <small className={`text-[10px] block truncate max-w-[100px] ${T.textMute}`}>
                              {row.name}
                            </small>
                          </div>
                        </button>
                      </td>

                      {/* 2. Timeframe Score Cells */}
                      {activeTfIndices.map((idx) => {
                        const val = row.values[idx];
                        const isCellSelected = isRowSelected && selectedTfIndex === idx;
                        const isEndGroup = [2, 5, 9].includes(idx);

                        return (
                          <td
                            key={idx}
                            className={`p-1.5 ${isEndGroup ? `border-r ${T.border}` : ''}`}
                          >
                            <button
                              onClick={() => {
                                setSelectedCurrency(row.code);
                                setSelectedTfIndex(idx);
                              }}
                              className={getCellClasses(val, isCellSelected)}
                              title={`${row.code} ${ALL_TIMEFRAMES[idx]}: skor ${fmt(val)} (${LEVEL_NAMES[getLevel(val)]})`}
                            >
                              {fmt(val)}
                            </button>
                          </td>
                        );
                      })}

                      {/* 3. Confluence / Alignment Cell */}
                      <td className={`p-3 pl-4 text-left border-l ${T.border}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold font-mono inline-flex items-center gap-1 ${getConfluenceColor(
                              alignMeta.win
                            )}`}
                          >
                            <span>{alignMeta.win === 'bull' ? '↗' : alignMeta.win === 'bear' ? '↘' : '−'}</span>
                            <span>{alignMeta.label}</span>
                          </span>
                          <span className={`text-[11px] font-mono font-bold ${T.textMute}`}>
                            {alignMeta.count}/{alignMeta.total}
                          </span>
                        </div>

                        {/* Visual Units Bar */}
                        <div className="flex items-center gap-0.5 mt-1.5">
                          {activeTfIndices.map((idx) => {
                            const d = getDir(row.values[idx]);
                            const bg =
                              d === 'bull'
                                ? isLight
                                ? 'bg-[#08785d]'
                                : 'bg-[#79d8b7]'
                                : d === 'bear'
                                ? isLight
                                ? 'bg-[#b44464]'
                                : 'bg-[#efa8bc]'
                                : isLight
                                ? 'bg-[#cbd5e1]'
                                : 'bg-[#475569]';
                            return (
                              <i
                                key={idx}
                                className={`h-1.5 flex-1 rounded-xs inline-block ${bg}`}
                                title={`${ALL_TIMEFRAMES[idx]}: ${d}`}
                              />
                            );
                          })}
                        </div>

                        <small className={`text-[10px] block mt-1 ${T.textMute}`}>
                          {alignMeta.count === alignMeta.total
                            ? 'Seluruh timeframe searah'
                            : 'Arah timeframe berbeda'}
                        </small>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend Bar */}
        <div className={`p-4 sm:p-5 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${T.border} ${T.textMute}`}>
          <div className="flex items-center gap-4 flex-wrap text-[11px]">
            <span className="flex items-center gap-1.5">
              <i className={`w-2.5 h-2.5 rounded-xs inline-block ${T.strongBg}`} />
              <span>&ge;7,5 Kuat bullish</span>
            </span>
            <span className="flex items-center gap-1.5">
              <i className={`w-2.5 h-2.5 rounded-xs inline-block ${T.bullBg}`} />
              <span>5,8–&lt;7,5 Bullish</span>
            </span>
            <span className="flex items-center gap-1.5">
              <i className={`w-2.5 h-2.5 rounded-xs inline-block ${T.neutralBg}`} />
              <span>4,2–&lt;5,8 Netral</span>
            </span>
            <span className="flex items-center gap-1.5">
              <i className={`w-2.5 h-2.5 rounded-xs inline-block ${T.weakBg}`} />
              <span>2,5–&lt;4,2 Lemah</span>
            </span>
            <span className="flex items-center gap-1.5">
              <i className={`w-2.5 h-2.5 rounded-xs inline-block ${T.bearBg}`} />
              <span>&lt;2,5 Kuat bearish</span>
            </span>
          </div>

          <span className="font-mono text-[11px]">
            Skala 0–10 · geser tabel horizontal pada layar kecil
          </span>
        </div>
      </section>

      {/* ── 4. DETAILS INSPECTOR CARD (DETAIL PILIHAN) ── */}
      <section className={`rounded-xl border p-5 sm:p-6 grid grid-cols-1 md:grid-cols-[1.1fr_1.2fr_0.85fr] gap-6 shadow-xs ${T.panelBg} ${T.border}`}>
        {/* Col 1: Selected Cell Stat */}
        <div className="space-y-1">
          <div className="text-[10px] tracking-wider font-extrabold uppercase text-[#345fdc] dark:text-[#8aa9ff]">
            DETAIL PILIHAN / {ALL_TIMEFRAMES[selectedTfIndex]}
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight m-0 font-mono flex items-baseline gap-2">
            <span>{activeSelectedRow.code}</span>
            <span className={`text-xs font-normal font-sans ${T.textMute}`}>
              {activeSelectedRow.name}
            </span>
          </h3>

          <div
            className={`text-4xl font-extrabold font-mono tracking-tight my-2 tabular-nums ${
              activeSelectedLevel === 'strong'
                ? T.strongText
                : activeSelectedLevel === 'bull'
                ? T.bullText
                : activeSelectedLevel === 'neutral'
                ? T.neutralText
                : activeSelectedLevel === 'weak'
                ? T.weakText
                : T.bearText
            }`}
          >
            {fmt(activeSelectedVal)}{' '}
            <span className={`text-sm font-normal ${T.textMute}`}>/ 10</span>
          </div>

          <p className={`text-xs leading-relaxed m-0 ${T.textMute}`}>
            {LEVEL_NAMES[activeSelectedLevel]} pada timeframe {ALL_TIMEFRAMES[selectedTfIndex]}.
            <br />
            Data terkalibrasi multi-timeframe Currency-Strength.
          </p>
        </div>

        {/* Col 2: Horizon Averages Tracks */}
        <div className={`md:border-x md:px-6 space-y-3 ${T.border}`}>
          <h4 className="text-xs font-bold uppercase tracking-wider m-0">Rata-rata tiap horizon</h4>

          <div className="space-y-2.5">
            {HORIZON_GROUPS.map((g) => {
              const horizonAvg = getAvg(activeSelectedRow, g.ids);
              const widthPct = Math.min(100, Math.max(0, horizonAvg * 10));
              const lvl = getLevel(horizonAvg);

              const barColor =
                lvl === 'strong'
                  ? isLight
                    ? '#08785d'
                    : '#79d8b7'
                  : lvl === 'bull'
                  ? isLight
                    ? '#337966'
                    : '#a0cfbf'
                  : lvl === 'neutral'
                  ? isLight
                    ? '#6b7789'
                    : '#b0bdd0'
                  : lvl === 'weak'
                  ? isLight
                    ? '#b96a55'
                    : '#e0b1a1'
                  : isLight
                  ? '#b44464'
                  : '#efa8bc';

              return (
                <div key={g.key} className="grid grid-cols-[55px_1fr_40px] items-center gap-2 text-xs">
                  <span className={`text-xs ${T.textMute}`}>{g.short}</span>
                  <div className={`h-1.5 rounded-full overflow-hidden ${T.softBg}`}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <b className={`font-mono text-xs tabular-nums text-right font-bold ${T.textInk}`}>
                    {fmt(horizonAvg)}
                  </b>
                </div>
              );
            })}
          </div>

          <p className={`text-[11px] m-0 ${T.textMute}`}>
            Rata-rata aritmetika skor sel pada tiap grup horizon.
          </p>
        </div>

        {/* Col 3: Confluence & Solo Action */}
        <div className="flex flex-col justify-between items-start gap-4">
          <div>
            <div className="text-[10px] tracking-wider font-extrabold uppercase text-[#345fdc] dark:text-[#8aa9ff]">
              KESELARASAN AKTIF
            </div>
            <h3 className="text-base font-bold m-0 mt-1 font-mono">
              {activeSelectedAlignment.label} · {activeSelectedAlignment.count}/{activeSelectedAlignment.total}
            </h3>
            <p className={`text-xs mt-1.5 leading-relaxed ${T.textMute}`}>
              Skor antar-timeframe mencerminkan konsistensi aliran modal dan kekuatan relatif mata uang.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleSolo}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all shadow-xs ${
                isSoloActive
                  ? 'bg-[#345fdc] text-white border-[#345fdc]'
                  : `${T.panelBg} ${T.border} text-[#345fdc] dark:text-[#8aa9ff] hover:border-[#345fdc]`
              }`}
            >
              {isSoloActive ? 'Tampilkan semua mata uang' : `Solo ${activeSelectedRow.code}`}
            </button>
            {onOpenTradingView && (
              <button
                type="button"
                onClick={() => {
                  const targetPair = activeSelectedRow.code === 'CHF' ? 'CAD/CHF' : activeSelectedRow.code === 'CAD' ? 'CAD/CHF' : `${activeSelectedRow.code}/USD`;
                  onOpenTradingView(targetPair);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all shadow-xs inline-flex items-center gap-1.5 ${
                  isLight
                    ? 'bg-[#137854] text-white hover:bg-[#0f6345] border-[#137854]'
                    : 'bg-[#82e6be] text-[#0c1015] hover:bg-[#6edaa6] border-[#82e6be]'
                }`}
                title={`Buka TradingView pair terkuat ${activeSelectedRow.code}`}
              >
                <span>Chart TV</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── 5. COLLAPSIBLE METHOD & GUIDELINES ── */}
      <details className={`rounded-xl border p-4 text-xs space-y-2 cursor-pointer shadow-xs ${T.panelBg} ${T.border} ${T.textMute}`}>
        <summary className={`font-semibold ${T.textInk} select-none`}>
          Cara membaca keselarasan & sumber data
        </summary>
        <div className="pt-2 space-y-2 leading-relaxed">
          <p className="m-0">
            <strong className={T.textInk}>Perhitungan Keselarasan:</strong> Dihitung pada timeframe
            yang sedang ditampilkan: bullish jika skor &ge; 5,8; bearish jika skor &lt; 4,2;
            selainnya netral. Label “Bullish penuh” atau “Bearish penuh” berarti seluruh timeframe
            aktif berada pada arah yang sama.
          </p>
          <p className="m-0">
            <strong className={T.textInk}>Warna Sel:</strong> Menunjukkan tingkat kekuatan relatif
            mata uang pada skala 0 hingga 10, sementara indikator keselarasan di kolom kanan
            menggambarkan apakah momentum searah di seluruh horizon trading (Scalping, Intraday, dan
            Swing).
          </p>
        </div>
      </details>

      {/* Footer Meta */}
      <div className={`flex justify-between items-center text-[11px] pt-1 ${T.textMute}`}>
        <span>Strength / Multi-timeframe intelligence</span>
        <span>8 mata uang · 10 timeframe · Sinkronisasi Otomatis</span>
      </div>
    </div>
  );
};
