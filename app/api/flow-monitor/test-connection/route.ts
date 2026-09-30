import { fetchJson, workerTarget } from "../_shared";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Isi URL Worker terlebih dahulu." }, { status: 400 });
  }

  if (typeof body?.workerUrl !== "string" || !body.workerUrl.trim()) {
    return Response.json({ ok: false, error: "URL Worker diperlukan." }, { status: 400 });
  }

  try {
    const target = workerTarget(body.workerUrl, "latest");
    const startTime = Date.now();
    const data: any = await fetchJson(target);
    return Response.json({
      ok: true,
      endpointUsed: target.toString(),
      latencyMs: Date.now() - startTime,
      format: "flow_monitor",
      sample: {
        time: data.time,
        forexCount: Array.isArray(data.forex) ? data.forex.length : 0,
        metalsCount: Array.isArray(data.metals || data.items) ? (data.metals || data.items).length : 0,
        cryptoCount: Array.isArray(data.crypto) ? data.crypto.length : 0,
        contextKeys: data.context ? Object.keys(data.context) : [],
      },
    });
  } catch (error) {
    return Response.json({ ok: false, error: `Gagal menghubungi Worker: ${(error as Error).message}` });
  }
}
