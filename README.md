# Magic Hour (Classic Image Compare)

Next.js UI + Python API: upload a photo or type a description, and find similar works from a CLIP-indexed art corpus (WikiArt by default, or a small local set).

## Layout

| Path | Role |
|------|------|
| `web/` | Next.js app: compare UI, `/api/search` proxy |
| `search-server/` | FastAPI: CLIP search, `GET /corpus/file/{id}` for thumbnails |
| `search-server/README.md` | Corpus, env, and API details |

## Run locally

**1. Search API** (from repo root or `search-server/`)

```bash
cd search-server
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # add HF_TOKEN; see .env.example
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**2. Web app**

```bash
cd web
cp .env.local.example .env.local
# set CLASSIC_SEARCH_API_URL to match the API (e.g. http://127.0.0.1:8000)
npm install && npm run dev
```

Open the URL printed by Next (usually [http://localhost:3000](http://localhost:3000)). Search needs both processes running.

## Environment (minimal)

- **`web/.env.local`:** `CLASSIC_SEARCH_API_URL` (and optional `CLASSIC_SEARCH_API_KEY` if the API uses it).
- **`search-server/.env`:** `HF_TOKEN` (recommended), optional `SEARCH_PUBLIC_BASE`, `DATABASE_URL`, `CLASSIC_SEARCH_API_KEY` — see `search-server/.env.example`.

## Deploy

Run **Next** on a host of your choice (e.g. Vercel) and the **search API** on a long-running service with enough RAM for PyTorch/CLIP. Point `CLASSIC_SEARCH_API_URL` at the public API base URL and set `SEARCH_PUBLIC_BASE` on the server to the same origin so image URLs in results load in the browser.

---

More detail: [search-server/README.md](search-server/README.md)
