import React, { useState } from 'react';
import { X, BookOpen, Layers, BarChart2, TrendingUp, HelpCircle } from 'lucide-react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({ isOpen, onClose }) => {
  const [lang, setLang] = useState<'id' | 'en'>('id');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-[#0d121f] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090d16]">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'id' ? 'Panduan & Metodologi Currency Strength' : 'Currency Strength Guide & Methodology'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-xs font-mono">
              <button
                onClick={() => setLang('id')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  lang === 'id'
                    ? 'bg-white text-cyan-700 shadow-xs dark:bg-slate-800 dark:text-cyan-300 font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                ID
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  lang === 'en'
                    ? 'bg-white text-cyan-700 shadow-xs dark:bg-slate-800 dark:text-cyan-300 font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                EN
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {lang === 'id' ? (
            <>
              {/* Indonesian Guide */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                  <BarChart2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <h4>Apa itu Currency Strength Meter?</h4>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Dalam pasar Forex, setiap transaksi melibatkan dua mata uang (pasangan mata uang / currency pair).
                  Ketika <strong className="text-slate-900 dark:text-white">EUR/USD</strong> naik, kita tidak langsung tahu apakah Euro yang sedang menguat pesat,
                  atau Dollar AS yang sedang melemah drastis.
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  <strong className="text-cyan-600 dark:text-cyan-400">Currency Strength</strong> mengisolasi kekuatan masing-masing dari <strong className="text-slate-900 dark:text-white">8 mata uang utama</strong> (USD, EUR, GBP, JPY, CHF, AUD, CAD, NZD) dengan menghitung performa rata-rata terhadap 7 mata uang lainnya secara simultan.
                </p>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                  <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <h4>Formula Perhitungan 28 Pasangan Mata Uang</h4>
                </div>
                <div className="bg-slate-50 dark:bg-[#090d16] p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-1.5 text-slate-700 dark:text-slate-400">
                  <div className="text-cyan-700 dark:text-cyan-300 font-bold mb-1">
                    Skor(Mata Uang X) = Baseline(5.0) + [Rata-rata Δ% Performansi vs 7 Pasangan Lain] × Skala
                  </div>
                  <div>• 8 Mata Uang menghasilkan 28 pasangan silang (cross-pairs).</div>
                  <div>• Skala normalisasi: <strong className="text-slate-900 dark:text-white">0.0 hingga 10.0</strong>.</div>
                  <div>• Garis Netral: <strong className="text-slate-900 dark:text-white">5.0</strong>.</div>
                  <div>• Zona Bullish Kuat: <strong className="text-emerald-600 dark:text-emerald-400">&gt; 7.0</strong> (Arus modal masuk deras).</div>
                  <div>• Zona Bearish Lemah: <strong className="text-rose-600 dark:text-rose-400">&lt; 3.0</strong> (Arus modal keluar tinggi).</div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4>Strategi Trading: Flow Divergence</h4>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Prinsip emas dalam perdagangan mata uang adalah:
                </p>
                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40 rounded-xl text-cyan-900 dark:text-cyan-200 font-medium">
                  &ldquo;Beli mata uang terkuat (Strongest) dan jual mata uang terlemah (Weakest).&rdquo;
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Contoh: Jika skor <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">USD = 8.4</span> (Sangat Kuat) dan skor <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">JPY = 1.8</span> (Sangat Lemah):
                  Maka pasangan <strong className="text-slate-900 dark:text-white">USD/JPY</strong> memiliki divergensi <strong className="text-emerald-600 dark:text-emerald-400">+6.6</strong>. Ini menghasilkan setup probabilitas tertinggi untuk posisi <strong>BUY / LONG</strong> karena aliran dana berpindah secara masif dari Yen ke Dollar AS.
                </p>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                  <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h4>Fitur Interaktif</h4>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-xs">
                  <li><strong className="text-slate-900 dark:text-slate-200">Interactive Line Chart:</strong> Arahkan kursor ke grafik untuk melihat crosshair instan dan nilai semua mata uang pada detik tersebut.</li>
                  <li><strong className="text-slate-900 dark:text-slate-200">Solo / Filter:</strong> Klik ganda mata uang untuk mengisolasi grafiknya sendiri, atau klik tombol centang untuk menyembunyikan/menampilkan.</li>
                  <li><strong className="text-slate-900 dark:text-slate-200">Multi-Timeframe Matrix:</strong> Cari keselarasan tren lintas 5M, 15M, 1H, 4H, 1D, 1W. Tren paling kuat terjadi jika minimal 4-5 timeframe searah.</li>
                  <li><strong className="text-slate-900 dark:text-slate-200">Alert Manager:</strong> Pasang notifikasi bunyi ketika mata uang menembus ambang batas ekstrem.</li>
                </ul>
              </section>
            </>
          ) : (
            <>
              {/* English Guide */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                  <BarChart2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <h4>What is a Currency Strength Meter?</h4>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  In Forex, currencies always trade in pairs. When <strong className="text-slate-900 dark:text-white">EUR/USD</strong> climbs, it is ambiguous whether the Euro is gaining strong buying momentum or the US Dollar is experiencing broad sell-offs across the globe.
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  <strong className="text-cyan-600 dark:text-cyan-400">Currency Strength</strong> isolates the true individual power of each of the <strong className="text-slate-900 dark:text-white">8 major currencies</strong> (USD, EUR, GBP, JPY, CHF, AUD, CAD, NZD) by measuring its simultaneous performance against the other 7 currencies.
                </p>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                  <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <h4>The 28 Pairs Cross-Matrix Algorithm</h4>
                </div>
                <div className="bg-slate-50 dark:bg-[#090d16] p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-1.5 text-slate-700 dark:text-slate-400">
                  <div className="text-cyan-700 dark:text-cyan-300 font-bold mb-1">
                    Score(Currency X) = Baseline(5.0) + [Avg Δ% Performance vs 7 Cross-Pairs] × Scale
                  </div>
                  <div>• 8 currencies produce 28 unique non-redundant cross pairs.</div>
                  <div>• Normalized scale: <strong className="text-slate-900 dark:text-white">0.0 to 10.0</strong>.</div>
                  <div>• Neutral equilibrium line: <strong className="text-slate-900 dark:text-white">5.0</strong>.</div>
                  <div>• Strong Bullish Zone: <strong className="text-emerald-600 dark:text-emerald-400">&gt; 7.0</strong> (High net capital inflow).</div>
                  <div>• Strong Bearish Zone: <strong className="text-rose-600 dark:text-rose-400">&lt; 3.0</strong> (High net capital outflow).</div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4>Core Strategy: Capital Flow Divergence</h4>
                </div>
                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40 rounded-xl text-cyan-900 dark:text-cyan-200 font-medium">
                  &ldquo;Pair the strongest currency against the weakest currency to trade with maximum momentum edge.&rdquo;
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  For example: If <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">EUR = 8.5</span> (Strong Bullish) and <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">JPY = 1.9</span> (Strong Bearish):
                  The pair <strong className="text-slate-900 dark:text-white">EUR/JPY</strong> offers an exceptional divergence edge of <strong className="text-emerald-600 dark:text-emerald-400">+6.6</strong> for a <strong>STRONG BUY</strong> position.
                </p>
              </section>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-[#090d16] border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            {lang === 'id' ? 'Mengerti' : 'Got It'}
          </button>
        </div>
      </div>
    </div>
  );
};
