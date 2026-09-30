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

  const PINE_SCRIPT_CODE = `//@version=6
// ══════════════════════════════════════════════════════════════════════════════
// Indicator: Arah Market & Flow Monitor — TV Edge Sync (Indeks, Komoditas & Crypto)
// Focus: Khusus Data Indeks Ekuitas & Makro, Komoditas/Energi/Logam, dan Top Crypto
// Catatan: Forex tidak disertakan karena sudah menggunakan modul Currency Strength
// Total Aset: Tepat 40 Prime Assets (Aman 100% dari limit TradingView max 40 request calls)
// ══════════════════════════════════════════════════════════════════════════════

indicator("Arah Market & Flow Monitor — Macro, Commodity & Crypto (40 Prime)", shorttitle="FlowMonitor Macro/Comm/Crypto", overlay = false, max_bars_back = 500)

// ── 1. INPUTS & CONFIGURATIONS ──
grp_feed     = "── Category Feeds & Webhook Dispatch ──"
send_macro   = input.bool(true, "Kirim Indeks Ekuitas & Makro (11 Aset)", group = grp_feed)
send_metals  = input.bool(true, "Kirim Komoditas, Logam & Energi (9 Aset)", group = grp_feed)
send_crypto1 = input.bool(true, "Kirim Crypto Tier 1 (10 Koin Teratas)", group = grp_feed)
send_crypto2 = input.bool(true, "Kirim Crypto Tier 2 & AI/High Beta (10 Koin)", group = grp_feed)

grp_alert    = "── Alert Trigger Mode ──"
trigger_mode = input.string("Once Per Bar Close", "Webhook Frequency", options = ["Once Per Bar Close", "Realtime / Every Tick"], group = grp_alert)
show_hud     = input.bool(true, "Tampilkan Tabel On-Chart HUD Summary", group = grp_alert)

// ── 2. DATA EXTRACTION FUNCTION (PRICE + ROC + EMA20) ──
f_data(sym) =>
    [c, o, h, l, v, c1, ema20] = request.security(sym, timeframe.period, [close, open, high, low, volume, close[1], ta.ema(close, 20)], barmerge.gaps_off, barmerge.lookahead_off)
    chg = c1 != 0 ? math.round(((c - c1) / c1) * 10000) / 100 : 0.0
    [c, o, h, l, v, chg, ema20]

f_item(pair, src, c, o, h, l, v, chg, ema20) =>
    '{"p":"' + pair + '","c":' + str.tostring(c) + ',"o":' + str.tostring(o) + ',"h":' + str.tostring(h) + ',"l":' + str.tostring(l) + ',"v":' + str.tostring(v) + ',"chg":' + str.tostring(chg, "#.##") + ',"ema20":' + str.tostring(ema20, "#.####") + ',"src":"' + src + '"}'

// ── 3. FETCH 40 PRIME ASSETS (11 INDEKS + 9 KOMODITAS + 20 CRYPTO = 40 CALLS) ──

// --- A. INDEKS EKUITAS GLOBAL & BENCHMARK MAKRO (11 Aset) ---
[spxC,   spxO,   spxH,   spxL,   spxV,   spxChg,   spxEma]   = f_data("OANDA:SPX500USD")  // US500 S&P 500
[nsxC,   nsxO,   nsxH,   nsxL,   nsxV,   nsxChg,   nsxEma]   = f_data("OANDA:NAS100USD")  // US100 Nasdaq
[djiC,   djiO,   djiH,   djiL,   djiV,   djiChg,   djiEma]   = f_data("OANDA:US30USD")    // US30 Dow Jones
[rutC,   rutO,   rutH,   rutL,   rutV,   rutChg,   rutEma]   = f_data("OANDA:US2000USD")  // US2000 Russell 2000
[daxC,   daxO,   daxH,   daxL,   daxV,   daxChg,   daxEma]   = f_data("OANDA:DE40EUR")    // GER40 DAX Germany
[ftseC,  ftseO,  ftseH,  ftseL,  ftseV,  ftseChg,  ftseEma]  = f_data("OANDA:UK100GBP")   // UK100 FTSE London
[n225C,  n225O,  n225H,  n225L,  n225V,  n225Chg,  n225Ema]  = f_data("OANDA:JP225USD")   // JP225 Nikkei Tokyo
[hsiC,   hsiO,   hsiH,   hsiL,   hsiV,   hsiChg,   hsiEma]   = f_data("OANDA:HK33HKD")    // HK33 Hang Seng
[dxyC,   dxyO,   dxyH,   dxyL,   dxyV,   dxyChg,   dxyEma]   = f_data("TVC:DXY")          // DXY Dollar Index
[us10yC, us10yO, us10yH, us10yL, us10yV, us10yChg, us10yEma] = f_data("TVC:US10Y")        // US10Y 10Y Yield
[vixC,   vixO,   vixH,   vixL,   vixV,   vixChg,   vixEma]   = f_data("TVC:VIX")          // VIX Market Fear Index

// --- B. KOMODITAS, LOGAM MULIA & ENERGI (9 Aset) ---
[xauC, xauO, xauH, xauL, xauV, xauChg, xauEma] = f_data("OANDA:XAUUSD") // Emas / Gold
[xagC, xagO, xagH, xagL, xagV, xagChg, xagEma] = f_data("OANDA:XAGUSD") // Perak / Silver
[xptC, xptO, xptH, xptL, xptV, xptChg, xptEma] = f_data("OANDA:XPTUSD") // Platinum
[copC, copO, copH, copL, copV, copChg, copEma] = f_data("TVC:COPPER")    // Tembaga / High Grade Copper
[oilC, oilO, oilH, oilL, oilV, oilChg, oilEma] = f_data("TVC:USOIL")     // Minyak WTI Crude
[bcoC, bcoO, bcoH, bcoL, bcoV, bcoChg, bcoEma] = f_data("TVC:UKOIL")     // Minyak Brent Crude
[gasC, gasO, gasH, gasL, gasV, gasChg, gasEma] = f_data("TVC:NATGAS")    // Gas Alam Henry Hub
[aliC, aliO, aliH, aliL, aliV, aliChg, aliEma] = f_data("TVC:ALUMINUM")  // Logam Aluminium
[whtC, whtO, whtH, whtL, whtV, whtChg, whtEma] = f_data("TVC:WHEAT")     // Gandum US Wheat

// --- C. TOP CRYPTOCURRENCIES TIER 1 (10 Koin Teratas) ---
[btcC,  btcO,  btcH,  btcL,  btcV,  btcChg,  btcEma]  = f_data("BINANCE:BTCUSDT")
[ethC,  ethO,  ethH,  ethL,  ethV,  ethChg,  ethEma]  = f_data("BINANCE:ETHUSDT")
[solC,  solO,  solH,  solL,  solV,  solChg,  solEma]  = f_data("BINANCE:SOLUSDT")
[bnbC,  bnbO,  bnbH,  bnbL,  bnbV,  bnbChg,  bnbEma]  = f_data("BINANCE:BNBUSDT")
[xrpC,  xrpO,  xrpH,  xrpL,  xrpV,  xrpChg,  xrpEma]  = f_data("BINANCE:XRPUSDT")
[dogeC, dogeO, dogeH, dogeL, dogeV, dogeChg, dogeEma] = f_data("BINANCE:DOGEUSDT")
[adaC,  adaO,  adaH,  adaL,  adaV,  adaChg,  adaEma]  = f_data("BINANCE:ADAUSDT")
[avaxC, avaxO, avaxH, avaxL, avaxV, avaxChg, avaxEma] = f_data("BINANCE:AVAXUSDT")
[suiC,  suiO,  suiH,  suiL,  suiV,  suiChg,  suiEma]  = f_data("BINANCE:SUIUSDT")
[linkC, linkO, linkH, linkL, linkV, linkChg, linkEma] = f_data("BINANCE:LINKUSDT")

// --- D. TOP CRYPTOCURRENCIES TIER 2 & AI / ECOSYSTEM (10 Koin) ---
[nearC, nearO, nearH, nearL, nearV, nearChg, nearEma] = f_data("BINANCE:NEARUSDT")
[aptC,  aptO,  aptH,  aptL,  aptV,  aptChg,  aptEma]  = f_data("BINANCE:APTUSDT")
[pepeC, pepeO, pepeH, pepeL, pepeV, pepeChg, pepeEma] = f_data("BINANCE:PEPEUSDT")
[ltcC,  ltcO,  ltcH,  ltcL,  ltcV,  ltcChg,  ltcEma]  = f_data("BINANCE:LTCUSDT")
[dotC,  dotO,  dotH,  dotL,  dotV,  dotChg,  dotEma]  = f_data("BINANCE:DOTUSDT")
[rndrC, rndrO, rndrH, rndrL, rndrV, rndrChg, rndrEma] = f_data("BINANCE:RENDERUSDT")
[fetC,  fetO,  fetH,  fetL,  fetV,  fetChg,  fetEma]  = f_data("BINANCE:FETUSDT")
[injC,  injO,  injH,  injL,  injV,  injChg,  injEma]  = f_data("BINANCE:INJUSDT")
[shibC, shibO, shibH, shibL, shibV, shibChg, shibEma] = f_data("BINANCE:SHIBUSDT")
[taoC,  taoO,  taoH,  taoL,  taoV,  taoChg,  taoEma]  = f_data("BINANCE:TAOUSDT")

tf = timeframe.period

// ── 4. PAYLOADS BUILDER (STRUCTURED JSON CHUNKS) ──

// 1. Indeks Ekuitas & Makro (11 Aset)
macroPayload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"macro","data":[' +
     f_item("US500",  "OANDA:SPX500USD",  spxC,   spxO,   spxH,   spxL,   spxV,   spxChg,   spxEma)   + ',' +
     f_item("US100",  "OANDA:NAS100USD",  nsxC,   nsxO,   nsxH,   nsxL,   nsxV,   nsxChg,   nsxEma)   + ',' +
     f_item("US30",   "OANDA:US30USD",    djiC,   djiO,   djiH,   djiL,   djiV,   djiChg,   djiEma)   + ',' +
     f_item("US2000", "OANDA:US2000USD",  rutC,   rutO,   rutH,   rutL,   rutV,   rutChg,   rutEma)   + ',' +
     f_item("GER40",  "OANDA:DE40EUR",    daxC,   daxO,   daxH,   daxL,   daxV,   daxChg,   daxEma)   + ',' +
     f_item("UK100",  "OANDA:UK100GBP",   ftseC,  ftseO,  ftseH,  ftseL,  ftseV,  ftseChg,  ftseEma)  + ',' +
     f_item("JP225",  "OANDA:JP225USD",   n225C,  n225O,  n225H,  n225L,  n225V,  n225Chg,  n225Ema)  + ',' +
     f_item("HK33",   "OANDA:HK33HKD",    hsiC,   hsiO,   hsiH,   hsiL,   hsiV,   hsiChg,   hsiEma)   + ',' +
     f_item("DXY",    "TVC:DXY",          dxyC,   dxyO,   dxyH,   dxyL,   dxyV,   dxyChg,   dxyEma)   + ',' +
     f_item("US10Y",  "TVC:US10Y",        us10yC, us10yO, us10yH, us10yL, us10yV, us10yChg, us10yEma) + ',' +
     f_item("VIX",    "TVC:VIX",          vixC,   vixO,   vixH,   vixL,   vixV,   vixChg,   vixEma)   +
     ']}'

// 2. Komoditas, Logam Mulia & Energi (9 Aset)
metalsPayload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"metals","data":[' +
     f_item("XAUUSD",   "OANDA:XAUUSD",   xauC, xauO, xauH, xauL, xauV, xauChg, xauEma) + ',' +
     f_item("XAGUSD",   "OANDA:XAGUSD",   xagC, xagO, xagH, xagL, xagV, xagChg, xagEma) + ',' +
     f_item("XPTUSD",   "OANDA:XPTUSD",   xptC, xptO, xptH, xptL, xptV, xptChg, xptEma) + ',' +
     f_item("COPPER",   "TVC:COPPER",     copC, copO, copH, copL, copV, copChg, copEma) + ',' +
     f_item("USOIL",    "TVC:USOIL",      oilC, oilO, oilH, oilL, oilV, oilChg, oilEma) + ',' +
     f_item("UKOIL",    "TVC:UKOIL",      bcoC, bcoO, bcoH, bcoL, bcoV, bcoChg, bcoEma) + ',' +
     f_item("NATGAS",   "TVC:NATGAS",     gasC, gasO, gasH, gasL, gasV, gasChg, gasEma) + ',' +
     f_item("ALUMINUM", "TVC:ALUMINUM",   aliC, aliO, aliH, aliL, aliV, aliChg, aliEma) + ',' +
     f_item("WHEAT",    "TVC:WHEAT",      whtC, whtO, whtH, whtL, whtV, whtChg, whtEma) +
     ']}'

// 3. Crypto Tier 1 (10 Koin)
crypto1Payload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"crypto","data":[' +
     f_item("BTC",  "BINANCE:BTCUSDT",  btcC,  btcO,  btcH,  btcL,  btcV,  btcChg,  btcEma)  + ',' +
     f_item("ETH",  "BINANCE:ETHUSDT",  ethC,  ethO,  ethH,  ethL,  ethV,  ethChg,  ethEma)  + ',' +
     f_item("SOL",  "BINANCE:SOLUSDT",  solC,  solO,  solH,  solL,  solV,  solChg,  solEma)  + ',' +
     f_item("BNB",  "BINANCE:BNBUSDT",  bnbC,  bnbO,  bnbH,  bnbL,  bnbV,  bnbChg,  bnbEma)  + ',' +
     f_item("XRP",  "BINANCE:XRPUSDT",  xrpC,  xrpO,  xrpH,  xrpL,  xrpV,  xrpChg,  xrpEma)  + ',' +
     f_item("DOGE", "BINANCE:DOGEUSDT", dogeC, dogeO, dogeH, dogeL, dogeV, dogeChg, dogeEma) + ',' +
     f_item("ADA",  "BINANCE:ADAUSDT",  adaC,  adaO,  adaH,  adaL,  adaV,  adaChg,  adaEma)  + ',' +
     f_item("AVAX", "BINANCE:AVAXUSDT", avaxC, avaxO, avaxH, avaxL, avaxV, avaxChg, avaxEma) + ',' +
     f_item("SUI",  "BINANCE:SUIUSDT",  suiC,  suiO,  suiH,  suiL,  suiV,  suiChg,  suiEma)  + ',' +
     f_item("LINK", "BINANCE:LINKUSDT", linkC, linkO, linkH, linkL, linkV, linkChg, linkEma) +
     ']}'

// 4. Crypto Tier 2 & AI / High Beta (10 Koin)
crypto2Payload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"crypto","data":[' +
     f_item("NEAR",   "BINANCE:NEARUSDT",   nearC, nearO, nearH, nearL, nearV, nearChg, nearEma) + ',' +
     f_item("APT",    "BINANCE:APTUSDT",    aptC,  aptO,  aptH,  aptL,  aptV,  aptChg,  aptEma)  + ',' +
     f_item("PEPE",   "BINANCE:PEPEUSDT",   pepeC, pepeO, pepeH, pepeL, pepeV, pepeChg, pepeEma) + ',' +
     f_item("LTC",    "BINANCE:LTCUSDT",    ltcC,  ltcO,  ltcH,  ltcL,  ltcV,  ltcChg,  ltcEma)  + ',' +
     f_item("DOT",    "BINANCE:DOTUSDT",    dotC,  dotO,  dotH,  dotL,  dotV,  dotChg,  dotEma)  + ',' +
     f_item("RENDER", "BINANCE:RENDERUSDT", rndrC, rndrO, rndrH, rndrL, rndrV, rndrChg, rndrEma) + ',' +
     f_item("FET",    "BINANCE:FETUSDT",    fetC,  fetO,  fetH,  fetL,  fetV,  fetChg,  fetEma)  + ',' +
     f_item("INJ",    "BINANCE:INJUSDT",    injC,  injO,  injH,  injL,  injV,  injChg,  injEma)  + ',' +
     f_item("SHIB",   "BINANCE:SHIBUSDT",   shibC, shibO, shibH, shibL, shibV, shibChg, shibEma) + ',' +
     f_item("TAO",    "BINANCE:TAOUSDT",    taoC,  taoO,  taoH,  taoL,  taoV,  taoChg,  taoEma)  +
     ']}'

// ── 5. WEBHOOK ALERTS DISPATCH ──
is_ready = trigger_mode == "Once Per Bar Close" ? barstate.isconfirmed : barstate.isrealtime

if is_ready
    if send_macro
        alert(macroPayload, alert.freq_once_per_bar)
    if send_metals
        alert(metalsPayload, alert.freq_once_per_bar)
    if send_crypto1
        alert(crypto1Payload, alert.freq_once_per_bar)
    if send_crypto2
        alert(crypto2Payload, alert.freq_once_per_bar)

// ── 6. VISUAL ON-CHART HUD DASHBOARD ──
var table t = table.new(position.bottom_left, 4, 6, bgcolor = color.new(color.black, 20), border_color = color.new(color.gray, 60), border_width = 1)
if show_hud and barstate.islast
    table.cell(t, 0, 0, "FLOW MONITOR",   bgcolor = color.new(color.blue, 30), text_color = color.white, text_size = size.small)
    table.cell(t, 1, 0, "CRYPTO TOP",     bgcolor = color.new(#f59e0b, 30),   text_color = color.white, text_size = size.small)
    table.cell(t, 2, 0, "KOMODITAS/OIL",  bgcolor = color.new(#10b981, 30),   text_color = color.white, text_size = size.small)
    table.cell(t, 3, 0, "INDEKS & MAKRO", bgcolor = color.new(#8b5cf6, 30),   text_color = color.white, text_size = size.small)

    table.cell(t, 0, 1, "TF: " + tf, text_color = color.gray, text_size = size.small)
    table.cell(t, 1, 1, "BTC: " + str.tostring(btcChg, "#.##") + "%", bgcolor = btcChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 1, "Gold: " + str.tostring(xauChg, "#.##") + "%", bgcolor = xauChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 1, "US500: " + str.tostring(spxChg, "#.##") + "%", bgcolor = spxChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(t, 0, 2, "Status: Active", text_color = color.green, text_size = size.small)
    table.cell(t, 1, 2, "ETH: " + str.tostring(ethChg, "#.##") + "%", bgcolor = ethChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 2, "Silver: " + str.tostring(xagChg, "#.##") + "%", bgcolor = xagChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 2, "US100: " + str.tostring(nsxChg, "#.##") + "%", bgcolor = nsxChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(t, 0, 3, "Mode: Prime 40", text_color = color.yellow, text_size = size.small)
    table.cell(t, 1, 3, "SOL: " + str.tostring(solChg, "#.##") + "%", bgcolor = solChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 3, "USOIL: " + str.tostring(oilChg, "#.##") + "%", bgcolor = oilChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 3, "US30: " + str.tostring(djiChg, "#.##") + "%", bgcolor = djiChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(t, 0, 4, "Sync: Safe ≤40", text_color = color.cyan, text_size = size.small)
    table.cell(t, 1, 4, "BNB: " + str.tostring(bnbChg, "#.##") + "%", bgcolor = bnbChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 4, "Copper: " + str.tostring(copChg, "#.##") + "%", bgcolor = copChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 4, "DXY: " + str.tostring(dxyChg, "#.##") + "%", bgcolor = dxyChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(t, 0, 5, "FX: via CS Modul", text_color = color.gray, text_size = size.small)
    table.cell(t, 1, 5, "SUI: " + str.tostring(suiChg, "#.##") + "%", bgcolor = suiChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 5, "NATGAS: " + str.tostring(gasChg, "#.##") + "%", bgcolor = gasChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 5, "US10Y: " + str.tostring(us10yChg, "#.##") + "%", bgcolor = us10yChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)`;

  const WORKER_SCRIPT_CODE = `// ══════════════════════════════════════════════════════════════════════════════
// Flow Monitor - Cloudflare Worker Webhook & Real-Time Aggregator
// Handles: TradingView Pine Script v6 Webhooks (Crypto, Metals & Indices)
// Endpoints:
//   POST /fm?key=YOUR_KEY   — Ingests alert payload from TradingView
//   GET  /latest            — Returns latest multi-asset flow snapshot
//   GET  /history           — Returns historical snapshots (last 50)
//   GET  /streaks           — Returns active streak counters
//   GET  /health            — Status check & uptime
// ══════════════════════════════════════════════════════════════════════════════

let memoryLatest = null;
let memoryHistory = [];
let memoryStreaks = {};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/health" || url.pathname === "/ping") {
      return jsonResponse({
        status: "ok",
        timestamp: new Date().toISOString(),
        hasKV: !!env.FM,
        hasTelegram: !!(env.TG_TOKEN && env.TG_CHAT),
      });
    }

    // ── POST /fm or POST /webhook: Ingest Pine Script Webhook ──
    if (request.method === "POST" && (url.pathname === "/fm" || url.pathname === "/webhook" || url.pathname === "/")) {
      const authKey = url.searchParams.get("key") || request.headers.get("x-api-key");
      if (env.API_KEY && authKey !== env.API_KEY) {
        return jsonResponse({ error: "Unauthorized: Invalid API key" }, 401);
      }

      try {
        const body = await request.json();
        const now = Date.now();
        const timeStr = body.time || new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        let snapshot = memoryLatest
          ? JSON.parse(JSON.stringify(memoryLatest))
          : {
              time: timeStr,
              mode: body.mode || body.tf ? \`\${body.tf}m\` : "1H Intraday",
              timestamp: now,
              source: "tradingview_pine_webhook",
              crypto: [],
              metals: [],
              inst: [],
              forex: [],
              context: {},
            };

        snapshot.time = timeStr;
        snapshot.timestamp = now;

        // Pine Script v6 'data' array
        if (Array.isArray(body.data)) {
          const CRYPTO_SYMS = new Set([
            "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "SUI", "LINK",
            "NEAR", "APT", "PEPE", "LTC", "DOT", "RENDER", "FET", "INJ", "SHIB", "TAO"
          ]);
          const METALS_SYMS = new Set([
            "XAUUSD", "XAGUSD", "XPTUSD", "COPPER", "USOIL", "UKOIL", "NATGAS", "ALUMINUM", "WHEAT",
            "GOLD", "SILVER", "NGAS"
          ]);
          const INST_SYMS = new Set([
            "US500", "US100", "US30", "US2000", "GER40", "UK100", "JP225", "HK33",
            "SPX", "NDX", "DJI", "DXY", "US10Y", "VIX", "DE40"
          ]);

          body.data.forEach((item) => {
            const pair = item.p || item.pair || item.c || item.name || "UNKNOWN";
            const pct = typeof item.chg === "number" ? item.chg : typeof item.pct === "number" ? item.pct : typeof item.r === "number" ? item.r : 0;
            const dir = item.dir || (pct >= 0 ? "LONG" : "SHORT");
            const entry = {
              pair,
              pct,
              dir,
              price: item.c,
              open: item.o,
              high: item.h,
              low: item.l,
              vol: item.v,
              ema20: item.ema20,
              src: item.src,
            };

            const upsert = (list) => {
              const idx = list.findIndex((x) => x.pair === pair);
              if (idx >= 0) list[idx] = entry;
              else list.push(entry);
            };

            if (body.cat === "crypto" || CRYPTO_SYMS.has(pair)) {
              upsert(snapshot.crypto);
            } else if (body.cat === "metals" || body.cat === "commodities" || METALS_SYMS.has(pair)) {
              upsert(snapshot.metals);
            } else if (body.cat === "macro" || body.cat === "inst" || body.cat === "indices" || INST_SYMS.has(pair)) {
              upsert(snapshot.inst);
            } else {
              upsert(snapshot.forex);
            }

            if (!snapshot.context) snapshot.context = {};
            if (pair === "US10Y")  snapshot.context.US10Y  = pct;
            if (pair === "DXY")    snapshot.context.DXY    = pct;
            if (pair === "VIX")    snapshot.context.VIX    = pct;
            if (pair === "US500")  snapshot.context.US500  = pct;
            if (pair === "XAUUSD") snapshot.context.GOLD   = pct;
            if (pair === "USOIL")  snapshot.context.USOIL  = pct;
            if (pair === "AUDNZD") snapshot.context.AUDNZD = pct;
            if (pair === "CHFJPY") snapshot.context.CHFJPY = pct;
            if (pair === "EURGBP") snapshot.context.EURGBP = pct;
            if (pair === "USDCAD") snapshot.context.USDCAD = pct;
          });
        }

        const normalizeList = (list) => {
          if (!Array.isArray(list)) return [];
          return list.map((item) => {
            const pair = item.pair || item.p || item.c || item.name || "UNKNOWN";
            const pct = typeof item.pct === "number" ? item.pct : typeof item.chg === "number" ? item.chg : typeof item.r === "number" ? item.r : 0;
            const dir = item.dir || (pct >= 0 ? "LONG" : "SHORT");
            return { pair, pct, dir, price: item.c || item.price };
          });
        };

        if (body.crypto || body.coins) snapshot.crypto = normalizeList(body.crypto || body.coins);
        if (body.metals || body.items) snapshot.metals = normalizeList(body.metals || body.items);
        if (body.inst   || body.indices) snapshot.inst = normalizeList(body.inst || body.indices);
        if (body.forex  || body.pairs)  snapshot.forex = normalizeList(body.forex || body.pairs);
        if (body.context && typeof body.context === "object") snapshot.context = { ...snapshot.context, ...body.context };

        // Update Streaks
        const threshold = parseInt(env.STREAK_TH || "5", 10);
        const hotAlerts = [];
        const checkCategoryStreaks = (categoryName, list) => {
          if (!Array.isArray(list) || list.length === 0) return;
          const sorted = [...list].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
          const topNames = sorted.slice(0, 5).map((x) => x.pair);
          const allKnown = new Set([...Object.keys(memoryStreaks), ...topNames]);

          for (const item of allKnown) {
            if (topNames.includes(item)) {
              memoryStreaks[item] = (memoryStreaks[item] || 0) + 1;
              if (memoryStreaks[item] === threshold) {
                const itemData = sorted.find((x) => x.pair === item);
                hotAlerts.push({
                  pair: item,
                  category: categoryName,
                  streak: threshold,
                  pct: itemData ? itemData.pct : 0,
                  dir: itemData ? itemData.dir : "LONG",
                });
              }
            } else {
              delete memoryStreaks[item];
            }
          }
        };

        checkCategoryStreaks("crypto", snapshot.crypto);
        checkCategoryStreaks("metals", snapshot.metals);
        checkCategoryStreaks("inst", snapshot.inst);

        // Telegram Notification for Sustained Momentum Streaks
        if (env.TG_TOKEN && env.TG_CHAT && hotAlerts.length > 0) {
          for (const alert of hotAlerts) {
            const emoji = alert.dir === "LONG" ? "🟢" : "🔴";
            const text = \`🔥 *FLOW MONITOR ALERT* 🔥\\n\\n\${emoji} *\${alert.pair}* (\${alert.category.toUpperCase()})\\n⚡ Sustained Momentum: *\${alert.streak}x berturut-turut*\\n📊 ROC: *\${alert.pct > 0 ? "+" : ""}\${alert.pct.toFixed(2)}%* (\${alert.dir})\\n⏰ Waktu: \${snapshot.time}\`;
            await fetch(\`https://api.telegram.org/bot\${env.TG_TOKEN}/sendMessage\`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: env.TG_CHAT, text, parse_mode: "Markdown" }),
            }).catch(() => {});
          }
        }

        memoryLatest = snapshot;
        memoryHistory.unshift({ time: snapshot.time, timestamp: snapshot.timestamp, count: (snapshot.crypto.length + snapshot.metals.length + snapshot.inst.length) });
        if (memoryHistory.length > 50) memoryHistory.pop();

        if (env.FM) {
          await env.FM.put("latest_snapshot", JSON.stringify(snapshot));
          await env.FM.put("streaks", JSON.stringify(memoryStreaks));
        }

        return jsonResponse({ ok: true, saved: true, timestamp: now, assetsIngested: (snapshot.crypto.length + snapshot.metals.length + snapshot.inst.length) });
      } catch (err) {
        return jsonResponse({ error: "Invalid JSON or server error", details: err.message }, 400);
      }
    }

    // ── GET /latest ──
    if (url.pathname === "/latest" || url.pathname === "/fm/latest" || (request.method === "GET" && url.pathname === "/")) {
      if (env.FM) {
        try {
          const kvData = await env.FM.get("fm:latest", { type: "json" });
          if (kvData) return jsonResponse(kvData);
        } catch (_) {}
      }
      if (memoryLatest) return jsonResponse(memoryLatest);
      return jsonResponse({ status: "waiting_for_first_alert", time: new Date().toISOString() });
    }

    // ── GET /history ──
    if (url.pathname === "/history" || url.pathname === "/fm/history") {
      if (env.FM) {
        try {
          const kvHist = await env.FM.get("fm:history", { type: "json" });
          if (kvHist) return jsonResponse(kvHist);
        } catch (_) {}
      }
      return jsonResponse(memoryHistory);
    }

    // ── GET /streaks ──
    if (url.pathname === "/streaks" || url.pathname === "/fm/streaks") {
      if (env.FM) {
        try {
          const kvStreaks = await env.FM.get("fm:streaks", { type: "json" });
          if (kvStreaks) return jsonResponse(kvStreaks);
        } catch (_) {}
      }
      return jsonResponse(memoryStreaks);
    }

    return jsonResponse({ error: "Endpoint not found" }, 404);
  }
};`;

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
        time: new Date().toLocaleTimeString('en-GB'),
        mode: '1H Intraday',
        crypto: [
          { pair: 'BTC', pct: 2.15, dir: 'LONG' },
          { pair: 'ETH', pct: 1.84, dir: 'LONG' },
          { pair: 'SOL', pct: 4.20, dir: 'LONG' },
        ],
        metals: [
          { pair: 'XAUUSD', pct: 0.95, dir: 'LONG' },
          { pair: 'XAGUSD', pct: 1.40, dir: 'LONG' },
          { pair: 'USOIL', pct: -0.80, dir: 'SHORT' },
        ],
        forex: [
          { pair: 'EURUSD', pct: 0.42, dir: 'LONG' },
          { pair: 'GBPUSD', pct: 0.58, dir: 'LONG' },
          { pair: 'USDJPY', pct: -0.62, dir: 'SHORT' },
        ],
        context: {
          US10Y: -0.75,
          DXY: -0.32,
          AUDNZD: 0.18,
          CHFJPY: 0.55,
          EURGBP: -0.12,
          USDCAD: -0.28,
          XAUXAG: -0.45,
        },
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
                <span>TradingView Pine Script & Cloudflare Worker Webhook</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">
                  v5 Ready
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Hub integrasi sinyal otomatis untuk Bitcoin, Komoditas (Emas/Minyak), dan Forex 28 Pairs.
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
            <span>TradingView Pine Script v5</span>
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
