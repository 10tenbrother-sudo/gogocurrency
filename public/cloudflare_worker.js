/**
 * ═══════════════════════════════════════════════════════════════
 * FLOW MONITOR · CLOUDFLARE WORKER WEBHOOK & API ENGINE
 * ═══════════════════════════════════════════════════════════════
 * Arsitektur backend tanpa server (Serverless) untuk menerima webhook
 * dari TradingView Pine Script, melacak Sustained Flow Streaks,
 * menyimpan riwayat ke Cloudflare KV, dan melayani API dashboard.
 *
 * PANDUAN ENV DI CLOUDFLARE DASHBOARD:
 *   - KV Namespace Binding: DASHBOARD_KV (atau FM)
 *   - STREAK_TH (Environment Variable): Ambang batas streak (default: 5)
 *   - TG_TOKEN (Secret, Opsional): Token Telegram Bot
 *   - TG_CHAT (Secret, Opsional): Chat ID Telegram
 *   - API_KEY (Secret, Opsional): Kunci otentikasi webhook TradingView
 * ═══════════════════════════════════════════════════════════════
 */

// Helper Header CORS
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };
}

// Helper Response JSON
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

// Normalisasi payload dari berbagai format Pine Script
function normalizeIncomingPayload(body) {
  const now = Date.now();
  let timeStr = body.time;
  if (!timeStr) {
    const d = new Date(body.t || now);
    timeStr = d.toLocaleDateString("id-ID") + " | " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  }

  // Format 1: Kael Dashboard (forex, metals, crypto, context)
  if (body.forex || body.metals || body.crypto) {
    return {
      time: timeStr,
      mode: body.mode || "Scalping",
      forex: Array.isArray(body.forex) ? body.forex : [],
      metals: Array.isArray(body.metals) ? body.metals : [],
      crypto: Array.isArray(body.crypto) ? body.crypto : [],
      inst: Array.isArray(body.inst) ? body.inst : [],
      context: body.context || {},
      timestamp: now,
    };
  }

  // Format 2: Flow Monitor multi-asset (pairs, items, coins, inst)
  if (body.pairs || body.items || body.coins || body.inst) {
    const formatEntries = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.map((item) => {
        const pair = item.pair || item.p || item.c || item.n;
        const pct = typeof item.pct === "number" ? item.pct : typeof item.r === "number" ? item.r : 0;
        const dir = item.dir || (pct >= 0 ? "LONG" : "SHORT");
        return { pair, pct, dir, price: item.price };
      });
    };

    return {
      time: timeStr,
      mode: body.mode || "PineScript",
      forex: formatEntries(body.pairs),
      metals: formatEntries(body.items || body.metals),
      crypto: formatEntries(body.coins || body.crypto),
      inst: formatEntries(body.inst),
      context: body.context || {},
      timestamp: now,
    };
  }

  return null;
}

// Kirim Notifikasi Telegram (Jika dikonfigurasi)
async function sendTelegramAlert(env, timeStr, firedAlerts) {
  const token = env.TG_TOKEN;
  const chat = env.TG_CHAT;
  if (!token || !chat || !firedAlerts || firedAlerts.length === 0) return;

  let msg = `<b>🔥 Flow Monitor Sustained Momentum</b>\n<code>${timeStr}</code>\n\n`;
  for (const f of firedAlerts) {
    const arrow = f.dir === "LONG" ? "▲" : "▼";
    const sign = f.pct >= 0 ? "+" : "";
    msg += `${arrow} <b>${f.pair}</b> · ${f.streak}× Top 5 · ${sign}${f.pct.toFixed(2)}% (${f.dir})\n`;
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
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── 1. Handle CORS Preflight ──
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Identifikasi KV Namespace (DASHBOARD_KV atau FM)
    const kv = env.DASHBOARD_KV || env.FM;

    // ── 2. POST /fm atau /webhook — Penerima Webhook TradingView ──
    if (request.method === "POST" && (url.pathname === "/fm" || url.pathname === "/webhook" || url.pathname === "/")) {
      // Validasi API Key opsional
      if (env.API_KEY && url.searchParams.get("key") !== env.API_KEY) {
        return jsonResponse({ error: "Unauthorized: Invalid API Key" }, 401);
      }

      try {
        const rawBody = await request.json();
        const normalized = normalizeIncomingPayload(rawBody);

        if (!normalized) {
          return jsonResponse({ error: "Invalid payload format. Expected forex/metals/crypto or pairs/items/coins" }, 400);
        }

        // Simpan Snapshot Terbaru ke KV
        if (kv) {
          await kv.put("latest", JSON.stringify(normalized));
          await kv.put("fm:latest", JSON.stringify(normalized));

          // Simpan Riwayat 50-100 snapshot terakhir
          let history = [];
          try {
            const rawHist = (await kv.get("history")) || (await kv.get("fm:history"));
            if (rawHist) history = JSON.parse(rawHist);
          } catch (e) {}

          history.push(normalized);
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

          // Gabungkan semua aset untuk diurutkan berdasarkan momentum |ROC|
          const allItems = [
            ...(normalized.crypto || []),
            ...(normalized.metals || []),
            ...(normalized.forex || []).slice(0, 10),
          ];

          const sorted = [...allItems].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
          const topNames = sorted.slice(0, 5).map((p) => p.pair);
          const allTracked = new Set([...Object.keys(streaks), ...topNames]);
          const firedAlerts = [];

          for (const item of allTracked) {
            if (topNames.includes(item)) {
              streaks[item] = (streaks[item] || 0) + 1;
              if (streaks[item] === threshold) {
                const found = allItems.find((p) => p.pair === item);
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

          // Kirim Telegram jika ada alert yang mencapai threshold
          if (firedAlerts.length > 0) {
            await sendTelegramAlert(env, normalized.time, firedAlerts);
          }
        }

        return jsonResponse({
          ok: true,
          saved: true,
          time: normalized.time,
          forexCount: normalized.forex.length,
          metalsCount: normalized.metals.length,
          cryptoCount: normalized.crypto.length,
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    // ── 3. GET /latest — Ambil Snapshot Terkini ──
    if (request.method === "GET" && (url.pathname === "/latest" || url.pathname === "/fm/latest")) {
      if (!kv) {
        return jsonResponse({ error: "KV Namespace binding belum dikonfigurasi" }, 500);
      }
      const raw = (await kv.get("latest")) || (await kv.get("fm:latest"));
      if (!raw) {
        return jsonResponse({ error: "Belum ada data snapshot terbaru. Tunggu bar candle berikutnya." }, 404);
      }
      return new Response(raw, {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // ── 4. GET /history — Ambil Riwayat Snapshot ──
    if (request.method === "GET" && (url.pathname === "/history" || url.pathname === "/fm/history")) {
      if (!kv) return jsonResponse([]);
      const raw = (await kv.get("history")) || (await kv.get("fm:history"));
      if (!raw) return jsonResponse([]);
      return new Response(raw, {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // ── 5. GET /streaks — Ambil Counter Sustained Momentum ──
    if (request.method === "GET" && (url.pathname === "/streaks" || url.pathname === "/fm/streaks")) {
      if (!kv) return jsonResponse({});
      const raw = (await kv.get("streaks")) || (await kv.get("fm:streaks"));
      return new Response(raw || "{}", {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // ── 6. GET / atau status health check ──
    return jsonResponse({
      status: "Flow Monitor Cloudflare Worker is running",
      endpoints: {
        webhook: "POST /fm (atau POST /webhook)",
        latest: "GET /latest",
        history: "GET /history",
        streaks: "GET /streaks",
      },
      kvConfigured: !!kv,
    });
  },
};
