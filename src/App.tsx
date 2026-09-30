import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  CurrencyCode,
  TimeframeKey,
  StrengthSnapshot,
  AlertRule,
  AlertEvent,
  PairOpportunity,
} from './types/forex';
import {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_USD_RATES,
  generateInitialHistory,
  computeRankings,
  computePairOpportunities,
  generateMultiTimeframeMatrix,
  getMarketSessions,
  playAlertChime,
  TIMEFRAME_CONFIGS,
} from './services/currencyStrengthEngine';
import { fetchLiveCurrencyStrengthWebData } from './services/currencyStrengthLiveSource';
import {
  subscribeToAuth,
  testConnection,
  saveUserProfile,
  getUserProfile,
  saveUserAlert,
  deleteUserAlert,
  updateUserAlertStatus,
  fetchUserAlerts,
} from './services/firebase';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { CurrencyStandingsBar } from './components/CurrencyStandingsBar';
import { TimeframeSelector } from './components/TimeframeSelector';
import { CurrencyStrengthChart } from './components/CurrencyStrengthChart';
import { TopDailyPairs } from './components/TopDailyPairs';
import { MultiTimeframeHeatmap } from './components/MultiTimeframeHeatmap';
import { PairOpportunities } from './components/PairOpportunities';
import { MarketSessions } from './components/MarketSessions';
import { AlertsDrawer } from './components/AlertsDrawer';
import { TerminalLaunchScreen } from './components/TerminalLaunchScreen';
import { PairDetailModal } from './components/PairDetailModal';
import { MethodologyModal } from './components/MethodologyModal';
import { AuthModal } from './components/AuthModal';
import { ScalpIntradaySwingMonitor } from './components/ScalpIntradaySwingMonitor';
import { FlowMonitorDashboard } from './components/FlowMonitorDashboard';
import { Flame, Layers, BarChart2, Clock, TrendingUp, Zap, Compass } from 'lucide-react';

export type TerminalTab = 'chart' | 'scalp_monitor' | 'flow_monitor' | 'top_movement' | 'pairs_28' | 'multi_timeframe' | 'sessions';

export default function App() {
  // Global Theme: 'dark' | 'light' saved persistently in localStorage
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('flowmonitor_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  useEffect(() => {
    localStorage.setItem('flowmonitor_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.className =
        'bg-[#090C13] text-zinc-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-200';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.className =
        'bg-[#F8FAFC] text-slate-900 antialiased selection:bg-cyan-500/20 selection:text-cyan-800';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Navigation View: 'landing' by default (natural web flow)
  const [currentView, setCurrentView] = useState<'terminal' | 'landing'>('landing');

  // Terminal active tab: default to 'chart' for the authentic currency-strength experience
  const [activeTab, setActiveTab] = useState<TerminalTab>('chart');

  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isLaunchingTerminal, setIsLaunchingTerminal] = useState<boolean>(false);

  // Timeframe state
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1H');

  // Real-time ticking state
  const [isLive, setIsLive] = useState<boolean>(true);
  const [tickIntervalMs, setTickIntervalMs] = useState<number>(2500);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // Currency Selection & Focus
  const [selectedCurrencies, setSelectedCurrencies] = useState<Set<CurrencyCode>>(
    () => new Set(CURRENCY_CODES)
  );
  const [focusedCurrency, setFocusedCurrency] = useState<CurrencyCode | null>(null);

  // Live Exchange Rates
  const [usdRates, setUsdRates] = useState<Record<CurrencyCode, number>>(DEFAULT_USD_RATES);

  // Time-series history mapped per timeframe (Scalp 5M, 10M, 15M • Intraday 1H, 2H, 3H • Swing 4H, 6H, 8H, 1D)
  const [timeframeHistories, setTimeframeHistories] = useState<
    Record<TimeframeKey, StrengthSnapshot[]>
  >(() => ({
    '5M': generateInitialHistory('5M', 60),
    '10M': generateInitialHistory('10M', 60),
    '15M': generateInitialHistory('15M', 60),
    '1H': generateInitialHistory('1H', 60),
    '2H': generateInitialHistory('2H', 60),
    '3H': generateInitialHistory('3H', 60),
    '4H': generateInitialHistory('4H', 60),
    '6H': generateInitialHistory('6H', 60),
    '8H': generateInitialHistory('8H', 60),
    '1D': generateInitialHistory('1D', 60),
  }));

  // Modals & Drawers
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState<boolean>(false);
  const [selectedDetailPair, setSelectedDetailPair] = useState<PairOpportunity | null>(null);

  // Alert Rules & Log
  const [alertRules, setAlertRules] = useState<AlertRule[]>([
    {
      id: 'rule-1',
      currency: 'USD',
      condition: 'ABOVE',
      threshold: 7.5,
      enabled: true,
    },
    {
      id: 'rule-2',
      currency: 'JPY',
      condition: 'BELOW',
      threshold: 2.8,
      enabled: true,
    },
  ]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);

  // Test Firestore Connection on Boot
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load user saved preferences and alerts from Firestore
        try {
          const profile = await getUserProfile(currentUser.uid);
          if (profile?.preferredTimeframe) {
            setTimeframe(profile.preferredTimeframe as TimeframeKey);
          }
          if (typeof profile?.soundEnabled === 'boolean') {
            setSoundEnabled(profile.soundEnabled);
          }

          const savedAlerts = await fetchUserAlerts(currentUser.uid);
          if (savedAlerts && savedAlerts.length > 0) {
            setAlertRules(savedAlerts);
          } else {
            // Seed starter rules owned by this authenticated user
            const starterRules: AlertRule[] = [
              {
                id: `${currentUser.uid}-rule-1`,
                currency: 'USD',
                condition: 'ABOVE',
                threshold: 7.5,
                enabled: true,
              },
              {
                id: `${currentUser.uid}-rule-2`,
                currency: 'JPY',
                condition: 'BELOW',
                threshold: 2.8,
                enabled: true,
              },
            ];
            setAlertRules(starterRules);
            starterRules.forEach((rule) => {
              saveUserAlert(currentUser.uid, rule).catch(console.warn);
            });
          }
        } catch (err) {
          console.warn('Could not sync user data from cloud:', err);
        }
      } else {
        // If user logged out or unauthenticated, redirect from terminal to landing
        setCurrentView((prev) => (prev === 'terminal' ? 'landing' : prev));
      }
    });
    return () => unsubscribe();
  }, []);

  // Safe navigation handlers
  const handleLaunchTerminal = () => {
    if (!user) {
      setIsAuthOpen(true);
    } else {
      setIsLaunchingTerminal(true);
    }
  };

  const handleChangeView = (view: 'terminal' | 'landing') => {
    if (view === 'terminal') {
      handleLaunchTerminal();
      return;
    }
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTimeframeChange = (newTf: TimeframeKey) => {
    setTimeframe(newTf);
    if (user) {
      saveUserProfile(user.uid, { preferredTimeframe: newTf }).catch(console.warn);
    }
  };

  // Current active history for selected timeframe
  const currentHistory = timeframeHistories[timeframe];
  const latestSnapshot = currentHistory[currentHistory.length - 1];
  const tfConfig = TIMEFRAME_CONFIGS[timeframe] || TIMEFRAME_CONFIGS['1H'];
  const lookback = tfConfig.lookbackDelta;
  const referenceSnapshot =
    currentHistory.length > lookback
      ? currentHistory[currentHistory.length - 1 - lookback]
      : currentHistory[0];

  // Real-time market rankings calculated against the timeframe baseline (preserves session momentum)
  const rankings = useMemo(() => {
    if (!latestSnapshot) return [];
    return computeRankings(latestSnapshot, referenceSnapshot);
  }, [latestSnapshot, referenceSnapshot]);

  // Real-time pair divergence opportunities
  const pairOpportunities = useMemo(() => {
    if (!latestSnapshot) return [];
    return computePairOpportunities(latestSnapshot.scores, usdRates);
  }, [latestSnapshot, usdRates]);

  // Multi-timeframe heatmap data using true histories of all timeframes
  const matrixData = useMemo(() => {
    return generateMultiTimeframeMatrix(timeframeHistories);
  }, [timeframeHistories]);

  // Market Sessions
  const [marketSessions, setMarketSessions] = useState(() => getMarketSessions());

  // Real-time live auto-refresh states
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Baru saja');

  // Real-time currency-strength.com official web synchronization
  const [rawWebSeries, setRawWebSeries] = useState<Record<CurrencyCode, [number, number][]> | null>(null);
  const [isRealWebLive, setIsRealWebLive] = useState<boolean>(false);
  const [isLoadingWebData, setIsLoadingWebData] = useState<boolean>(false);
  const [lastWebSyncTime, setLastWebSyncTime] = useState<string>('');

  const syncCurrencyStrengthWebData = useCallback(async () => {
    setIsLoadingWebData(true);
    try {
      const res = await fetchLiveCurrencyStrengthWebData('1d');
      if (res && res.series) {
        setRawWebSeries(res.series);
        setIsRealWebLive(true);
        const now = new Date();
        setLastWebSyncTime(
          now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );

        if (res.snapshots && res.snapshots.length > 0) {
          const raw5m = res.snapshots;
          const downsample = (step: number) => {
            const arr = raw5m.filter((_, idx) => (raw5m.length - 1 - idx) % step === 0);
            return arr.length >= 8 ? arr : raw5m;
          };

          setTimeframeHistories((prev) => ({
            ...prev,
            '5M': raw5m,
            '10M': downsample(2),
            '15M': downsample(3),
            '1H': downsample(12),
            '2H': downsample(24),
            '3H': downsample(36),
            '4H': downsample(48),
            '6H': downsample(72),
            '8H': downsample(96),
            '1D': raw5m,
          }));
        }
      }
    } catch (err) {
      console.warn('Currency-strength.com live sync failed:', err);
    } finally {
      setIsLoadingWebData(false);
    }
  }, []);

  // Initial web sync on boot
  useEffect(() => {
    syncCurrencyStrengthWebData();
  }, [syncCurrencyStrengthWebData]);

  // Periodic background sync from currency-strength.com every 20 seconds
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      syncCurrencyStrengthWebData();
    }, 20000);
    return () => clearInterval(timer);
  }, [isLive, syncCurrencyStrengthWebData]);

  // Fetch real-world exchange rates
  const fetchLiveRates = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          setUsdRates({
            USD: 1.0,
            EUR: data.rates.EUR || DEFAULT_USD_RATES.EUR,
            GBP: data.rates.GBP || DEFAULT_USD_RATES.GBP,
            JPY: data.rates.JPY || DEFAULT_USD_RATES.JPY,
            CHF: data.rates.CHF || DEFAULT_USD_RATES.CHF,
            AUD: data.rates.AUD || DEFAULT_USD_RATES.AUD,
            CAD: data.rates.CAD || DEFAULT_USD_RATES.CAD,
            NZD: data.rates.NZD || DEFAULT_USD_RATES.NZD,
          });
          const now = new Date();
          setLastSyncTime(
            now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
        }
      }
    } catch (err) {
      // Fallback to default rates
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  }, []);

  // 1. Initial fetch on mount
  useEffect(() => {
    fetchLiveRates();
  }, [fetchLiveRates]);

  // 2. Periodic background rate refresh (every 15s when active)
  useEffect(() => {
    if (!isLive) return;
    const rateTimer = setInterval(() => {
      fetchLiveRates();
    }, 15000);
    return () => clearInterval(rateTimer);
  }, [isLive, fetchLiveRates]);

  // 3. Instant auto-refresh on window focus / tab visibility return (zero delay)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLiveRates();
        setMarketSessions(getMarketSessions());
      }
    };

    const handleFocus = () => {
      fetchLiveRates();
      setMarketSessions(getMarketSessions());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchLiveRates]);

  // Update market sessions clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketSessions(getMarketSessions());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Check alert trigger callback
  const checkAlertRules = useCallback(
    (newScores: Record<CurrencyCode, number>) => {
      const now = Date.now();
      alertRules.forEach((rule) => {
        if (!rule.enabled) return;
        // Throttle triggers: at most once per 30 seconds per rule
        if (rule.lastTriggered && now - rule.lastTriggered < 30000) return;

        const score = newScores[rule.currency];
        if (score === undefined) return;

        const isTriggered =
          (rule.condition === 'ABOVE' && score >= rule.threshold) ||
          (rule.condition === 'BELOW' && score <= rule.threshold);

        if (isTriggered) {
          rule.lastTriggered = now;
          const msg =
            rule.condition === 'ABOVE'
              ? `surged above ${rule.threshold.toFixed(1)} (Score: ${score.toFixed(2)})`
              : `dropped below ${rule.threshold.toFixed(1)} (Score: ${score.toFixed(2)})`;

          if (soundEnabled) {
            playAlertChime(rule.condition === 'ABOVE' ? 'bullish' : 'bearish');
          }

          setAlertEvents((prev) => [
            {
              id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              timestamp: now,
              currency: rule.currency,
              message: msg,
              score,
              threshold: rule.threshold,
            },
            ...prev.slice(0, 49),
          ]);
        }
      });
    },
    [alertRules, soundEnabled]
  );

  // Live Tick Engine: simulates high-frequency order book liquidity & flow shifts
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setTimeframeHistories((prevHistories) => {
        const updated = { ...prevHistories };

        const activeList = [...updated[timeframe]];
        const lastPoint = activeList[activeList.length - 1];
        if (!lastPoint) return prevHistories;

        const now = Date.now();
        const date = new Date(now);
        const timeString =
          timeframe === '1D'
            ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
            : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const tfConfig = TIMEFRAME_CONFIGS[timeframe] || TIMEFRAME_CONFIGS['1H'];
        const volatility = tfConfig.tickVolatility;
        const inertia = tfConfig.inertia;

        const newScores: Record<CurrencyCode, number> = {} as any;

        CURRENCY_CODES.forEach((code) => {
          const currentScore = lastPoint.scores[code] ?? 5.0;
          // Sub-decimal noise strictly proportional to timeframe category
          const microJitter = (Math.random() - 0.49) * volatility;
          // High inertia preserves the directional momentum of the session (no erratic flips on Intraday)
          const deltaDrift = microJitter * (1 - inertia * 0.7);
          const nextScore = Math.max(0.6, Math.min(9.7, Number((currentScore + deltaDrift).toFixed(2))));
          newScores[code] = nextScore;
        });

        // Add new point and slide window (maintain up to 100 points)
        activeList.push({
          timestamp: now,
          timeString,
          scores: newScores,
        });

        if (activeList.length > 100) {
          activeList.shift();
        }

        updated[timeframe] = activeList;

        // Check alerts
        checkAlertRules(newScores);

        return updated;
      });
    }, tickIntervalMs);

    return () => clearInterval(interval);
  }, [isLive, tickIntervalMs, timeframe, checkAlertRules]);

  // Currency selection helpers
  const handleToggleCurrency = (code: CurrencyCode) => {
    setSelectedCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        if (next.size > 1) {
          next.delete(code);
        }
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleSoloCurrency = (code: CurrencyCode) => {
    setSelectedCurrencies(new Set([code]));
    setFocusedCurrency(code);
  };

  const handleSelectAllCurrencies = () => {
    setSelectedCurrencies(new Set(CURRENCY_CODES));
    setFocusedCurrency(null);
  };

  const handleSelectPairForChart = (base: CurrencyCode, quote: CurrencyCode) => {
    setSelectedCurrencies(new Set([base, quote]));
    setFocusedCurrency(base);
    if (!user) {
      setIsAuthOpen(true);
    } else {
      setCurrentView('terminal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectFlowPair = (pairName: string) => {
    if (pairName && pairName.length === 6) {
      const b = pairName.slice(0, 3) as CurrencyCode;
      const q = pairName.slice(3, 6) as CurrencyCode;
      if (CURRENCY_CODES.includes(b) && CURRENCY_CODES.includes(q)) {
        handleSelectPairForChart(b, q);
      }
    }
  };

  // Export data snapshot to CSV
  const handleExportSnapshot = () => {
    if (!latestSnapshot) return;
    let csv = 'Currency,Country,Score,Rank,Delta,Sentiment\n';
    rankings.forEach((r) => {
      const conf = CURRENCIES[r.code];
      csv += `${r.code},"${conf.country}",${r.score},${r.rank},${r.delta},"${r.sentiment}"\n`;
    });

    csv += '\nPair,Base,Quote,BaseScore,QuoteScore,Divergence,Signal,Rate,SpreadPips\n';
    pairOpportunities.forEach((p) => {
      csv += `${p.pair},${p.base},${p.quote},${p.baseScore},${p.quoteScore},${p.divergence},"${p.signal}",${p.rate},${p.spreadPips}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `flowmonitor-snapshot-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Alert Rule Handlers with Cloud Persistence
  const handleAddAlertRule = (newRule: Omit<AlertRule, 'id'>) => {
    const id = `${user?.uid || 'guest'}-${Date.now()}`;
    const fullRule: AlertRule = { ...newRule, id };
    setAlertRules((prev) => [...prev, fullRule]);

    if (user) {
      saveUserAlert(user.uid, fullRule).catch(console.warn);
    }
  };

  const handleToggleAlertRule = (id: string) => {
    setAlertRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextEnabled = !r.enabled;
          if (user) {
            updateUserAlertStatus(id, nextEnabled).catch(console.warn);
          }
          return { ...r, enabled: nextEnabled };
        }
        return r;
      })
    );
  };

  const handleDeleteAlertRule = (id: string) => {
    setAlertRules((prev) => prev.filter((r) => r.id !== id));
    if (user) {
      deleteUserAlert(id).catch(console.warn);
    }
  };

  const handleClearAlertEvents = () => {
    setAlertEvents([]);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#090C13] text-zinc-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Main View Transition Container */}
      <div
        className={`flex-1 flex flex-col transition-all duration-500 ease-out ${
          isLaunchingTerminal ? 'scale-[0.985] filter blur-[2px] opacity-75' : 'scale-100 filter-none opacity-100'
        }`}
      >
        {/* If Landing View: render dedicated Landing Page experience */}
        {currentView === 'landing' ? (
          <LandingPage
            onLaunchTerminal={handleLaunchTerminal}
            onOpenLogin={() => setIsAuthOpen(true)}
            user={user}
            rankings={rankings}
            marketSessions={marketSessions}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        ) : !user ? (
        /* Strict Guard: If unauthenticated in terminal view, show Login Gate */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.1] flex items-center justify-center text-slate-700 dark:text-white shadow-sm">
            <svg className="w-6 h-6 text-slate-500 dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
            Akses Meja Kerja Dibatasi
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            Terminal Trading memerlukan sesi terautentikasi untuk menyinkronkan data real-time dan alarm Anda secara permanen.
          </p>
          <div className="flex items-center gap-2.5 pt-2">
            <button
              onClick={() => setIsAuthOpen(true)}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
            >
              Masuk dengan Akun
            </button>
            <button
              onClick={() => setCurrentView('landing')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 text-xs rounded-xl cursor-pointer transition-colors"
            >
              Kembali ke Depan
            </button>
          </div>
        </div>
      ) : (
        /* If Authenticated in Terminal View: render dedicated Financial Trader Cockpit Workspace */
        <>
          {/* Workspace Trading Cockpit Header */}
          <Header
            currentView={currentView}
            onChangeView={handleChangeView}
            isLive={isLive}
            onToggleLive={() => setIsLive(!isLive)}
            tickIntervalMs={tickIntervalMs}
            onChangeTickInterval={setTickIntervalMs}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            marketSessions={marketSessions}
            onOpenMethodology={() => setIsMethodologyOpen(true)}
            onOpenAlerts={() => setIsAlertsOpen(true)}
            onExportSnapshot={handleExportSnapshot}
            unreadAlertCount={alertEvents.length}
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
            onManualRefresh={fetchLiveRates}
            isRefreshing={isRefreshing}
            lastUpdatedTime={lastSyncTime}
            rankings={rankings}
            theme={theme}
            onToggleTheme={toggleTheme}
          />

          {/* Main Terminal Workspace Viewport */}
          <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 lg:px-6 py-4 space-y-4">
            {/* 1. Currency Standings Ribbon (Klasemen Kekuatan 8 Mata Uang) */}
            <CurrencyStandingsBar
              rankings={rankings}
              selectedCurrencies={selectedCurrencies}
              onToggleCurrency={handleToggleCurrency}
              onSoloCurrency={handleSoloCurrency}
              focusedCurrency={focusedCurrency}
              timeframe={timeframe}
              theme={theme}
            />

            {/* 2. Modern Segmented View Switcher & Trading Style / Timeframe Selector */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/[0.07] pb-3 transition-colors duration-200">
              {/* Left: Tab Views */}
              <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] rounded-xl text-xs font-medium self-start sm:self-auto overflow-x-auto scrollbar-none shadow-2xs">
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'chart'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs border border-zinc-200 dark:border-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Grafik Garis (Live)</span>
                </button>

                <button
                  onClick={() => setActiveTab('scalp_monitor')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'scalp_monitor'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs border border-zinc-200 dark:border-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Scalp, Intraday & Swing</span>
                </button>

                <button
                  onClick={() => setActiveTab('flow_monitor')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap relative ${
                    activeTab === 'flow_monitor'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs border border-zinc-200 dark:border-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-orange-500" />
                  <span>Flow Monitor (BTC & Komoditas)</span>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Live
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('top_movement')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'top_movement'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs border border-zinc-200 dark:border-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>5 Pair Disparitas</span>
                </button>

                <button
                  onClick={() => setActiveTab('pairs_28')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'pairs_28'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs border border-zinc-200 dark:border-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Screener 28 Pair</span>
                </button>

                <button
                  onClick={() => setActiveTab('multi_timeframe')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'multi_timeframe'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs border border-zinc-200 dark:border-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5 text-purple-500" />
                  <span>Multi-Timeframe</span>
                </button>

                <button
                  onClick={() => setActiveTab('sessions')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'sessions'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs border border-zinc-200 dark:border-white/10'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Sesi Pasar</span>
                </button>
              </div>

              {/* Right: Trading Style & Timeframe Mode Selector (Scalp / Intraday / Swing) */}
              <div className="flex items-center gap-3 self-start lg:self-auto overflow-x-auto scrollbar-none">
                <TimeframeSelector
                  activeTimeframe={timeframe}
                  onChangeTimeframe={handleTimeframeChange}
                />
              </div>
            </div>

            {/* 3. Direct Content View with Silky Smooth Tab Crossfade */}
            <AnimatePresence mode="wait">
              {activeTab === 'chart' && (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <CurrencyStrengthChart
                    history={currentHistory}
                    rankings={rankings}
                    timeframe={timeframe}
                    onChangeTimeframe={handleTimeframeChange}
                    selectedCurrencies={selectedCurrencies}
                    onToggleCurrency={handleToggleCurrency}
                    onSoloCurrency={handleSoloCurrency}
                    focusedCurrency={focusedCurrency}
                    onSetFocusedCurrency={setFocusedCurrency}
                    rawWebSeries={rawWebSeries}
                    isRealWebLive={isRealWebLive}
                    onRefreshWebData={syncCurrencyStrengthWebData}
                    isLoadingWebData={isLoadingWebData}
                    lastWebSyncTime={lastWebSyncTime}
                    theme={theme}
                  />

                  {/* Scalp, Intraday & Swing Horizon Monitor Bar */}
                  <div className="mt-4">
                    <ScalpIntradaySwingMonitor
                      activeTimeframe={timeframe}
                      onChangeTimeframe={handleTimeframeChange}
                      currentHistory={currentHistory}
                      rankings={rankings}
                      onManualRefresh={syncCurrencyStrengthWebData}
                      theme={theme}
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === 'scalp_monitor' && (
                <motion.div
                  key="scalp_monitor"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  <ScalpIntradaySwingMonitor
                    activeTimeframe={timeframe}
                    onChangeTimeframe={handleTimeframeChange}
                    currentHistory={currentHistory}
                    rankings={rankings}
                    onManualRefresh={syncCurrencyStrengthWebData}
                    theme={theme}
                  />

                  <CurrencyStrengthChart
                    history={currentHistory}
                    rankings={rankings}
                    timeframe={timeframe}
                    onChangeTimeframe={handleTimeframeChange}
                    selectedCurrencies={selectedCurrencies}
                    onToggleCurrency={handleToggleCurrency}
                    onSoloCurrency={handleSoloCurrency}
                    focusedCurrency={focusedCurrency}
                    onSetFocusedCurrency={setFocusedCurrency}
                    rawWebSeries={rawWebSeries}
                    isRealWebLive={isRealWebLive}
                    onRefreshWebData={syncCurrencyStrengthWebData}
                    isLoadingWebData={isLoadingWebData}
                    lastWebSyncTime={lastWebSyncTime}
                    theme={theme}
                  />
                </motion.div>
              )}

              {activeTab === 'flow_monitor' && (
                <motion.div
                  key="flow_monitor"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <FlowMonitorDashboard
                    theme={theme}
                    onSelectPair={handleSelectFlowPair}
                    onToggleTheme={toggleTheme}
                    onLogout={() => setCurrentView('landing')}
                    activeTimeframe={timeframe}
                    onChangeTimeframe={handleTimeframeChange}
                    timeframeHistories={timeframeHistories}
                    usdRates={usdRates}
                  />
                </motion.div>
              )}

              {activeTab === 'top_movement' && (
                <motion.div
                  key="top_movement"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <TopDailyPairs
                    opportunities={pairOpportunities}
                    matrixData={matrixData}
                    onOpenPairDetails={setSelectedDetailPair}
                    onOpenTradingView={setSelectedDetailPair}
                    theme={theme}
                  />
                </motion.div>
              )}

              {activeTab === 'pairs_28' && (
                <motion.div
                  key="pairs_28"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <PairOpportunities
                    opportunities={pairOpportunities}
                    onSelectPairForChart={handleSelectPairForChart}
                    onOpenPairDetails={setSelectedDetailPair}
                    onOpenTradingView={setSelectedDetailPair}
                    theme={theme}
                  />
                </motion.div>
              )}

              {activeTab === 'multi_timeframe' && (
                <motion.div
                  key="multi_timeframe"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <MultiTimeframeHeatmap
                    matrixData={matrixData}
                    selectedCurrencies={selectedCurrencies}
                    onToggleCurrency={handleToggleCurrency}
                    onSoloCurrency={handleSoloCurrency}
                    theme={theme}
                  />
                </motion.div>
              )}

              {activeTab === 'sessions' && (
                <motion.div
                  key="sessions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <MarketSessions sessions={marketSessions} theme={theme} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Terminal Workspace Footer */}
          <footer className="border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#070a10] py-4 px-4 lg:px-6 text-xs text-slate-500 dark:text-zinc-400 font-mono mt-auto transition-colors">
            <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-800 dark:text-zinc-300 font-semibold font-sans">Currency Strength</span>
                <span>·</span>
                <span className="text-slate-500 dark:text-zinc-400">Live Institutional Forex Terminal</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView('landing')}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                >
                  ← Halaman Utama
                </button>
                <span>·</span>
                <button
                  onClick={() => setIsMethodologyOpen(true)}
                  className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Metodologi
                </button>
                <span>·</span>
                <span className="text-slate-400 dark:text-slate-600">Model terkalibrasi currency-strength.com</span>
              </div>
            </div>
          </footer>
        </>
      )}
      </div>

      {/* Alerts Drawer */}
      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        rules={alertRules}
        onAddRule={handleAddAlertRule}
        onToggleRule={handleToggleAlertRule}
        onDeleteRule={handleDeleteAlertRule}
        events={alertEvents}
        onClearEvents={handleClearAlertEvents}
      />

      {/* Pair Detail Inspector Modal */}
      <PairDetailModal
        pair={selectedDetailPair}
        onClose={() => setSelectedDetailPair(null)}
        onSelectPairForChart={handleSelectPairForChart}
      />

      {/* Educational Methodology Modal */}
      <MethodologyModal
        isOpen={isMethodologyOpen}
        onClose={() => setIsMethodologyOpen(false)}
      />

      {/* Firebase Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          setIsAuthOpen(false);
          setIsLaunchingTerminal(true);
        }}
      />

      {/* Terminal Booting / Transition Screen with Matrix Rain */}
      <AnimatePresence>
        {isLaunchingTerminal && (
          <TerminalLaunchScreen
            userEmail={user?.email || undefined}
            theme={theme}
            onComplete={() => {
              setIsLaunchingTerminal(false);
              setCurrentView('terminal');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
