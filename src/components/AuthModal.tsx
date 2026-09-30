import React, { useState } from 'react';
import { X, Lock, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { loginWithGoogle } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await loginWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Jendela login ditutup sebelum selesai.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Pop-up browser diblokir. Izinkan pop-up untuk melanjutkan.');
      } else {
        setErrorMsg(err.message || 'Gagal masuk dengan Google. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#0D1017] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-[#11141E]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-zinc-900 border border-slate-300 dark:border-white/[0.1] flex items-center justify-center text-slate-800 dark:text-white shadow-xs">
              <Lock className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
                Akses Meja Kerja Terminal
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                Autentikasi Diperlukan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Masuk dengan akun Google Anda untuk membuka akses streaming real-time, menyimpan preferensi, dan mengaktifkan notifikasi alarm.
            </p>
          </div>

          {/* Benefits */}
          <div className="bg-slate-50 dark:bg-[#121520] border border-slate-200 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2 text-xs text-slate-700 dark:text-zinc-300 font-mono">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Akses live streaming 28 pasangan silang & grafik TradingView.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Simpan aturan alarm (Alert Rules) di Firebase Firestore pribadi.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-slate-400 dark:text-zinc-400 shrink-0 mt-0.5" />
              <span>Sinkronisasi otomatis preferensi multi-timeframe di semua perangkat.</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-white dark:border-white/10 font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2.5 text-xs sm:text-sm disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{loading ? 'Menghubungkan...' : 'Lanjutkan dengan Google'}</span>
          </button>

          <p className="text-[11px] text-center text-slate-500 dark:text-zinc-500 font-mono">
            Keamanan akun terproteksi dengan enkripsi Firebase Authentication.
          </p>
        </div>
      </div>
    </div>
  );
};
