import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Terminal,
  Cloud,
  Send,
  HelpCircle,
  FileCode,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Cpu,
  Layers,
} from 'lucide-react';
import { FLOW_MONITOR_PINE_SCRIPT } from '../data/flowMonitorPineScript';
import { FLOW_MONITOR_WORKER_SCRIPT } from '../data/flowMonitorWorkerScript';

interface PineScriptWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerUrl: string;
  onUpdateWorkerUrl?: (url: string) => void;
}

export const PineScriptWebhookModal: React.FC<PineScriptWebhookModalProps> = ({
  isOpen,
  onClose,
  workerUrl,
  onUpdateWorkerUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'pinescript' | 'worker' | 'test' | 'guide'>('pinescript');
  const [copiedPine, setCopiedPine] = useState(false);
  const [copiedWorker, setCopiedWorker] = useState(false);
  const [testUrl, setTestUrl] = useState(workerUrl || 'https://flowmonitor.aideelyst.workers.dev');
  const [apiKeyInput, setApiKeyInput] = useState('fm_secret_key');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  if (!isOpen) return null;

  const PINE_SCRIPT_CODE = FLOW_MONITOR_PINE_SCRIPT;

  const WORKER_SCRIPT_CODE = FLOW_MONITOR_WORKER_SCRIPT;

  const copyToClipboard = (text: string, type: 'pine' | 'worker') => {
    navigator.clipboard.writeText(text);
    if (type === 'pine') {
      setCopiedPine(true);
      setTimeout(() => setCopiedPine(false), 2000);
    } else {
      setCopiedWorker(true);
      setTimeout(() => setCopiedWorker(false), 2000);
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const runWebhookTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const payload = {
        time: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        mode: 'PineScript 15 Prime',
        source: 'simulator_test',
        crypto: [
          { pair: 'BTC', pct: 2.15, price: 65420.5, dir: 'LONG' },
          { pair: 'ETH', pct: 1.84, price: 3480.2, dir: 'LONG' },
          { pair: 'SOL', pct: 4.20, price: 152.4, dir: 'LONG' },
          { pair: 'BNB', pct: 0.75, price: 588.1, dir: 'LONG' },
          { pair: 'XRP', pct: -0.45, price: 0.582, dir: 'SHORT' },
        ],
        metals: [
          { pair: 'GOLD', pct: 0.95, price: 2655.4, dir: 'LONG' },
          { pair: 'SILVER', pct: 1.40, price: 31.85, dir: 'LONG' },
          { pair: 'USOIL', pct: -0.80, price: 71.4, dir: 'SHORT' },
          { pair: 'UKOIL', pct: -0.65, price: 75.2, dir: 'SHORT' },
          { pair: 'NATGAS', pct: 1.20, price: 2.78, dir: 'LONG' },
        ],
        inst: [
          { pair: 'US500', pct: 0.45, price: 5740.2, dir: 'LONG' },
          { pair: 'NAS100', pct: 0.65, price: 20080.5, dir: 'LONG' },
          { pair: 'US30', pct: 0.30, price: 42250.0, dir: 'LONG' },
          { pair: 'GER40', pct: 0.20, price: 19180.0, dir: 'LONG' },
          { pair: 'JP225', pct: -0.35, price: 38850.0, dir: 'SHORT' },
        ],
      };

      const targetUrl = testUrl.trim().replace(/\/$/, '');
      const endpoint = `${targetUrl}/fm${apiKeyInput ? `?key=${encodeURIComponent(apiKeyInput)}` : ''}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKeyInput,
        },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      let resJson;
      try {
        resJson = JSON.parse(resText);
      } catch {
        resJson = resText;
      }

      setTestResult(
        JSON.stringify(
          {
            httpStatus: res.status,
            statusText: res.statusText,
            response: resJson,
          },
          null,
          2
        )
      );

      if (res.ok && onUpdateWorkerUrl) {
        onUpdateWorkerUrl(targetUrl);
      }
    } catch (err: any) {
      setTestResult(
        JSON.stringify(
          {
            error: 'Webhook request failed',
            message: err.message,
            hint: 'Pastikan Worker URL mengizinkan CORS dan mendukung POST /fm atau POST /webhook',
          },
          null,
          2
        )
      );
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>TradingView Pine Script v6 & Cloudflare Webhook</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">
                  15 Prime Assets
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sinyal otomatis 5 Indeks Teratas, 5 Crypto Teratas, dan 5 Komoditas Teratas (15 security calls aman, payload tunggal).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-5 pt-3 border-b border-zinc-200 dark:border-white/[0.08] gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pinescript')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'pinescript'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>TradingView Pine Script v6 (15 Prime)</span>
          </button>

          <button
            onClick={() => setActiveTab('worker')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'worker'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloudflare Worker Webhook</span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'test'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Uji Coba Webhook (Simulator)</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'guide'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Panduan Deployment & Setup</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'pinescript' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    Script ini menghitung Rate of Change (ROC), menyusun Top Rankings Crypto, Emas/Minyak, & Forex, serta mengirim webhook JSON ke Cloudflare secara otomatis tiap penutupan candle.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(PINE_SCRIPT_CODE, 'pine')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    {copiedPine ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPine ? 'Tersalin!' : 'Salin Pine Script'}</span>
                  </button>
                  <button
                    onClick={() => downloadFile('flowmonitor.pine', PINE_SCRIPT_CODE)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh .pine</span>
                  </button>
                </div>
              </div>

              <div className="relative rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-300 max-h-[50vh] overflow-y-auto">
                <pre>{PINE_SCRIPT_CODE}</pre>
              </div>
            </div>
          )}

          {activeTab === 'worker' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
                  <Cloud className="w-4 h-4 shrink-0 text-orange-500" />
                  <span>
                    Cloudflare Worker ini menerima webhook TradingView, menghitung counter streak sustained momentum, meneruskan ke Telegram Bot, dan melayani API <code>/latest</code> & <code>/history</code> untuk web app ini.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(WORKER_SCRIPT_CODE, 'worker')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    {copiedWorker ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWorker ? 'Tersalin!' : 'Salin Worker Code'}</span>
                  </button>
                  <button
                    onClick={() => downloadFile('cloudflare-worker.js', WORKER_SCRIPT_CODE)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh .js</span>
                  </button>
                </div>
              </div>

              <div className="relative rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-300 max-h-[50vh] overflow-y-auto">
                <pre>{WORKER_SCRIPT_CODE}</pre>
              </div>
            </div>
          )}

          {activeTab === 'test' && (
            <div className="space-y-5">
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-900 dark:text-cyan-200">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <Terminal className="w-4 h-4 text-cyan-500" />
                  <span>Uji Coba Pengiriman Payload Webhook TradingView</span>
                </div>
                <p>
                  Kirim simulasi sinyal snapshot (Crypto, Emas, Forex, Context) ke Cloudflare Worker Anda untuk memverifikasi endpoint <code>POST /fm</code> dan CORS berjalan dengan sempurna.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Cloudflare Worker URL
                  </label>
                  <input
                    type="url"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://your-worker.yourname.workers.dev"
                    className="w-full px-3 py-2 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-white/[0.1] rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    API Key / Secret (Opsional)
                  </label>
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="fm_secret_key"
                    className="w-full px-3 py-2 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-white/[0.1] rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={runWebhookTest}
                  disabled={testLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {testLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{testLoading ? 'Mengirim Payload...' : 'Kirim Simulasi Webhook'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTestUrl('/api/flow-monitor')}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 underline cursor-pointer"
                >
                  Gunakan Backend Proxy Lokal (/api/flow-monitor)
                </button>
              </div>

              {testResult && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>Hasil Respon Webhook:</span>
                  </div>
                  <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
                    {testResult}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {/* Step 1 */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/[0.08] rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs">
                    1
                  </span>
                  <span>Deploy Cloudflare Worker Webhook</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 pl-2">
                  <li>Buka dashboard Cloudflare di <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-orange-500 underline inline-flex items-center gap-0.5">dash.cloudflare.com <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Pilih menu <b>Workers & Pages</b> &rarr; <b>Create application</b> &rarr; <b>Create Worker</b>.</li>
                  <li>Klik <b>Quick Edit</b>, hapus kode bawaan, lalu paste kode dari tab <b>Cloudflare Worker Webhook</b> di atas.</li>
                  <li>Klik <b>Save and Deploy</b>. Worker Anda sekarang aktif dengan URL seperti <code>https://flowmonitor.username.workers.dev</code>.</li>
                  <li><i>(Opsional)</i> Tambahkan KV Namespace bernama <code>FM</code> di Settings &rarr; Variables &rarr; KV Namespace Bindings jika ingin data tersimpan permanen.</li>
                </ol>
              </div>

              {/* Step 2 */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/[0.08] rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                    2
                  </span>
                  <span>Pasang Pine Script di TradingView</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 pl-2">
                  <li>Buka chart di TradingView (rekomendasi: pair apapun di timeframe 1 Jam / 15 Menit).</li>
                  <li>Buka tab <b>Pine Editor</b> di bagian bawah layar.</li>
                  <li>Paste kode dari tab <b>TradingView Pine Script v5</b> di atas.</li>
                  <li>Klik <b>Add to chart</b> (Tambahkan ke grafik). Tabel HUD Top Momentum akan langsung muncul di chart!</li>
                </ol>
              </div>

              {/* Step 3 */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/[0.08] rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  <span className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xs">
                    3
                  </span>
                  <span>Buat Alert Webhook di TradingView</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 pl-2">
                  <li>Klik tombol <b>Create Alert</b> (ikon lonceng dengan tanda tambah).</li>
                  <li>Pilih Condition: <b>Flow Monitor - Multi-Asset Momentum & Webhook</b> &rarr; <i>Any alert() function call</i>.</li>
                  <li>Centang tab <b>Notifications</b> &rarr; aktifkan <b>Webhook URL</b>.</li>
                  <li>Masukkan URL Worker Anda: <code>https://your-worker.workers.dev/fm?key=fm_secret_key</code>.</li>
                  <li>Klik <b>Create</b>. Selesai! TradingView akan otomatis mengirim snapshot ke Cloudflare Worker setiap kali candle ditutup.</li>
                </ol>
              </div>

              {/* Step 4 */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/[0.08] rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                    4
                  </span>
                  <span>Hubungkan Worker ke Web App Ini</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Di header Flow Monitor, klik tombol <b>Pengaturan Endpoint</b> (ikon gear) &rarr; masukkan URL Worker Anda. Aplikasi akan langsung membaca data live langsung dari webhook Cloudflare Worker Anda!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 text-xs">
          <div className="flex items-center gap-2 text-zinc-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Mendukung Pine Script v5 & Cloudflare Workers Runtime V8</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
