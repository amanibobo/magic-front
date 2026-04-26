"""
Run locally (no Docker):
  cd search-server
  python -m venv .venv
  source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
  pip install -r requirements.txt
  uvicorn main:app --host 127.0.0.1 --port 8000 --reload
"""

from pathlib import Path

# Load search-server/.env so HF_TOKEN / keys are set before any Hub or model imports.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

import os
from contextlib import asynccontextmanager
from io import BytesIO
from typing import Optional

from fastapi import Body, FastAPI, File, Form, HTTPException, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image
from pydantic import BaseModel, Field

import corpus_db
from engine import CORPUS_CACHE_DIR, SearchEngine

engine = SearchEngine()
REQUIRED_KEY = os.environ.get("CLASSIC_SEARCH_API_KEY", "").strip()


@asynccontextmanager
async def lifespan(_: FastAPI):
    engine.load()
    yield


def check_key(x_api_key: Optional[str]) -> None:
    if not REQUIRED_KEY:
        return
    if (x_api_key or "").strip() != REQUIRED_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


app = FastAPI(title="Classic image compare — search", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        o.strip()
        for o in os.environ.get("CORS_ALLOW_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000").split(",")
        if o.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {**engine.health(), "version": "1.0"}


@app.get("/corpus/file/{file_id}")
def get_corpus_image(file_id: int):
    """JPEG for corpus id — stored in the database, or legacy file under data/corpus_jpg/."""
    blob = corpus_db.get_image_jpeg(file_id)
    if blob is not None:
        return Response(content=blob, media_type="image/jpeg")
    legacy = CORPUS_CACHE_DIR / f"{file_id}.jpg"
    if legacy.is_file():
        return FileResponse(legacy, media_type="image/jpeg", filename=f"corpus-{file_id}.jpg")
    raise HTTPException(status_code=404, detail="Corpus file not found")


@app.post("/search/image")
async def search_image(
    file: UploadFile = File(...),
    topK: int = Form(4),
    wClip: float = Form(0.6),
    wColor: float = Form(0.25),
    wComp: float = Form(0.15),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
):
    check_key(x_api_key)
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    try:
        pil = Image.open(BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Invalid image: {e}") from e
    try:
        results = engine.search_by_image(
            pil, top_k=topK, w_clip=wClip, w_color=wColor, w_comp=wComp
        )
    except Exception as e:
        raise HTTPException(500, str(e)) from e
    return {"source": "clip", "mode": "image", "results": results}


class TextSearchBody(BaseModel):
    query: str = Field(..., min_length=1)
    topK: int = Field(4, ge=1, le=20)
    wClip: float = Field(0.6, ge=0, le=1)
    wColor: float = Field(0.25, ge=0, le=1)
    wComp: float = Field(0.15, ge=0, le=1)


@app.post("/search/text")
def search_text(
    body: TextSearchBody = Body(...),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
):
    check_key(x_api_key)
    try:
        results = engine.search_by_text(body.query.strip(), top_k=body.topK)
    except Exception as e:
        raise HTTPException(500, str(e)) from e
    return {"source": "clip", "mode": "text", "results": results}
