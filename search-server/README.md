# Classic search API (no Docker)

This service matches your `current2classicMAGICHOURBOUNTY.ipynb` pipeline: **CLIP + color + composition** over a painting corpus.

**Default corpus** is the [**huggan/wikiart**](https://huggingface.co/datasets/huggan/wikiart) dataset, streamed on first build. Instead of thousands of files on disk, **JPEGs and CLIP/color/comp vectors** are stored in a **SQL database** (default: SQLite at `data/corpus.db` via `DATABASE_URL`). The API still serves `GET /corpus/file/{id}` from the DB; restarts re-load the index from SQL (no re-embedding) unless you change `HF_WIKIART_MAX` or clear the table. A legacy on-disk `data/corpus_jpg/{id}.jpg` is only used as a fallback if a row is missing in the database.

**Local-only mode:** set `SEARCH_CORPUS=local` to index only the 12 files in `web/public/inspiration/` and `painting_manifest.json` (no WikiArt download).

## Setup

1. **Python 3.10+** recommended.
2. Create a venv and install:

```bash
cd search-server
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

3. **Hugging Face token (recommended)** — required for a smooth first WikiArt stream and for CLIP model weights. Create a token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens), then set `HF_TOKEN` in `search-server/.env` (or export in the shell before `uvicorn`).

   **Browser image URLs** — the API returns `src` like `http://127.0.0.1:8000/corpus/file/0`. If your app runs on a different host, set `SEARCH_PUBLIC_BASE` in `search-server/.env` to the same base URL the browser will use to reach the API (e.g. `http://localhost:8000`).

   | Variable | Default | Meaning |
   |----------|---------|--------|
   | `SEARCH_CORPUS` | `wikiart` | `wikiart` = HF `huggan/wikiart`, `local` = 12 inspiration PNGs only |
   | `HF_WIKIART_MAX` | `1500` | How many gallery images to index (raise for better recall, slower first boot) |
   | `SEARCH_PUBLIC_BASE` | `http://127.0.0.1:8000` | Base URL for `results[].src` to load images in the Next app |
   | `DATABASE_URL` | (embedded SQLite `data/corpus.db`) | SQLAlchemy URL; e.g. `postgresql+psycopg2://user:pass@host/db` for a hosted database |

4. On first start, `openai/clip-vit-large-patch14` and weights download from Hugging Face (several GB). For faster **CPU** testing you can use:

```bash
export CLIP_MODEL_ID=openai/clip-vit-base-patch32
```

5. **Run the API:**

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

6. In another terminal, point the Next app at it (in `web/`):

```bash
# web/.env.local
CLASSIC_SEARCH_API_URL=http://127.0.0.1:8000
# Optional, if you set CLASSIC_SEARCH_API_KEY in the environment of uvicorn:
# CLASSIC_SEARCH_API_KEY=your-secret
```

Then `cd web && npm run dev` — with `CLASSIC_SEARCH_API_URL` set, **Find** uses the search-server; without it, search will error until you configure the URL and run the API.

## Endpoints

- `GET /health` — model loaded, device, `corpus` (`wikiart` / `local`), number of paintings indexed.
- `GET /corpus/file/{n}` — JPEG for WikiArt index row `n` (this URL is `results[].src` for the web UI).
- `POST /search/image` — `multipart/form-data`: `file`, `topK`, `wClip`, `wColor`, `wComp`. Optional header `X-API-Key`.
- `POST /search/text` — JSON: `query`, `topK`, `wClip`, `wColor`, `wComp`.

## Full notebook index (3k+ paintings)

To use your FAISS index from the notebook instead of the 12 local images: export the index files and `metadata.json` from the notebook, set `INSPIRATION_DIR` / wire metadata paths in a fork of `engine.py` (or load `faiss.read_index` the same way the notebook does). The FastAPI layer can stay the same.

## CORS

Defaults allow `http://localhost:3000` and `http://127.0.0.1:3000`. Override with `CORS_ALLOW_ORIGINS` (comma-separated).
