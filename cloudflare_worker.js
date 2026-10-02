/**
 * ═══════════════════════════════════════════════════════════════
 * FLOW MONITOR · CLOUDFLARE WORKER WEBHOOK & API ENGINE
 * ═══════════════════════════════════════════════════════════════
 * Arsitektur backend tanpa server (Serverless) untuk menerima webhook
 * dari TradingView Pine Script v6 (15 Prime Assets: 5 Indeks, 5 Crypto, 5 Komoditas),
 * melacak Sustained Flow Streaks, menyimpan ke Cloudflare KV,
 * dan melayani API dashboard real-time.
 *
 * PANDUAN ENV DI CLOUDFLARE DASHBOARD:
 *   - KV Namespace Binding: DASHBOARD_KV (atau FM)
 *   - STREAK_TH (Environment Variable): Ambang batas streak (default: 5)
 *   - TG_TOKEN (Secret, Opsional): Token Telegram Bot
 *   - TG_CHAT (Secret, Opsional): Chat ID Telegram
 *   - API_KEY (Secret, Opsional): Kunci otentikasi webhook TradingView
 * ═══════════════════════════════════════════════════════════════
 */

// Memory fallback jika KV belum di-bind
let memoryLatest = null;
let memoryHistory = [];
let memoryStreaks = {};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, x-api-key",
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

// Normalisasi Pair Name agar seragam di UI
function canonicalPairName(raw) {
  if (!raw) return "UNKNOWN";
  const s = String(raw).toUpperCase().trim();
  if (s === "XAUUSD" || s === "GOLD" || s === "XAU/USD") return "GOLD";
  if (s === "XAGUSD" || s === "SILVER" || s === "XAG/USD") return "SILVER";
  if (s === "SPX500USD" || s === "SPX" || s === "US500") return "US500";
  if (s === "NAS100USD" || s === "NDX" || s === "US100" || s === "NAS100") return "NAS100";
  if (s === "US30USD" || s === "DJI" || s === "US30") return "US30";
  if (s === "DE40EUR" || s === "DAX" || s === "GER40") return "GER40";
  if (s === "JP225USD" || s === "NI225" || s === "JP225") return "JP225";
  return s;
}

// Normalisasi item menjadi objek seragam { pair, pct, dir, price }
function normalizeItem(item) {
  if (!item) return null;
  const rawPair = item.pair || item.p || item.symbol || item.name || item.c;
  const pair = canonicalPairName(rawPair);
  const pct = typeof item.pct === "number" ? item.pct : typeof item.chg === "number" ? item.chg : typeof item.r === "number" ? item.r : 0;
  const price = typeof item.price === "number" ? item.price : typeof item.c === "number" ? item.c : undefined;
  const dir = item.dir || (pct >= 0 ? "LONG" : "SHORT");
  return { pair, pct: Number(pct.toFixed(2)), price, dir };
}

// Normalisasi payload dari Pine Script v6
function normalizeIncomingPayload(body) {
  const now = Date.now();
  let timeStr = body.time;
  if (!timeStr) {
    const d = new Date(body.t || now);
    timeStr = d.toLocaleDateString("id-ID") + " | " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  }

  // 1. Format Baru Pine Script v6: Unified single payload (inst, crypto, metals)
  const extractList = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeItem).filter(Boolean);
  };

  const crypto = extractList(body.crypto || body.coins);
  const metals = extractList(body.metals || body.commodities || body.items);
  const inst = extractList(body.inst || body.indices || body.macro || body.benchmarks);
  const forex = extractList(body.forex || body.pairs);

  // Jika payload adalah chunk single category via body.data
  if (Array.isArray(body.data) && (crypto.length === 0 && metals.length === 0 && inst.length === 0)) {
    const chunkItems = extractList(body.data);
    const cat = body.cat || "crypto";
    if (cat === "crypto") crypto.push(...chunkItems);
    else if (cat === "metals" || cat === "commodities") metals.push(...chunkItems);
    else if (cat === "inst" || cat === "indices" || cat === "macro") inst.push(...chunkItems);
    else forex.push(...chunkItems);
  }

  // Jika setidaknya salah satu kategori memiliki data
  if (crypto.length > 0 || metals.length > 0 || inst.length > 0 || forex.length > 0) {
    return {
      time: timeStr,
      mode: body.mode || (body.tf ? `${body.tf}m` : "PineScript 15 Prime"),
      timestamp: now,
      source: "tradingview_pine_webhook",
      // Pastikan tetap top 5 teratas sesuai brief pengguna
      crypto: crypto.slice(0, 5),
      metals: metals.slice(0, 5),
      inst: inst.slice(0, 5),
      forex: forex,
      context: body.context || {},
    };
  }

  return null;
}

// Kirim Notifikasi Telegram (Jika dikonfigurasi)
async function sendTelegramAlert(env, timeStr, firedAlerts) {
  const token = env.TG_TOKEN;
  const chat = env.TG_CHAT;
  if (!token || !chat || !firedAlerts || firedAlerts.length === 0) return;

  let msg = `<b>🔥 Flow Monitor Top Movers Momentum</b>\n<code>${timeStr}</code>\n\n`;
  for (const f of firedAlerts) {
    const arrow = f.dir === "LONG" ? "▲" : "▼";
    const sign = f.pct >= 0 ? "+" : "";
    msg += `${arrow} <b>${f.pair}</b> · ${f.streak}× Sustained · ${sign}${f.pct.toFixed(2)}% (${f.dir})\n`;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: msg.trim(),
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("Telegram alert error:", err);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── 1. Handle CORS Preflight ──
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Identifikasi KV Namespace
    const kv = env.DASHBOARD_KV || env.FM;

    // ── 2. POST /fm atau /webhook — Penerima Webhook TradingView ──
    if (request.method === "POST" && (url.pathname === "/fm" || url.pathname === "/webhook" || url.pathname === "/")) {
      // Validasi API Key opsional
      const reqKey = url.searchParams.get("key") || request.headers.get("x-api-key");
      if (env.API_KEY && reqKey !== env.API_KEY) {
        return jsonResponse({ error: "Unauthorized: Invalid API Key" }, 401);
      }

      try {
        const rawBody = await request.json();
        const incoming = normalizeIncomingPayload(rawBody);

        if (!incoming) {
          return jsonResponse({ error: "Invalid payload format. Expected { crypto, metals, inst } with 5 items each." }, 400);
        }

        // Ambil existing snapshot jika ada agar kategori tidak saling timpa (Atomic Merge)
        let merged = memoryLatest ? { ...memoryLatest } : { crypto: [], metals: [], inst: [], forex: [] };
        if (kv) {
          try {
            const rawPrev = (await kv.get("latest")) || (await kv.get("fm:latest"));
            if (rawPrev) merged = JSON.parse(rawPrev);
          } catch (e) {}
        }

        // Merge categories
        if (incoming.crypto.length > 0) merged.crypto = incoming.crypto;
        if (incoming.metals.length > 0) merged.metals = incoming.metals;
        if (incoming.inst.length > 0) merged.inst = incoming.inst;
        if (incoming.forex.length > 0) merged.forex = incoming.forex;
        merged.time = incoming.time;
        merged.timestamp = incoming.timestamp;
        merged.mode = incoming.mode;
        merged.source = "tradingview_pine_webhook";
        merged.context = { ...(merged.context || {}), ...(incoming.context || {}) };

        // Simpan ke Memory State
        memoryLatest = merged;

        // Simpan ke Cloudflare KV
        if (kv) {
          await kv.put("latest", JSON.stringify(merged));
          await kv.put("fm:latest", JSON.stringify(merged));

          // Simpan Riwayat
          let history = [];
          try {
            const rawHist = (await kv.get("history")) || (await kv.get("fm:history"));
            if (rawHist) history = JSON.parse(rawHist);
          } catch (e) {}

          history.push(merged);
          if (history.length > 60) history = history.slice(-60);
          await kv.put("history", JSON.stringify(history));
          await kv.put("fm:history", JSON.stringify(history));

          // ── Sustained Streak Tracking Engine ──
          const threshold = parseInt(env.STREAK_TH || "5", 10);
          let streaks = {};
          try {
            const rawStreaks = (await kv.get("streaks")) || (await kv.get("fm:streaks"));
            if (rawStreaks) streaks = JSON.parse(rawStreaks);
          } catch (e) {}

          const all15Items = [
            ...(merged.crypto || []),
            ...(merged.metals || []),
            ...(merged.inst || []),
          ];

          const sorted = [...all15Items].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
          const topNames = sorted.slice(0, 5).map((p) => p.pair);
          const allTracked = new Set([...Object.keys(streaks), ...topNames]);
          const firedAlerts = [];

          for (const item of allTracked) {
            if (topNames.includes(item)) {
              streaks[item] = (streaks[item] || 0) + 1;
              if (streaks[item] === threshold) {
                const found = all15Items.find((p) => p.pair === item);
                firedAlerts.push({
                  pair: item,
                  pct: found ? found.pct : 0,
                  dir: found ? found.dir : "LONG",
                  streak: threshold,
                });
              }
            } else {
              delete streaks[item];
            }
          }

          await kv.put("streaks", JSON.stringify(streaks));
          await kv.put("fm:streaks", JSON.stringify(streaks));

          if (firedAlerts.length > 0) {
            await sendTelegramAlert(env, merged.time, firedAlerts);
          }
        } else {
          memoryHistory.push(merged);
          if (memoryHistory.length > 60) memoryHistory = memoryHistory.slice(-60);
        }

        return jsonResponse({
          ok: true,
          saved: true,
          time: merged.time,
          counts: {
            crypto: merged.crypto.length,
            metals: merged.metals.length,
            indeks: merged.inst.length,
          },
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    // ── 3. GET /latest — Ambil Snapshot Terkini ──
    if (request.method === "GET" && (url.pathname === "/latest" || url.pathname === "/fm/latest")) {
      let data = memoryLatest;
      if (kv) {
        try {
          const raw = (await kv.get("latest")) || (await kv.get("fm:latest"));
          if (raw) data = JSON.parse(raw);
        } catch (e) {}
      }

      if (!data) {
        return jsonResponse({
          status: "waiting_data",
          message: "Belum ada sinyal alert masuk dari TradingView Pine Script. Pastikan alert webhook aktif.",
          crypto: [],
          metals: [],
          inst: [],
        }, 200);
      }

      return jsonResponse(data, 200);
    }

    // ── 4. GET /history — Ambil Riwayat Snapshot ──
    if (request.method === "GET" && (url.pathname === "/history" || url.pathname === "/fm/history")) {
      let history = memoryHistory;
      if (kv) {
        try {
          const raw = (await kv.get("history")) || (await kv.get("fm:history"));
          if (raw) history = JSON.parse(raw);
        } catch (e) {}
      }
      return jsonResponse(history || []);
    }

    // ── 5. GET /streaks — Ambil Counter Sustained Momentum ──
    if (request.method === "GET" && (url.pathname === "/streaks" || url.pathname === "/fm/streaks")) {
      let streaks = memoryStreaks;
      if (kv) {
        try {
          const raw = (await kv.get("streaks")) || (await kv.get("fm:streaks"));
          if (raw) streaks = JSON.parse(raw);
        } catch (e) {}
      }
      return jsonResponse(streaks || {});
    }

    // ── 6. GET / atau status health check ──
    return jsonResponse({
      status: "Flow Monitor Cloudflare Worker is running",
      mode: "15 Prime Assets (5 Indeks, 5 Crypto, 5 Komoditas)",
      endpoints: {
        webhook: "POST /fm (atau POST /webhook)",
        latest: "GET /latest",
        history: "GET /history",
        streaks: "GET /streaks",
      },
      kvConfigured: !!kv,
      hasData: !!memoryLatest,
    });
  },
};
