import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Database,
  Radio,
  ArrowRight,
  Volume2,
  VolumeX,
  Cpu,
  Terminal as TerminalIcon,
  Wifi,
  Sparkles,
} from 'lucide-react';
import { CURRENCIES, CURRENCY_CODES, getCurrencyConfig } from '../services/currencyStrengthEngine';

interface TerminalLaunchScreenProps {
  onComplete: () => void;
  userEmail?: string;
  theme?: 'dark' | 'light';
}

const LAUNCH_STEPS = [
  {
    code: 'NET_BRIDGE',
    label: 'Membangun Jembatan Likuiditas Global (FXCM & OANDA)',
    icon: Radio,
    metric: 'PING 12ms · TLS 1.3',
  },
  {
    code: 'MATRIX_28',
    label: 'Mengagregasikan 28 Pasangan Cross Mata Uang Utama',
    icon: Database,
    metric: '28/28 STREAM ACTIVE',
  },
  {
    code: 'ALGO_NORM',
    label: 'Mengaktifkan Model Disparitas Logaritmik (0.00 – 10.00)',
    icon: Zap,
    metric: 'COEFFICIENT 1.000',
  },
  {
    code: 'GEO_RADAR',
    label: 'Kalibrasi Sesi Dunia & Chart Candlestick TradingView',
    icon: ShieldCheck,
    metric: 'ASIA/JAKARTA (WIB) READY',
  },
];

// Rich financial symbols for the subtle Matrix stream
const MATRIX_CHARS = [
  'EUR', 'USD', 'JPY', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF',
  '1.0845', '154.20', '196.40', '0.6520', '0.8640',
  'Δ+4.2', 'Δ-3.8', '0.00', '10.00', '8.45', '1.92',
  '↑', '↓', '◈', '❖', '0x7F', '0xA4', 'FXCM', 'OANDA',
  'WIB', 'UTC', '1H', '4H', '15M', '1D', 'BULL', 'BEAR'
];

/**
 * High-performance 60fps Matrix Data Stream Canvas
 * Renders an institutional digital rain overlay adapted for both Light and Dark themes.
 */
const MatrixDataRain: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const fontSize = 13;
    const columns = Math.floor(width / 32);
    // Track row position and fall speed for each column
    const drops = Array.from({ length: columns }, () => Math.random() * -60);
    const speeds = Array.from({ length: columns }, () => 0.55 + Math.random() * 0.75);

    let lastDraw = performance.now();

    const render = (time: number) => {
      // Throttle to ~35-40fps for high aesthetic feel and low CPU consumption
      if (time - lastDraw > 26) {
        lastDraw = time;

        // Soft trail background fade
        ctx.fillStyle = isDark ? 'rgba(6, 8, 15, 0.22)' : 'rgba(248, 250, 252, 0.28)';
        ctx.fillRect(0, 0, width, height);

        ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;

        for (let i = 0; i < drops.length; i++) {
          const text = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
          const x = i * 32 + 8;
          const y = drops[i] * fontSize;

          if (y > 0 && y < height + 40) {
            // Glowing head character
            ctx.fillStyle = isDark ? '#6EE7B7' : '#047857';
            ctx.shadowColor = isDark ? '#10B981' : 'transparent';
            ctx.shadowBlur = isDark ? 8 : 0;
            ctx.fillText(text, x, y);

            // Slightly dimmer trail behind head
            ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(13, 148, 136, 0.35)';
            ctx.shadowBlur = 0;
            ctx.fillText(text, x, y - fontSize * 1.4);
          }

          // Move down
          drops[i] += speeds[i];

          // Reset drop to top with randomized staggered delay
          if (drops[i] * fontSize > height && Math.random() > 0.96) {
            drops[i] = -Math.random() * 20;
            speeds[i] = 0.55 + Math.random() * 0.75;
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none opacity-45 sm:opacity-55 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_20%,#000_85%)] transition-opacity duration-300"
    />
  );
};

export const TerminalLaunchScreen: React.FC<TerminalLaunchScreenProps> = ({
  onComplete,
  userEmail,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [progress, setProgress] = useState<number>(14);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [telemetryHash, setTelemetryHash] = useState<string>('0x7A4F9C2B');
  const [activeCurrencyIndex, setActiveCurrencyIndex] = useState<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Micro-audio synthesizer with clean gain envelope
  const playSciFiTone = (freq: number, type: OscillatorType = 'sine', duration: number = 0.08) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio policy fallback
    }
  };

  // Play confirmation chord when finished
  const playSuccessChord = () => {
    if (!soundEnabled) return;
    try {
      playSciFiTone(523.25, 'triangle', 0.14); // C5
      setTimeout(() => playSciFiTone(659.25, 'triangle', 0.16), 70); // E5
      setTimeout(() => playSciFiTone(783.99, 'triangle', 0.22), 140); // G5
      setTimeout(() => playSciFiTone(1046.5, 'sine', 0.32), 210); // C6
    } catch {
      // Audio fallback
    }
  };

  // Dynamic telemetry hash & currency orbit ticker
  useEffect(() => {
    const hashInterval = setInterval(() => {
      const chars = '0123456789ABCDEF';
      let res = '0x';
      for (let i = 0; i < 8; i++) {
        res += chars[Math.floor(Math.random() * chars.length)];
      }
      setTelemetryHash(res);
      setActiveCurrencyIndex((prev) => (prev + 1) % CURRENCY_CODES.length);
    }, 125);

    return () => clearInterval(hashInterval);
  }, []);

  // Responsive boot sequence with fluid step pacing
  useEffect(() => {
    playSciFiTone(440, 'sine', 0.06);

    const t1 = setTimeout(() => {
      setCurrentStepIndex(1);
      setProgress(44);
      playSciFiTone(587.33, 'sine', 0.07);
    }, 340);

    const t2 = setTimeout(() => {
      setCurrentStepIndex(2);
      setProgress(76);
      playSciFiTone(698.46, 'sine', 0.08);
    }, 720);

    const t3 = setTimeout(() => {
      setCurrentStepIndex(3);
      setProgress(96);
      playSciFiTone(880.0, 'sine', 0.08);
    }, 1100);

    const t4 = setTimeout(() => {
      setCurrentStepIndex(4);
      setProgress(100);
      setIsFinishing(true);
      playSuccessChord();
    }, 1420);

    const finishTimer = setTimeout(() => {
      onComplete();
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.99, filter: 'blur(12px)' }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 font-sans select-none overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#06080F]/95 backdrop-blur-2xl' : 'bg-[#F8FAFC]/95 backdrop-blur-2xl'
      }`}
    >
      {/* 1. SUBTLE MATRIX DIGITAL RAIN OVERLAY */}
      <MatrixDataRain isDark={isDark} />

      {/* 2. OPTICAL RADAR SCANNING LASER LINE */}
      <motion.div
        animate={{ y: ['-10%', '110%'] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        className={`absolute inset-x-0 h-28 pointer-events-none opacity-20 [mask-image:linear-gradient(to_bottom,transparent,white,transparent)] ${
          isDark
            ? 'bg-gradient-to-b from-transparent via-cyan-400/30 to-emerald-400/20'
            : 'bg-gradient-to-b from-transparent via-emerald-600/25 to-teal-500/15'
        }`}
      />

      {/* 3. RADAR BACKGROUND WITH THEME-AWARE GRID & GYROSCOPE */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {/* Perspective Grid */}
        <div
          className={`absolute inset-0 bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] ${
            isDark
              ? 'bg-[linear-gradient(to_right,#ffffff07_1px,transparent_1px),linear-gradient(to_bottom,#ffffff07_1px,transparent_1px)] opacity-35'
              : 'bg-[linear-gradient(to_right,#0f172a08_1px,transparent_1px),linear-gradient(to_bottom,#0f172a08_1px,transparent_1px)] opacity-55'
          }`}
        />

        {/* Outer Gyroscope Ring with Degree Markings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          className={`absolute w-[620px] h-[620px] rounded-full border flex items-center justify-center ${
            isDark ? 'border-white/[0.05]' : 'border-slate-300/60'
          }`}
        >
          <span
            className={`absolute top-2 text-[9px] font-mono font-bold tracking-widest ${
              isDark ? 'text-zinc-600' : 'text-slate-400'
            }`}
          >
            RADAR 000°
          </span>
          <span
            className={`absolute bottom-2 text-[9px] font-mono font-bold tracking-widest ${
              isDark ? 'text-zinc-600' : 'text-slate-400'
            }`}
          >
            RADAR 180°
          </span>
          <span
            className={`absolute right-2 text-[9px] font-mono font-bold tracking-widest ${
              isDark ? 'text-zinc-600' : 'text-slate-400'
            }`}
          >
            090°
          </span>
          <span
            className={`absolute left-2 text-[9px] font-mono font-bold tracking-widest ${
              isDark ? 'text-zinc-600' : 'text-slate-400'
            }`}
          >
            270°
          </span>
        </motion.div>

        {/* Middle Dashed Ring Rotating Counter-Clockwise */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className={`absolute w-[470px] h-[470px] rounded-full border border-dashed ${
            isDark ? 'border-emerald-500/25' : 'border-emerald-600/30'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute top-0 left-1/2 -translate-x-1/2 shadow-[0_0_12px_#10B981]" />
        </motion.div>

        {/* Central Core Ambient Glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.32, 0.15],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-[380px] h-[380px] rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-400/15 to-transparent blur-3xl"
        />
      </div>

      {/* 4. MAIN HOLOGRAPHIC COCKPIT CARD */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`w-full max-w-xl rounded-3xl p-6 sm:p-8 relative z-10 space-y-6 backdrop-blur-xl transition-all duration-300 ${
          isDark
            ? 'bg-[#0B0F19]/90 border border-white/[0.12] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95),0_0_40px_rgba(16,185,129,0.06)]'
            : 'bg-white/95 border border-slate-200/90 shadow-[0_25px_70px_-15px_rgba(15,23,42,0.12),0_0_40px_rgba(16,185,129,0.08)]'
        }`}
      >
        {/* Top Telemetry Header & Audio Toggle */}
        <div
          className={`flex items-center justify-between border-b pb-4 transition-colors ${
            isDark ? 'border-white/[0.08]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Holographic Radar Core Emblem */}
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className={`absolute -inset-1.5 rounded-2xl border border-dashed ${
                  isDark ? 'border-emerald-400/40' : 'border-emerald-500/50'
                }`}
              />
              <div
                className={`relative w-12 h-12 rounded-xl border flex items-center justify-center shadow-inner overflow-hidden ${
                  isDark
                    ? 'bg-gradient-to-br from-[#181C28] to-[#0E1119] border-white/[0.14]'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200 shadow-xs'
                }`}
              >
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-7 h-7 relative z-10"
                >
                  <path
                    d="M7 21L17 11L21 15L27 9"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 9H27V15"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 11L11 17L15 13L25 23"
                    stroke={isDark ? '#94A3B8' : '#64748B'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity="0.8"
                  />
                  <circle cx="16" cy="14" r="1.5" fill="#10B981" />
                </svg>
              </div>
            </div>

            <div className="text-left space-y-0.5">
              <div className="flex items-center gap-2">
                <h2
                  className={`text-base sm:text-lg font-bold tracking-tight font-[family-name:var(--font-display)] ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Currency Strength Cockpit
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>SYS 2.8</span>
                </span>
              </div>
              <p
                className={`text-xs font-mono truncate max-w-[280px] ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}
              >
                {userEmail ? `ID: ${userEmail}` : 'Terminal Workspace Auto-Launcher'}
              </p>
            </div>
          </div>

          {/* Sound FX Toggle & Status */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Matikan Suara Audio HUD' : 'Aktifkan Suara Audio HUD'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                soundEnabled
                  ? isDark
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                  : isDark
                  ? 'bg-zinc-900 border-white/[0.08] text-zinc-500 hover:text-zinc-300'
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <div className="text-right font-mono hidden sm:block">
              <div
                className={`text-[10px] uppercase tracking-widest ${
                  isDark ? 'text-zinc-500' : 'text-slate-400'
                }`}
              >
                Kondisi
              </div>
              <div
                className={`text-xs font-bold flex items-center gap-1.5 justify-end ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>{isFinishing ? 'READY' : 'STREAMING'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. 8-CURRENCY MATRIX RIBBON */}
        <div
          className={`border rounded-2xl p-3 space-y-2 transition-colors ${
            isDark ? 'bg-[#0E1322] border-white/[0.07]' : 'bg-slate-50 border-slate-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span
              className={`flex items-center gap-1.5 ${
                isDark ? 'text-zinc-400' : 'text-slate-600'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verifikasi 8 Mata Uang Mayor:</span>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px] tracking-wider font-semibold">
              HASH: {telemetryHash}
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1.5 pt-0.5">
            {CURRENCY_CODES.map((code, idx) => {
              const conf = CURRENCIES[code] || getCurrencyConfig(code);
              const isPulsing = activeCurrencyIndex === idx;

              return (
                <div
                  key={code}
                  className={`py-1.5 px-1 rounded-lg border text-center transition-all duration-150 ${
                    isPulsing
                      ? isDark
                        ? 'bg-emerald-500/25 border-emerald-400 text-white scale-105 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                        : 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold scale-105 shadow-[0_2px_8px_rgba(16,185,129,0.25)]'
                      : isDark
                      ? 'bg-zinc-900/60 border-white/[0.06] text-zinc-400'
                      : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="text-xs">{conf?.flag || '🌐'}</div>
                  <div className="text-[10px] font-mono font-bold mt-0.5">{code}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. PROGRESS BAR & STATUS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span
              className={`flex items-center gap-2 ${
                isDark ? 'text-zinc-300' : 'text-slate-700'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>Matrix Data-Feed Crossover Sync</span>
            </span>
            <span
              className={`font-mono font-bold tabular-nums text-sm ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {progress}%
            </span>
          </div>

          {/* Futuristic Shimmer Progress Track */}
          <div
            className={`w-full h-2.5 rounded-full overflow-hidden p-0.5 relative border ${
              isDark
                ? 'bg-zinc-900/90 border-white/[0.08]'
                : 'bg-slate-100 border-slate-200 shadow-inner'
            }`}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-full shadow-[0_0_14px_rgba(52,211,153,0.5)] relative"
              initial={{ width: '12%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {/* Animated Light Sweep Beam */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/70 to-transparent"
              />
            </motion.div>
          </div>
        </div>

        {/* 7. TACTICAL CHECKLIST WITH DYNAMIC METRICS */}
        <div className="space-y-2 pt-1 font-mono text-xs">
          {LAUNCH_STEPS.map((step, idx) => {
            const isCompleted = currentStepIndex > idx || progress === 100;
            const isActive = currentStepIndex === idx && progress < 100;

            return (
              <motion.div
                key={step.code}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.25 }}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  isCompleted
                    ? isDark
                      ? 'bg-emerald-500/[0.06] border-emerald-500/25 text-zinc-200'
                      : 'bg-emerald-50/80 border-emerald-200 text-slate-800'
                    : isActive
                    ? isDark
                      ? 'bg-white/[0.05] border-white/20 text-white shadow-sm'
                      : 'bg-slate-100/90 border-slate-300 text-slate-900 shadow-2xs'
                    : isDark
                    ? 'bg-transparent border-transparent text-zinc-600'
                    : 'bg-transparent border-transparent text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    </motion.div>
                  ) : isActive ? (
                    <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <div
                      className={`w-4 h-4 rounded-full border shrink-0 ${
                        isDark ? 'border-zinc-800' : 'border-slate-300'
                      }`}
                    />
                  )}

                  <span className="truncate">{step.label}</span>
                </div>

                <span
                  className={`text-[11px] font-mono shrink-0 ml-2 ${
                    isCompleted
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : isActive
                      ? isDark
                        ? 'text-zinc-300'
                        : 'text-slate-700'
                      : isDark
                      ? 'text-zinc-700'
                      : 'text-slate-400'
                  }`}
                >
                  {isCompleted ? step.metric : isActive ? 'CALIBRATING...' : 'QUEUED'}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* 8. FOOTER WITH INSTANT SKIP ACTION */}
        <div
          className={`pt-2 flex items-center justify-between text-[11px] font-mono border-t ${
            isDark
              ? 'text-zinc-500 border-white/[0.06]'
              : 'text-slate-500 border-slate-200'
          }`}
        >
          <div
            className={`flex items-center gap-1.5 ${
              isDark ? 'text-zinc-400' : 'text-slate-600'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5 text-emerald-500" />
            <span>Mode: WebSocket Liquidity Stream</span>
          </div>

          <button
            onClick={onComplete}
            className={`transition-colors cursor-pointer flex items-center gap-1 group py-1 px-2.5 rounded-lg ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <span>Lewati boot</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
