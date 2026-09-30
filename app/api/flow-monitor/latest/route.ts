import {
  fetchJson,
  getLatestCache,
  getWebhookSnapshot,
  setLatestCache,
  workerTarget,
} from "../_shared";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  let target: URL;
  try {
    target = workerTarget(requestUrl.searchParams.get("workerUrl"), "latest");
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }

  const cacheKey = target.origin + target.pathname;
  const cached = getLatestCache(cacheKey);
  if (cached) return Response.json({ source: "cache", data: cached });

  try {
    const data: any = await fetchJson(target);
    if (!data || typeof data !== "object") throw new Error("Worker returned an invalid snapshot");

    // Use live Binance prices when the connected Worker does not provide recent crypto values.
    try {
      const symbols = encodeURIComponent(JSON.stringify(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT"]));
      const market = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (market.ok) {
        const rows: any = await market.json();
        if (Array.isArray(rows)) {
          const liveCoins = rows.map((row) => {
            const pct = Number(row.priceChangePercent) || 0;
            return { pair: String(row.symbol).replace(/USDT$/, ""), pct: Number(pct.toFixed(2)), dir: pct >= 0 ? "LONG" : "SHORT", price: Number(row.lastPrice) || 0 };
          });
          const current = Array.isArray(data.crypto) ? data.crypto : [];
          for (const coin of liveCoins) {
            const index = current.findIndex((item: any) => [coin.pair, `${coin.pair}USD`, `${coin.pair}USDT`].includes(item.pair));
            if (index < 0) current.push(coin);
            else current[index] = { ...current[index], ...coin };
          }
          data.crypto = current;
        }
      }
    } catch {
      // A failed secondary price source does not invalidate the Worker snapshot.
    }

    setLatestCache(cacheKey, data);
    return Response.json({ source: "live_worker", data });
  } catch (error) {
    const fallback = getLatestCache(cacheKey, true) || getWebhookSnapshot();
    if (fallback) {
      return Response.json({ source: getLatestCache(cacheKey, true) ? "fallback_cache" : "webhook_memory", data: fallback });
    }
    return Response.json({ error: "Data Flow Monitor belum tersedia dari Worker." }, { status: 502 });
  }
}
