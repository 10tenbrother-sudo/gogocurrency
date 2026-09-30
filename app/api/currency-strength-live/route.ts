const cache = new Map<string, { expiresAt: number; data: unknown }>();
const CACHE_MS = 15_000;

export async function GET(request: Request) {
  const range = new URL(request.url).searchParams.get("range") === "2d" ? "2d" : "1d";
  const now = Date.now();
  const cached = cache.get(range);
  if (cached && cached.expiresAt > now) {
    return Response.json({ source: "cache", data: cached.data });
  }

  try {
    const upstream = await fetch(
      `https://currency-strength.com/php/chart${range}.json?id=${now}`,
      {
        headers: {
          Accept: "application/json",
          Referer: "https://currency-strength.com/en/",
          "User-Agent": "FlowMonitor/1.0",
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!upstream.ok) throw new Error(`Upstream returned ${upstream.status}`);

    const data: unknown = await upstream.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Upstream returned no currency-strength series");
    }
    cache.set(range, { expiresAt: now + CACHE_MS, data });
    return Response.json({ source: "live", data });
  } catch (error) {
    const stale = cache.get(range);
    if (stale) return Response.json({ source: "fallback_cache", data: stale.data });
    return Response.json(
      { error: "Currency-strength data is temporarily unavailable" },
      { status: 502 },
    );
  }
}
