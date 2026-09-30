export type FlowSnapshot = {
  time?: string;
  timestamp?: number;
  mode?: string;
  forex?: any[];
  metals?: any[];
  crypto?: any[];
  inst?: any[];
  context?: Record<string, number>;
  [key: string]: unknown;
};

const DEFAULT_WORKER = "https://flowmonitor.aideelyst.workers.dev";
const latestCache = new Map<string, { at: number; data: FlowSnapshot }>();
const historyCache = new Map<string, { at: number; data: FlowSnapshot[] }>();
let webhookSnapshot: FlowSnapshot | null = null;
let webhookHistory: FlowSnapshot[] = [];

export function workerTarget(value: string | null, endpoint: string) {
  const raw = (value || DEFAULT_WORKER).trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Masukkan URL HTTPS Worker yang valid.");
  }

  const host = url.hostname.toLowerCase();
  const blockedHost =
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".test") ||
    host.includes(":") ||
    /^\d+(?:\.\d+){3}$/.test(host);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port && url.port !== "443" ||
    blockedHost
  ) {
    throw new Error("URL Worker harus memakai HTTPS dan alamat host publik.");
  }

  url.pathname = `/${endpoint.replace(/^\/+/, "")}`;
  url.search = "";
  url.hash = "";
  return url;
}

export async function fetchJson(url: URL) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Worker returned ${response.status}`);
  const data: any = await response.json();
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export function getLatestCache(key: string, allowStale = false) {
  const entry = latestCache.get(key);
  return entry && (allowStale || Date.now() - entry.at < 10_000) ? entry.data : null;
}

export function setLatestCache(key: string, data: FlowSnapshot) {
  latestCache.set(key, { at: Date.now(), data });
}

export function getHistoryCache(key: string, allowStale = false) {
  const entry = historyCache.get(key);
  return entry && (allowStale || Date.now() - entry.at < 15_000) ? entry.data : null;
}

export function setHistoryCache(key: string, data: FlowSnapshot[]) {
  historyCache.set(key, { at: Date.now(), data });
}

export function getWebhookSnapshot() {
  return webhookSnapshot;
}

export function getWebhookHistory() {
  return webhookHistory;
}

export function saveWebhookSnapshot(snapshot: FlowSnapshot) {
  webhookSnapshot = snapshot;
  webhookHistory = [...webhookHistory, snapshot].slice(-50);
}

export function normalizeWebhook(body: any): FlowSnapshot | null {
  const now = Date.now();
  if (!body || typeof body !== "object") return null;

  if (body.forex || body.metals || body.crypto) {
    return {
      time: body.time || new Date(now).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB",
      mode: body.mode || "Webhook",
      forex: Array.isArray(body.forex) ? body.forex : [],
      metals: Array.isArray(body.metals) ? body.metals : [],
      crypto: Array.isArray(body.crypto) ? body.crypto : [],
      inst: Array.isArray(body.inst) ? body.inst : [],
      context: body.context || {},
      timestamp: now,
    };
  }

  if (Array.isArray(body.data)) {
    const snapshot: FlowSnapshot = {
      time: new Date(body.t || now).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB",
      mode: body.tf ? `${body.tf}m` : "PineScript v6",
      forex: [],
      metals: [],
      crypto: [],
      inst: [],
      context: body.context || {},
      timestamp: now,
    };
    const crypto = new Set(["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "SUI", "LINK", "NEAR", "APT", "PEPE", "LTC", "DOT", "RENDER", "FET", "INJ", "SHIB", "TAO"]);
    const metals = new Set(["XAUUSD", "XAGUSD", "XPTUSD", "COPPER", "USOIL", "UKOIL", "NATGAS", "ALUMINUM", "WHEAT", "GOLD", "SILVER", "NGAS"]);
    const indices = new Set(["US500", "US100", "US30", "US2000", "GER40", "UK100", "JP225", "HK33", "SPX", "NDX", "DJI", "DXY", "US10Y", "VIX", "DE40"]);

    for (const item of body.data) {
      const pair = item?.p || item?.pair || item?.c || item?.name || "UNKNOWN";
      const pct = Number(item?.chg ?? item?.pct ?? item?.r ?? 0) || 0;
      const entry = { pair, pct, dir: item?.dir || (pct >= 0 ? "LONG" : "SHORT"), price: item?.c ?? item?.price };
      const category = String(body.cat || "").toLowerCase();
      if (category === "crypto" || crypto.has(pair)) snapshot.crypto!.push(entry);
      else if (["metal", "metals", "commodities"].includes(category) || metals.has(pair)) snapshot.metals!.push(entry);
      else if (["macro", "inst", "indices"].includes(category) || indices.has(pair)) snapshot.inst!.push(entry);
      else snapshot.forex!.push(entry);
    }
    return snapshot;
  }

  if (body.pairs || body.items || body.coins || body.inst) {
    const normalize = (items: any) => Array.isArray(items) ? items.map((item) => {
      const pct = Number(item?.pct ?? item?.r ?? 0) || 0;
      return { pair: item?.pair || item?.p || item?.c || item?.n || "UNKNOWN", pct, dir: item?.dir || (pct >= 0 ? "LONG" : "SHORT"), price: item?.price };
    }) : [];
    return {
      time: new Date(body.t || now).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB",
      mode: body.mode || "PineScript",
      forex: normalize(body.pairs),
      metals: normalize(body.items || body.metals),
      crypto: normalize(body.coins || body.crypto),
      inst: normalize(body.inst),
      context: body.context || {},
      timestamp: now,
    };
  }

  return null;
}
