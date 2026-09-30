import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCw,
  Bell,
  Settings2,
  Clock,
  Download,
  HelpCircle,
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Globe,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { logoutUser } from '../services/firebase';
import { GlobalSentimentHeader } from './GlobalSentimentHeader';
import { BrandLogo } from './BrandLogo';
import { CurrencyStrengthScore, MarketSession } from '../types/forex';

interface HeaderProps {
  currentView: 'terminal' | 'landing';
  onChangeView: (view: 'terminal' | 'landing') => void;
  isLive: boolean;
  onToggleLive: () => void;
  tickIntervalMs: number;
  onChangeTickInterval: (ms: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  marketSessions: MarketSession[];
  onOpenMethodology: () => void;
  onOpenAlerts: () => void;
  onExportSnapshot: () => void;
  unreadAlertCount?: number;
  user: User | null;
  onOpenAuth: () => void;
  onManualRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdatedTime?: Date | string;
  rankings?: CurrencyStrengthScore[];
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onChangeView,
  isLive,
  onToggleLive,
  tickIntervalMs,
  onChangeTickInterval,
  soundEnabled,
  onToggleSound,
  marketSessions,
  onOpenMethodology,
  onOpenAlerts,
  onExportSnapshot,
  unreadAlertCount = 0,
  user,
  onOpenAuth,
  onManualRefresh,
  isRefreshing = false,
  lastUpdatedTime,
  rankings = [],
  theme = 'dark',
  onToggleTheme,
}) => {
  const isDark = theme === 'dark';
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [wibTime, setWibTime] = useState<string>('');

  // Clock with Jakarta (WIB) precision
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
      setWibTime(`${formatted} WIB`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsSettingsOpen(false);
    await logoutUser();
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur-md px-4 lg:px-6 py-2 transition-colors duration-200 ${
        isDark
          ? 'bg-[#0A0C12]/95 border-white/[0.08] text-white'
          : 'bg-white/95 border-zinc-200 text-zinc-900 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3 max-w-[1700px] mx-auto">
        {/* Left: Brand Emblem & Live Indicator */}
        <BrandLogo size="md" showText={true} showBadge={true} isLive={isLive} />

        {/* Center: Global Sentiment Index & Local WIB Clock */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {rankings && rankings.length > 0 && (
            <GlobalSentimentHeader rankings={rankings} />
          )}

          {/* Clean Local WIB Time */}
          <div className={`hidden md:flex items-center gap-1.5 text-xs font-mono shrink-0 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            <Clock className={`w-3 h-3 shrink-0 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
            <span className={`font-medium text-[11px] sm:text-xs whitespace-nowrap ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
              {wibTime}
            </span>
          </div>
        </div>

        {/* Right: Essential Clean Controls */}
        <div className="flex items-center gap-1.5">
          {/* Refresh Button */}
          {onManualRefresh && (
            <button
              onClick={onManualRefresh}
              disabled={isRefreshing}
              className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
              }`}
              title="Refresh Data Pasar"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Live / Pause Button */}
          <button
            onClick={onToggleLive}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              isDark
                ? isLive
                  ? 'bg-zinc-900 border-white/[0.08] text-zinc-300 hover:text-white'
                  : 'bg-zinc-900 border-white/[0.08] text-zinc-500 hover:text-zinc-300'
                : isLive
                ? 'bg-zinc-100 border-zinc-200 text-zinc-800 hover:bg-zinc-200'
                : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200'
            }`}
            title={isLive ? 'Jeda pembaruan' : 'Lanjutkan pembaruan'}
          >
            {isLive ? <Pause className="w-3 h-3 text-emerald-500" /> : <Play className={`w-3 h-3 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />}
            <span className="hidden sm:inline font-mono text-[11px]">
              {isLive ? `${tickIntervalMs / 1000}s` : 'Pause'}
            </span>
          </button>

          {/* Alert Trigger */}
          <button
            onClick={onOpenAlerts}
            className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
            title="Kelola Notifikasi"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadAlertCount > 0 && (
              <span className="absolute 0.5 top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>

          {/* Quick Dual Segmented Theme Switcher */}
          {onToggleTheme && (
            <div className="flex items-center p-0.5 rounded-lg border text-xs font-medium border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-zinc-900/90 shadow-2xs">
              <button
                type="button"
                onClick={() => !isDark || onToggleTheme()}
                className={`p-1 sm:px-2 sm:py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer ${
                  !isDark
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
                title="Mode Terang (Light Mode)"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline text-[11px]">Terang</span>
              </button>
              <button
                type="button"
                onClick={() => isDark || onToggleTheme()}
                className={`p-1 sm:px-2 sm:py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
                title="Mode Gelap (Dark Mode)"
              >
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline text-[11px]">Gelap</span>
              </button>
            </div>
          )}

          {/* Settings & Profile Unified Menu */}
          <div className="relative pl-0.5" ref={settingsMenuRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
              }`}
              title="Pengaturan & Akun"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>

            {/* Clean Dropdown Sheet */}
            {isSettingsOpen && (
              <div
                className={`absolute right-0 mt-2 w-56 rounded-xl shadow-2xl p-2.5 z-50 text-xs space-y-2.5 border ${
                  isDark
                    ? 'bg-[#11141D] border-white/[0.1] text-zinc-200'
                    : 'bg-white border-zinc-200 text-zinc-800 shadow-xl'
                }`}
              >
                {/* User info if logged in */}
                {user ? (
                  <div className={`px-2 py-1.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                    <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-zinc-950'}`}>{user.displayName || 'Trader'}</p>
                    <p className="text-[11px] text-zinc-500 truncate font-mono">{user.email}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenAuth();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 font-medium rounded-lg text-center justify-center transition-colors cursor-pointer ${
                      isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-xs' : 'bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow-xs'
                    }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Masuk Akun</span>
                  </button>
                )}

                {/* Interval Speed Setting */}
                <div className="px-2">
                  <span className={`text-[11px] font-mono block mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Kecepatan Update
                  </span>
                  <div
                    className={`grid grid-cols-3 gap-1 p-0.5 rounded-md border text-center font-mono text-[11px] ${
                      isDark
                        ? 'bg-zinc-900 border-white/[0.06]'
                        : 'bg-zinc-100 border-zinc-200'
                    }`}
                  >
                    {[1000, 2500, 5000].map((ms) => (
                      <button
                        key={ms}
                        onClick={() => onChangeTickInterval(ms)}
                        className={`py-0.5 rounded cursor-pointer ${
                          tickIntervalMs === ms
                            ? isDark
                              ? 'bg-zinc-800 text-white font-semibold'
                              : 'bg-white text-zinc-950 font-semibold shadow-xs'
                            : isDark
                            ? 'text-zinc-500 hover:text-zinc-300'
                            : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                      >
                        {ms / 1000}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Preferences */}
                <div className={`space-y-0.5 pt-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                  {onToggleTheme && (
                    <button
                      onClick={onToggleTheme}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-white/[0.05] text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-cyan-600" />}
                        <span>Tema Tampilan</span>
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px]">
                        {isDark ? 'Mode Gelap' : 'Mode Terang'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={onToggleSound}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-white/[0.05] text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {soundEnabled ? <Volume2 className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`} /> : <VolumeX className="w-3.5 h-3.5 text-zinc-500" />}
                      <span>Suara Alarm</span>
                    </span>
                    <span className="text-zinc-500 font-mono text-[11px]">
                      {soundEnabled ? 'Aktif' : 'Mati'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onExportSnapshot();
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-white/[0.05] text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Unduh CSV Data</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenMethodology();
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-white/[0.05] text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Panduan & Formula</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onChangeView('landing');
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer border-t pt-1.5 ${
                      isDark
                        ? 'hover:bg-white/[0.05] text-zinc-300 border-white/[0.06]'
                        : 'hover:bg-zinc-100 text-zinc-700 border-zinc-100'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Halaman Depan (Landing)</span>
                  </button>
                </div>

                {/* Logout if logged in */}
                {user && (
                  <div className={`pt-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-rose-500 hover:bg-rose-500/10 rounded text-left transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar Akun</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
