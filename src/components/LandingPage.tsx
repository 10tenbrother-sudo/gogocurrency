import React, { useState } from 'react';
import {
  CurrencyStrengthScore,
  MarketSession,
  CurrencyCode,
} from '../types/forex';
import { CURRENCIES, getCurrencyConfig, formatScore } from '../services/currencyStrengthEngine';
import {
  Activity,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart3,
  Clock,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lock,
  Globe2,
  LineChart,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { BrandLogo } from './BrandLogo';

interface LandingPageProps {
  rankings: CurrencyStrengthScore[];
  marketSessions: MarketSession[];
  onLaunchTerminal: () => void;
  user: User | null;
  onOpenLogin: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  rankings,
  marketSessions,
  onLaunchTerminal,
  user,
  onOpenLogin,
  theme,
  onToggleTheme,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const handleTerminalClick = () => {
    if (!user) {
      onOpenLogin();
    } else {
      onLaunchTerminal();
    }
  };

  const isLight = theme === 'light';

  // Responsive Semantic Theme Style Tokens
  const t = {
    pageBg: isLight ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#090C13] text-zinc-100',
    headerBg: isLight ? 'bg-white/95 border-slate-200 shadow-2xs' : 'bg-[#090C13]/95 border-white/[0.07]',
    navText: isLight ? 'text-slate-600 hover:text-slate-950' : 'text-zinc-400 hover:text-white',
    titleText: isLight ? 'text-slate-950' : 'text-white',
    subText: isLight ? 'text-slate-600' : 'text-zinc-400',
    cardBg: isLight ? 'bg-white border-slate-200 shadow-xs text-slate-900' : 'bg-[#0F131D] border-white/[0.08] text-white',
    subCardBg: isLight ? 'bg-slate-50/80 border-slate-200 text-slate-900' : 'bg-[#131722] border-white/[0.06] text-white',
    subCardHover: isLight ? 'hover:bg-slate-100 hover:border-slate-300' : 'hover:bg-[#181E2C] hover:border-white/20',
    borderLine: isLight ? 'border-slate-200' : 'border-white/[0.07]',
    chipBg: isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-zinc-900 border-white/[0.08] text-zinc-300',
    secondaryBtn: isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-2xs' : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/[0.08] text-zinc-200',
    primaryBtn: isLight ? 'bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow-xs' : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/10',
    barTrack: isLight ? 'bg-slate-200' : 'bg-zinc-800/80',
    iconBox: isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-zinc-900 border-white/[0.08] text-white',
  };

  const faqs = [
    {
      q: 'Bagaimana skor kekuatan mata uang dihitung?',
      a: 'Algoritma mengevaluasi 28 pasangan mata uang utama (Cross Pairs) secara simultan. Setiap pergerakan harga dipecah menjadi kontribusi individu mata uang dasar dan pembanding melalui kalkulasi logaritmik rata-rata tertimbang, dinormalisasi ke dalam skala 0.00 (Sangat Lemah) hingga 10.00 (Sangat Kuat).',
    },
    {
      q: 'Mengapa analisis disparitas aliran lebih unggul daripada sekadar membaca candlestick?',
      a: 'Saat EUR/USD naik, candlestick grafik biasa tidak memberitahu apakah kenaikan didorong oleh pembelian masif Euro atau pelemahan global Dollar AS. Currency Strength mengisolasi kekuatan masing-masing mata uang, sehingga Anda dapat memasangkan mata uang terkuat (Strongest) dengan mata uang terlemah (Weakest) untuk momentum perdagangan dengan probabilitas tertinggi.',
    },
    {
      q: 'Bagaimana cara konfirmasi arah dengan widget TradingView yang tersedia?',
      a: 'Setiap pasangan mata uang di terminal dilengkapi tombol "Chart TV ↗". Saat Anda menemukan disparitas tinggi (misal EUR kuat dan JPY lemah dengan bias Bullish), Anda dapat langsung membuka candlestick TradingView dalam berbagai timeframe (5M, 15M, 1H, 4H, 1D) untuk mengecek level support, resistance, dan aksi harga teknikal sebelum mengambil keputusan.',
    },
    {
      q: 'Apakah akun diperlukan untuk mengakses terminal?',
      a: 'Ya, autentikasi digunakan untuk menyimpan preferensi trading Anda di Google Cloud Firestore, termasuk aturan alarm ambang batas skor, timeframe favorit, dan status personalisasi tanpa resiko hilang saat browser ditutup.',
    },
  ];

  return (
    <div className={`w-full min-h-screen transition-colors duration-200 ${t.pageBg} font-sans selection:bg-cyan-500/20 selection:text-cyan-900 dark:selection:text-cyan-200`}>
      {/* 1. MARKETING NAVIGATION BAR */}
      <header className={`sticky top-0 z-40 w-full border-b transition-colors duration-200 ${t.headerBg} backdrop-blur-md px-4 lg:px-8 py-3`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <BrandLogo size="md" showText={true} />

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium">
            <a href="#overview" className={`${t.navText} transition-colors`}>
              Kekuatan Pasar
            </a>
            <a href="#divergence" className={`${t.navText} transition-colors`}>
              Divergensi 28-Pair
            </a>
            <a href="#methodology" className={`${t.navText} transition-colors`}>
              Metodologi
            </a>
            <a href="#sessions" className={`${t.navText} transition-colors`}>
              Sesi Dunia
            </a>
            <a href="#faq" className={`${t.navText} transition-colors`}>
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            {/* Dual Segmented Theme Switcher: Clear Active Status */}
            <div className="flex items-center p-0.5 rounded-lg border text-xs font-medium border-slate-200 dark:border-white/[0.1] bg-slate-100 dark:bg-zinc-900/90 shadow-2xs">
              <button
                type="button"
                onClick={() => isLight || onToggleTheme()}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
                title="Aktifkan Mode Terang (Light Mode)"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Terang</span>
              </button>
              <button
                type="button"
                onClick={() => !isLight || onToggleTheme()}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  !isLight
                    ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
                title="Aktifkan Mode Gelap (Dark Mode)"
              >
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Gelap</span>
              </button>
            </div>

            {user ? (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className={`max-w-[130px] truncate ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {user.displayName || user.email}
                </span>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isLight
                    ? 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-2xs'
                    : 'border-white/[0.08] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Masuk</span>
              </button>
            )}

            <button
              onClick={handleTerminalClick}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 font-semibold text-xs rounded-lg transition-all shadow-sm cursor-pointer ${t.primaryBtn}`}
            >
              <span>{user ? 'Buka Terminal' : 'Mulai Sekarang'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className={`relative pt-16 pb-20 border-b ${t.borderLine} overflow-hidden`} id="overview">
        {/* Subtle radial ambient spotlight */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-3xl pointer-events-none ${
          isLight ? 'bg-amber-500/[0.05]' : 'bg-white/[0.03]'
        }`} />

        <div className="max-w-6xl mx-auto px-4 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            {/* Clean Unboxed Kicker */}
            <div className={`flex items-center justify-center gap-2 text-xs font-mono ${t.subText}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Institutional Currency Flow Monitor · Live Jakarta (WIB)</span>
            </div>

            {/* Hero Title */}
            <h1 className={`text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] font-[family-name:var(--font-display)] [text-wrap:balance] ${t.titleText}`}>
              Presisi Kekuatan Mata Uang & Aliran Modal Global
            </h1>

            {/* Subtitle */}
            <p className={`text-sm sm:text-base max-w-2xl mx-auto leading-relaxed ${t.subText}`}>
              Algoritma normalisasi 28 cross pairs secara simultan. Identifikasi momentum disparitas probabilitas tinggi dan konfirmasi langsung dengan candlestick TradingView.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button
                onClick={handleTerminalClick}
                className={`w-full sm:w-auto px-6 py-3 font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all text-xs sm:text-sm cursor-pointer ${t.primaryBtn}`}
              >
                <span>{user ? 'Buka Terminal Workspace' : 'Buka Terminal Trading'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#divergence"
                className={`w-full sm:w-auto px-5 py-3 font-medium rounded-xl transition-colors text-xs sm:text-sm flex items-center justify-center gap-2 border ${t.secondaryBtn}`}
              >
                <span>Pelajari Konsep Flow</span>
              </a>
            </div>
          </div>

          {/* Interactive Live Ticker Ribbon (Live Snapshot) */}
          <div className="mt-14 max-w-5xl mx-auto">
            <div className={`border rounded-2xl p-5 transition-colors duration-200 ${t.cardBg}`}>
              <div className={`flex items-center justify-between border-b ${t.borderLine} pb-3 mb-4 text-xs font-mono`}>
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span className={`font-semibold uppercase tracking-wider ${t.titleText}`}>
                    Live Currency Standings · Skala 0.00 – 10.00
                  </span>
                </div>
                <button
                  onClick={handleTerminalClick}
                  className={`${t.subText} hover:${t.titleText} flex items-center gap-1 cursor-pointer font-sans text-xs transition-colors`}
                >
                  <span>{user ? 'Buka di Meja Kerja' : 'Login untuk Akses Penuh'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* 8 Currency Cards Ribbon */}
              <div className="grid grid-flow-col auto-cols-[105px] sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-4 lg:grid-cols-8 gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none snap-x">
                {rankings.map((item) => {
                  const conf = CURRENCIES[item.code] || getCurrencyConfig(item.code);
                  return (
                    <div
                      key={item.code}
                      onClick={handleTerminalClick}
                      className={`border p-3 rounded-xl flex flex-col justify-between cursor-pointer transition-all snap-start min-w-[105px] sm:min-w-0 ${t.subCardBg} ${t.subCardHover}`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-base">{conf?.flag || '🌐'}</span>
                        <span className="font-mono text-[10px] text-zinc-500 font-semibold">
                          #{item.rank}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between">
                          <span className={`font-bold text-sm tracking-tight ${t.titleText}`}>
                            {item.code}
                          </span>
                          <span className={`text-base font-semibold font-mono tabular-nums ${isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>
                            {formatScore(item.score)}
                          </span>
                        </div>
                        {/* Clean progress bar */}
                        <div className={`w-full ${t.barTrack} h-1.5 rounded-full overflow-hidden mt-2`}>
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.score >= 7.0
                                ? 'bg-emerald-500'
                                : item.score <= 3.0
                                ? 'bg-rose-500'
                                : 'bg-zinc-400'
                            }`}
                            style={{
                              width: `${(item.score / 10) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORE PROBLEM & SOLUTION SECTION (The Flow Divergence Edge) */}
      <section className={`py-20 max-w-6xl mx-auto px-4 lg:px-8 border-b ${t.borderLine}`} id="divergence">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className={`flex items-center gap-2 text-xs font-mono ${t.subText}`}>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Capital Flow Divergence</span>
            </div>

            <h2 className={`text-2xl sm:text-4xl font-bold tracking-tight leading-snug font-[family-name:var(--font-display)] ${t.titleText}`}>
              Mengapa Melihat Candlestick Saja Seringkali Menipu?
            </h2>

            <p className={`leading-relaxed text-sm sm:text-base ${t.subText}`}>
              Dalam pasar Forex, mata uang selalu diperdagangkan berpasangan. Saat grafik <strong className={t.titleText}>EUR/USD</strong> bergerak naik, grafik biasa tidak menjelaskan: apakah Euro yang sedang mengalami arus beli masif, atau Dollar AS yang sedang dilepas secara luas oleh pasar global?
            </p>

            <div className={`border rounded-xl p-4 space-y-2.5 font-mono text-xs ${t.cardBg}`}>
              <div className={`flex items-center justify-between p-2.5 rounded-lg border ${t.subCardBg}`}>
                <span className={isLight ? 'text-zinc-800' : 'text-zinc-300'}>EUR Kuat (8.40) vs JPY Lemah (1.80)</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  BIAS BULLISH EUR/JPY
                </span>
              </div>
              <div className={`flex items-center justify-between p-2.5 rounded-lg border ${t.subCardBg}`}>
                <span className={isLight ? 'text-zinc-800' : 'text-zinc-300'}>USD Lemah (2.10) vs GBP Kuat (7.90)</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  BIAS BULLISH GBP/USD
                </span>
              </div>
            </div>

            <p className={`text-sm ${t.subText}`}>
              Currency Strength memecahkan masalah ini dengan menganalisis seluruh <strong className={t.titleText}>28 pasangan silang (cross pairs)</strong> secara simultan, memberikan Anda pandangan langsung mengenai arah pergerakan modal institusional.
            </p>
          </div>

          {/* Interactive Feature Architecture Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-5 rounded-2xl border space-y-3 transition-colors ${t.cardBg}`}>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${t.iconBox}`}>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className={`font-semibold text-base ${t.titleText}`}>5 Pair Disparitas Tertinggi</h3>
              <p className={`text-xs leading-relaxed ${t.subText}`}>
                Rekomendasi 5 pasangan mata uang dengan momentum dan disparitas modal terbesar dalam 3 horison: Scalp (5m–15m), Intraday (1h), dan Swing (4h–1d).
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-3 transition-colors ${t.cardBg}`}>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${t.iconBox}`}>
                <LineChart className="w-4 h-4 text-cyan-500" />
              </div>
              <h3 className={`font-semibold text-base ${t.titleText}`}>TradingView Terintegrasi</h3>
              <p className={`text-xs leading-relaxed ${t.subText}`}>
                Konfirmasi aksi harga langsung dari modal dengan widget candlestick resmi TradingView real-time, lengkap dengan pemilih timeframe cepat.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-3 transition-colors ${t.cardBg}`}>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${t.iconBox}`}>
                <Layers className="w-4 h-4 text-purple-500" />
              </div>
              <h3 className={`font-semibold text-base ${t.titleText}`}>Matriks Multi-Timeframe</h3>
              <p className={`text-xs leading-relaxed ${t.subText}`}>
                Deteksi keselarasan tren lintas 5 rentang waktu (5M hingga 1D). Buka posisi hanya jika konvergensi tren kuat dan terkonfirmasi.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-3 transition-colors ${t.cardBg}`}>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${t.iconBox}`}>
                <BarChart3 className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className={`font-semibold text-base ${t.titleText}`}>28-Pair Screener Lengkap</h3>
              <p className={`text-xs leading-relaxed ${t.subText}`}>
                Filter dan urutkan seluruh kombinasi pasangan forex berdasarkan delta disparitas, performa 24 jam, dan tingkat spread institusional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 3-STEP TRADING METHODOLOGY */}
      <section className={`py-20 max-w-6xl mx-auto px-4 lg:px-8 border-b ${t.borderLine}`} id="methodology">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)] ${t.titleText}`}>
            Tiga Langkah Menemukan Edge di Pasar Forex
          </h2>
          <p className={`text-sm ${t.subText}`}>
            Alur kerja sistematis untuk memaksimalkan rasio risk-to-reward dengan strategi divergensi aliran modal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className={`p-6 rounded-2xl border relative space-y-3 ${t.cardBg}`}>
            <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
              Langkah 01
            </span>
            <h3 className={`text-base font-semibold ${t.titleText}`}>Identifikasi Nilai Ekstrem</h3>
            <p className={`text-xs leading-relaxed ${t.subText}`}>
              Cari mata uang dengan skor di atas ambang <strong className="text-emerald-500">7.00</strong> (Sangat Kuat / Net Inflow) dan di bawah <strong className="text-rose-500">3.00</strong> (Sangat Lemah / Net Outflow).
            </p>
          </div>

          <div className={`p-6 rounded-2xl border relative space-y-3 ${t.cardBg}`}>
            <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
              Langkah 02
            </span>
            <h3 className={`text-base font-semibold ${t.titleText}`}>Konfirmasi Timeframe Confluence</h3>
            <p className={`text-xs leading-relaxed ${t.subText}`}>
              Periksa Multi-Timeframe Matrix. Pastikan tren didukung minimal 3 dari 5 timeframe (5M hingga 1D) untuk menghindari jebakan volatilitas sesaat.
            </p>
          </div>

          <div className={`p-6 rounded-2xl border relative space-y-3 ${t.cardBg}`}>
            <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
              Langkah 03
            </span>
            <h3 className={`text-base font-semibold ${t.titleText}`}>Verifikasi Candlestick TradingView</h3>
            <p className={`text-xs leading-relaxed ${t.subText}`}>
              Buka widget TradingView pada pair dengan divergensi tertinggi untuk konfirmasi level teknikal sebelum membuka posisi.
            </p>
          </div>
        </div>
      </section>

      {/* 5. GLOBAL SESSIONS OVERVIEW */}
      <section className={`py-20 max-w-6xl mx-auto px-4 lg:px-8 border-b ${t.borderLine}`} id="sessions">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <div className={`flex items-center gap-2 font-mono text-xs uppercase mb-1 ${t.subText}`}>
              <Globe2 className="w-3.5 h-3.5" />
              <span>Zona Waktu Pasar Global</span>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)] ${t.titleText}`}>
              Status Sesi Forex Dunia (UTC)
            </h2>
          </div>
          <button
            onClick={handleTerminalClick}
            className={`text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors ${t.subText} hover:${t.titleText}`}
          >
            <span>Buka Radar Lengkap di Terminal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {marketSessions.map((session) => (
            <div
              key={session.name}
              className={`p-4 rounded-xl border transition-all ${
                session.isOpen
                  ? session.volatility === 'Peak'
                    ? isLight ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#151710] border-amber-500/30'
                    : isLight ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#0F1418] border-emerald-500/30'
                  : isLight ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-[#0F131D] border-white/[0.06] opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold text-sm ${t.titleText}`}>{session.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                    session.isOpen
                      ? session.volatility === 'Peak'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold'
                      : isLight
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {session.isOpen ? 'Buka' : 'Tutup'}
                </span>
              </div>
              <div className={`text-xs font-mono space-y-1 ${t.subText}`}>
                <div className="flex justify-between">
                  <span>Waktu (UTC):</span>
                  <span className={isLight ? 'text-zinc-800 font-medium' : 'text-zinc-200'}>
                    {String(session.openUtc).padStart(2, '0')}:00 - {String(session.closeUtc).padStart(2, '0')}:00
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Volatilitas:</span>
                  <span className={session.volatility === 'Peak' ? 'text-amber-500 font-medium' : (isLight ? 'text-zinc-700' : 'text-zinc-300')}>
                    {session.volatility}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. FAQ ACCORDION SECTION */}
      <section className={`py-20 max-w-3xl mx-auto px-4 lg:px-8 border-b ${t.borderLine}`} id="faq">
        <div className="text-center mb-10 space-y-1.5">
          <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)] ${t.titleText}`}>
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className={`text-xs ${t.subText}`}>
            Penjelasan mengenai algoritma, akses data, dan integrasi terminal.
          </p>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className={`border rounded-xl overflow-hidden transition-colors ${t.cardBg}`}
            >
              <button
                onClick={() => toggleFaq(idx)}
                className={`w-full p-4 text-left flex items-center justify-between text-sm font-medium cursor-pointer ${
                  isLight ? 'text-zinc-800 hover:text-zinc-950' : 'text-zinc-200 hover:text-white'
                }`}
              >
                <span>{faq.q}</span>
                {activeFaq === idx ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                )}
              </button>
              {activeFaq === idx && (
                <div className={`px-4 pb-4 text-xs leading-relaxed border-t pt-3 ${t.borderLine} ${t.subText}`}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 7. BOTTOM CALL TO ACTION */}
      <section className="py-20 text-center max-w-4xl mx-auto px-4 lg:px-8">
        <div className={`p-8 sm:p-12 rounded-3xl border relative overflow-hidden shadow-xl ${t.cardBg}`}>
          <div className="max-w-xl mx-auto space-y-5 relative z-10">
            <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)] ${t.titleText}`}>
              Siap Memulai Analisis Pasar?
            </h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${t.subText}`}>
              Buka Meja Kerja Terminal untuk akses langsung ke seluruh 8 indikator kekuatan mata uang, grafik interaktif, dan widget TradingView real-time.
            </p>
            <div className="flex items-center justify-center pt-1">
              <button
                onClick={handleTerminalClick}
                className={`w-full sm:w-auto px-7 py-3 font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm transition-all ${t.primaryBtn}`}
              >
                <span>Buka Dashboard Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
