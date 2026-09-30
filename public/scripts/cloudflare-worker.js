// ══════════════════════════════════════════════════════════════════════════════
// Flow Monitor - Cloudflare Worker Webhook & Real-Time Aggregator
// Handles: TradingView Pine Script Webhooks (Crypto, Metals, Forex, Indices)
// Endpoints:
//   POST /fm?key=YOUR_KEY   — Ingests alert payload from TradingView
//   GET  /latest            — Returns latest multi-asset flow snapshot
//   GET  /history           — Returns historical snapshots (last 50)
//   GET  /streaks           — Returns active streak counters
//   GET  /health            — Status check & uptime
// ══════════════════════════════════════════════════════════════════════════════

// In-memory fallback cache (persists during worker lifecycle)
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

// Format Telegram Alert Message
function formatTelegramMessage(snapshot, hotAlerts) {
  const time = snapshot.time || new Date().toISOString();
  let msg = `⚡ *FLOW MONITOR MOMENTUM ALERT* [${time}]\n\n`;

  if (hotAlerts && hotAlerts.length > 0) {
    msg += `🔥 *HOT STREAKS REACHED:*\n`;
    for (const a of hotAlerts) {
      const dirIcon = a.dir === "LONG" ? "🟢" : "🔴";
      msg += `${dirIcon} *${a.pair}* — ${a.streak}× Top 5 (${a.roc >= 0 ? "+" : ""}${a.roc.toFixed(2)}%)\n`;
    }
    msg += `\n`;
  }

  // Top Crypto
  if (snapshot.crypto && snapshot.crypto.length > 0) {
    msg += `🪙 *TOP CRYPTO:*\n`;
    snapshot.crypto.slice(0, 3).forEach((c, i) => {
      msg += `  ${i + 1}. ${c.pair}: ${c.pct >= 0 ? "+" : ""}${c.pct.toFixed(2)}% (${c.dir})\n`;
    });
  }

  // Top Metals
  if (snapshot.metals && snapshot.metals.length > 0) {
    msg += `\n🥇 *METALS & ENERGY:*\n`;
    snapshot.metals.slice(0, 3).forEach((m, i) => {
      msg += `  ${i + 1}. ${m.pair}: ${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(2)}% (${m.dir})\n`;
    });
  }

  // Top Forex
  if (snapshot.forex && snapshot.forex.length > 0) {
    msg += `\n💱 *TOP FOREX:*\n`;
    snapshot.forex.slice(0, 3).forEach((f, i) => {
      msg += `  ${i + 1}. ${f.pair}: ${f.pct >= 0 ? "+" : ""}${f.pct.toFixed(2)}% (${f.dir})\n`;
    });
  }

  if (snapshot.context) {
    msg += `\n🌐 *MACRO CONTEXT:*\n`;
    msg += `  DXY: ${snapshot.context.DXY || 0}% | US10Y: ${snapshot.context.US10Y || 0}%\n`;
  }

  return msg;
}

// Forward alert to Telegram Bot if configured
async function sendTelegramAlert(env, text) {
  if (!env.TG_TOKEN || !env.TG_CHAT) return;
  try {
    const tgUrl = `https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`;
    await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TG_CHAT,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("Telegram notify failed:", err);
  }
}

// Default Fallback Snapshot generator
function generateFallbackSnapshot() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    mode: "1H Intraday",
    source: "worker_initial_seed",
    timestamp: now.getTime(),
    crypto: [
      { pair: "BTC", pct: 1.84, dir: "LONG" },
      { pair: "ETH", pct: 1.42, dir: "LONG" },
      { pair: "SOL", pct: 3.15, dir: "LONG" },
      { pair: "XRP", pct: -0.65, dir: "SHORT" },
      { pair: "BNB", pct: 0.95, dir: "LONG" },
      { pair: "DOGE", pct: 2.10, dir: "LONG" },
    ],
    metals: [
      { pair: "XAUUSD", pct: 0.82, dir: "LONG" },
      { pair: "XAGUSD", pct: 1.35, dir: "LONG" },
      { pair: "USOIL",  pct: -0.92, dir: "SHORT" },
      { pair: "UKOIL",  pct: -0.78, dir: "SHORT" },
      { pair: "NATGAS", pct: 1.60, dir: "LONG" },
    ],
    inst: [
      { pair: "SPX", pct: 0.48, dir: "LONG" },
      { pair: "NDX", pct: 0.72, dir: "LONG" },
      { pair: "DXY", pct: -0.28, dir: "SHORT" },
    ],
    forex: [
      { pair: "EURUSD", pct: 0.38, dir: "LONG" },
      { pair: "GBPUSD", pct: 0.45, dir: "LONG" },
      { pair: "USDJPY", pct: -0.52, dir: "SHORT" },
      { pair: "AUDUSD", pct: 0.61, dir: "LONG" },
      { pair: "NZDUSD", pct: 0.54, dir: "LONG" },
      { pair: "USDCAD", pct: -0.32, dir: "SHORT" },
      { pair: "USDCHF", pct: -0.41, dir: "SHORT" },
      { pair: "EURGBP", pct: -0.07, dir: "SHORT" },
      { pair: "GBPJPY", pct: 0.93, dir: "LONG" },
      { pair: "EURJPY", pct: 0.88, dir: "LONG" },
    ],
    context: {
      US10Y: -0.85,
      DXY: -0.28,
      AUDNZD: 0.12,
      CHFJPY: 0.65,
      EURGBP: -0.07,
      USDCAD: -0.32,
      XAUXAG: -0.53,
    },
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── Handle CORS Preflight ──
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // ── GET /health ──
    if (url.pathname === "/health" || url.pathname === "/ping") {
      return jsonResponse({
        status: "ok",
        uptime: process?.uptime ? process.uptime() : "active",
        timestamp: new Date().toISOString(),
        hasKV: !!env.FM,
        hasTelegram: !!(env.TG_TOKEN && env.TG_CHAT),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // POST /fm or POST /webhook — Ingest from TradingView Pine Script
    // ══════════════════════════════════════════════════════════════════════════
    if (request.method === "POST" && (url.pathname === "/fm" || url.pathname === "/webhook" || url.pathname === "/")) {
      const authKey = url.searchParams.get("key") || request.headers.get("x-api-key");
      if (env.API_KEY && authKey !== env.API_KEY) {
        return jsonResponse({ error: "Unauthorized: Invalid API key" }, 401);
      }

      try {
        const body = await request.json();
        const now = Date.now();
        const timeStr = body.time || new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        // Normalize Snapshot Payload
        let snapshot = memoryLatest
          ? JSON.parse(JSON.stringify(memoryLatest))
          : {
              time: timeStr,
              mode: body.mode || body.tf ? `${body.tf}m` : "1H Intraday",
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

        // Support for Pine Script v6 'data' array format
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

            // Macro context trackers
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

        // Support for categorized payloads (body.crypto, body.metals, body.forex, etc.)
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

        // Calculate Streaks across Top 5 items per category
        const threshold = parseInt(env.STREAK_TH || "5", 10);
        const hotAlerts = [];
        const currentTopNames = new Set([
          ...snapshot.crypto.slice(0, 5).map(c => c.pair),
          ...snapshot.metals.slice(0, 5).map(m => m.pair),
          ...snapshot.forex.slice(0, 5).map(f => f.pair),
        ]);

        const nextStreaks = {};
        for (const sym of currentTopNames) {
          const count = (memoryStreaks[sym] || 0) + 1;
          nextStreaks[sym] = count;
          if (count === threshold) {
            const allItems = [...snapshot.crypto, ...snapshot.metals, ...snapshot.forex];
            const item = allItems.find(x => x.pair === sym);
            hotAlerts.push({
              pair: sym,
              streak: threshold,
              roc: item ? item.pct : 0,
              dir: item ? item.dir : "LONG",
            });
          }
        }
        memoryStreaks = nextStreaks;

        // Save in Memory
        memoryLatest = snapshot;
        memoryHistory.unshift(snapshot);
        if (memoryHistory.length > 50) memoryHistory.pop();

        // Save in Cloudflare KV if bound
        if (env.FM) {
          ctx.waitUntil(env.FM.put("fm:latest", JSON.stringify(snapshot)));
          ctx.waitUntil(env.FM.put("fm:streaks", JSON.stringify(memoryStreaks)));
          ctx.waitUntil(env.FM.put("fm:history", JSON.stringify(memoryHistory.slice(0, 50))));
        }

        // Notify Telegram if configured
        if (hotAlerts.length > 0 && env.TG_TOKEN && env.TG_CHAT) {
          const tgMsg = formatTelegramMessage(snapshot, hotAlerts);
          ctx.waitUntil(sendTelegramAlert(env, tgMsg));
        }

        return jsonResponse({
          success: true,
          status: "Snapshot recorded",
          time: snapshot.time,
          hotAlertsCount: hotAlerts.length,
          streaksUpdated: Object.keys(nextStreaks).length,
        });
      } catch (err) {
        return jsonResponse({ error: "Failed to process webhook payload", details: err.message }, 400);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GET /latest — Retrieve current multi-asset flow snapshot
    // ══════════════════════════════════════════════════════════════════════════
    if (url.pathname === "/latest" || url.pathname === "/fm/latest" || (request.method === "GET" && url.pathname === "/")) {
      // 1. Try Cloudflare KV
      if (env.FM) {
        try {
          const kvData = await env.FM.get("fm:latest", { type: "json" });
          if (kvData) return jsonResponse(kvData);
        } catch (_) {}
      }

      // 2. Try In-Memory
      if (memoryLatest) {
        return jsonResponse(memoryLatest);
      }

      // 3. Fallback Initial Data
      const fallback = generateFallbackSnapshot();
      return jsonResponse(fallback);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GET /history — Historical records
    // ══════════════════════════════════════════════════════════════════════════
    if (url.pathname === "/history" || url.pathname === "/fm/history") {
      if (env.FM) {
        try {
          const kvHist = await env.FM.get("fm:history", { type: "json" });
          if (kvHist) return jsonResponse(kvHist);
        } catch (_) {}
      }
      return jsonResponse(memoryHistory.length > 0 ? memoryHistory : [generateFallbackSnapshot()]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GET /streaks — Active streak counts
    // ══════════════════════════════════════════════════════════════════════════
    if (url.pathname === "/streaks" || url.pathname === "/fm/streaks") {
      if (env.FM) {
        try {
          const kvStreaks = await env.FM.get("fm:streaks", { type: "json" });
          if (kvStreaks) return jsonResponse(kvStreaks);
        } catch (_) {}
      }
      return jsonResponse(memoryStreaks);
    }

    return jsonResponse({ error: "Endpoint not found", available: ["/latest", "/history", "/streaks", "/health", "POST /fm"] }, 404);
  },
};
