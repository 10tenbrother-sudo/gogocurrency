/**
 * Flow Monitor Cloudflare Worker Engine
 * Handles: 15 Prime Assets (5 Indeks, 5 Crypto, 5 Komoditas)
 */

export const FLOW_MONITOR_WORKER_SCRIPT = `/**
 * ═══════════════════════════════════════════════════════════════
 * FLOW MONITOR · CLOUDFLARE WORKER WEBHOOK & API ENGINE
 * ═══════════════════════════════════════════════════════════════
 * Menerima webhook TradingView Pine Script v6 (15 Prime Assets: 5 Indeks, 5 Crypto, 5 Komoditas)
 * Endpoints:
 *   POST /fm?key=YOUR_KEY   — Ingests alert payload dari TradingView
 *   GET  /latest            — Returns snapshot 15 aset terkini
 *   GET  /history           — Returns riwayat snapshot (terakhir 60)
 *   GET  /streaks           — Returns counter sustained momentum
 *   GET  /health            — Status check & uptime
 * ═══════════════════════════════════════════════════════════════
 */

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

function normalizeItem(item) {
  if (!item) return null;
  const rawPair = item.pair || item.p || item.symbol || item.name || item.c;
  const pair = canonicalPairName(rawPair);
  const pct = typeof item.pct === "number" ? item.pct : typeof item.chg === "number" ? item.chg : typeof item.r === "number" ? item.r : 0;
  const price = typeof item.price === "number" ? item.price : typeof item.c === "number" ? item.c : undefined;
  const dir = item.dir || (pct >= 0 ? "LONG" : "SHORT");
  return { pair, pct: Number(pct.toFixed(2)), price, dir };
}

function normalizeIncomingPayload(body) {
  const now = Date.now();
  let timeStr = body.time;
  if (!timeStr) {
    const d = new Date(body.t || now);
    timeStr = d.toLocaleDateString("id-ID") + " | " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  }

  const extractList = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeItem).filter(Boolean);
  };

  const crypto = extractList(body.crypto || body.coins);
  const metals = extractList(body.metals || body.commodities || body.items);
  const inst = extractList(body.inst || body.indices || body.macro || body.benchmarks);
  const forex = extractList(body.forex || body.pairs);

  if (Array.isArray(body.data) && (crypto.length === 0 && metals.length === 0 && inst.length === 0)) {
    const chunkItems = extractList(body.data);
    const cat = body.cat || "crypto";
    if (cat === "crypto") crypto.push(...chunkItems);
    else if (cat === "metals" || cat === "commodities") metals.push(...chunkItems);
    else if (cat === "inst" || cat === "indices" || cat === "macro") inst.push(...chunkItems);
    else forex.push(...chunkItems);
  }

  if (crypto.length > 0 || metals.length > 0 || inst.length > 0 || forex.length > 0) {
    return {
      time: timeStr,
      mode: body.mode || (body.tf ? (body.tf + "m") : "PineScript 15 Prime"),
      timestamp: now,
      source: "tradingview_pine_webhook",
      crypto: crypto.slice(0, 5),
      metals: metals.slice(0, 5),
      inst: inst.slice(0, 5),
      forex: forex,
      context: body.context || {},
    };
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const kv = env.DASHBOARD_KV || env.FM;

    if (request.method === "POST" && (url.pathname === "/fm" || url.pathname === "/webhook" || url.pathname === "/")) {
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

        let merged = memoryLatest ? { ...memoryLatest } : { crypto: [], metals: [], inst: [], forex: [] };
        if (kv) {
          try {
            const rawPrev = (await kv.get("latest")) || (await kv.get("fm:latest"));
            if (rawPrev) merged = JSON.parse(rawPrev);
          } catch (e) {}
        }

        if (incoming.crypto.length > 0) merged.crypto = incoming.crypto;
        if (incoming.metals.length > 0) merged.metals = incoming.metals;
        if (incoming.inst.length > 0) merged.inst = incoming.inst;
        if (incoming.forex.length > 0) merged.forex = incoming.forex;
        merged.time = incoming.time;
        merged.timestamp = incoming.timestamp;
        merged.mode = incoming.mode;
        merged.source = "tradingview_pine_webhook";
        merged.context = { ...(merged.context || {}), ...(incoming.context || {}) };

        memoryLatest = merged;

        if (kv) {
          await kv.put("latest", JSON.stringify(merged));
          await kv.put("fm:latest", JSON.stringify(merged));

          let history = [];
          try {
            const rawHist = (await kv.get("history")) || (await kv.get("fm:history"));
            if (rawHist) history = JSON.parse(rawHist);
          } catch (e) {}

          history.push(merged);
          if (history.length > 60) history = history.slice(-60);
          await kv.put("history", JSON.stringify(history));
          await kv.put("fm:history", JSON.stringify(history));
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
          message: "Belum ada sinyal alert masuk dari TradingView Pine Script.",
          crypto: [],
          metals: [],
          inst: [],
        }, 200);
      }

      return jsonResponse(data, 200);
    }

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

    return jsonResponse({
      status: "Flow Monitor Cloudflare Worker is running",
      mode: "15 Prime Assets (5 Indeks, 5 Crypto, 5 Komoditas)",
      endpoints: {
        webhook: "POST /fm (atau POST /webhook)",
        latest: "GET /latest",
        history: "GET /history",
      },
      kvConfigured: !!kv,
      hasData: !!memoryLatest,
    });
  },
};`;
