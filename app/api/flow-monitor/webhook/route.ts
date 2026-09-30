import { normalizeWebhook, saveWebhookSnapshot } from "../_shared";

export async function POST(request: Request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 2_000_000) {
    return Response.json({ error: "Payload terlalu besar." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Payload harus berupa JSON." }, { status: 400 });
  }

  const snapshot = normalizeWebhook(body);
  if (!snapshot) {
    return Response.json({ error: "Format payload tidak dikenali." }, { status: 400 });
  }

  saveWebhookSnapshot(snapshot);
  return Response.json({ ok: true, saved: true, timestamp: snapshot.timestamp });
}
