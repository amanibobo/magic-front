import { NextResponse } from "next/server";

const TIMEOUT_MS = 120_000;

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const base = process.env.CLASSIC_SEARCH_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.CLASSIC_SEARCH_API_KEY;

  if (!base) {
    return NextResponse.json(
      { error: "CLASSIC_SEARCH_API_URL is not set. Add it to .env and run the search-server (see search-server/README.md)." },
      { status: 503 }
    );
  }

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      // Forward the raw body + original Content-Type (incl. boundary). Re-sending
      // a parsed `FormData` to Node’s fetch is unreliable; the file often arrives empty at FastAPI.
      const target = new URL("/search/image", base).toString();
      const body = await req.arrayBuffer();
      const r = await fetch(target, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "content-type": contentType,
          ...(apiKey ? { "X-API-Key": apiKey } : {}),
        },
      });
      const data = (await r.json().catch(() => ({}))) as object;
      if (!r.ok) {
        return NextResponse.json(
          { error: (data as { detail?: string }).detail ?? r.statusText },
          { status: 502 }
        );
      }
      return NextResponse.json(data);
    }

    if (contentType.includes("application/json")) {
      const body = await req.json();
      const target = new URL("/search/text", base).toString();
      const r = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-API-Key": apiKey } : {}),
        },
        body: JSON.stringify({
          query: String(body.query ?? ""),
          topK: Number(body.topK ?? 4),
          wClip: Number(body.wClip ?? 0.6),
          wColor: Number(body.wColor ?? 0.25),
          wComp: Number(body.wComp ?? 0.15),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = (await r.json().catch(() => ({}))) as object;
      if (!r.ok) {
        return NextResponse.json(
          { error: (data as { detail?: string }).detail ?? r.statusText },
          { status: 502 }
        );
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Expected multipart or JSON" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
