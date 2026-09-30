import {
  fetchJson,
  getHistoryCache,
  getWebhookHistory,
  setHistoryCache,
  workerTarget,
} from "../_shared";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  let target: URL;
  try {
    target = workerTarget(requestUrl.searchParams.get("workerUrl"), "history");
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }

  const cacheKey = target.origin + target.pathname;
  const cached = getHistoryCache(cacheKey);
  if (cached) return Response.json({ source: "cache", data: cached });

  try {
    const data = await fetchJson(target);
    if (!Array.isArray(data)) throw new Error("Worker returned invalid history");
    setHistoryCache(cacheKey, data);
    return Response.json({ source: "live_worker", data });
  } catch {
    const fallback = getHistoryCache(cacheKey, true) || getWebhookHistory();
    return Response.json({ source: fallback.length ? "fallback_cache" : "empty", data: fallback });
  }
}
