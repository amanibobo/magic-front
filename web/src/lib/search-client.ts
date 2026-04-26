export type SearchResult = {
  id: string;
  src: string;
  alt: string;
  rank: number;
  score: number;
  style: string;
  genre: string;
  clip: number;
  color: number;
  comp: number;
};

export type SearchResponse =
  | { ok: true; source: "api"; results: SearchResult[] }
  | { ok: false; error: string };

function normalizeApiPayload(data: unknown): SearchResult[] {
  if (data === null || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const arr = d.results;
  if (!Array.isArray(arr)) return [];
  return arr.map((r, i) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id ?? `row-${i}`),
      src: String(x.src ?? ""),
      alt: String(x.alt ?? ""),
      rank: Number(x.rank ?? i + 1),
      score: Number(x.score ?? 0),
      style: String(x.style ?? "—"),
      genre: String(x.genre ?? "—"),
      clip: Number(x.clip ?? 0),
      color: Number(x.color ?? 0),
      comp: Number(x.comp ?? 0),
    };
  });
}

export type SearchByImageInput = {
  mode: "image";
  file: File;
  topK: number;
  wClip: number;
  wColor: number;
  wComp: number;
};

export type SearchByTextInput = {
  mode: "text";
  query: string;
  topK: number;
  wClip: number;
  wColor: number;
  wComp: number;
};

/**
 * POST `/api/search` — proxies to the Python service when `CLASSIC_SEARCH_API_URL` is set.
 */
export async function runSearchRequest(input: SearchByImageInput | SearchByTextInput): Promise<SearchResponse> {
  try {
    if (input.mode === "image") {
      const fd = new FormData();
      fd.append("file", input.file, input.file.name);
      fd.append("topK", String(input.topK));
      fd.append("wClip", String(input.wClip));
      fd.append("wColor", String(input.wColor));
      fd.append("wComp", String(input.wComp));
      const res = await fetch("/api/search", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { results?: unknown; error?: string };
      if (!res.ok) {
        return { ok: false, error: data.error ?? res.statusText };
      }
      return { ok: true, source: "api", results: normalizeApiPayload(data) };
    }

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "text",
        query: input.query,
        topK: input.topK,
        wClip: input.wClip,
        wColor: input.wColor,
        wComp: input.wComp,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { results?: unknown; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? res.statusText };
    }
    return { ok: true, source: "api", results: normalizeApiPayload(data) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: msg };
  }
}
