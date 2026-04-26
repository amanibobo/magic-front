"""
Persistent WikiArt corpus: image bytes + precomputed CLIP / color / comp vectors.

Default: SQLite at data/corpus.db. Set DATABASE_URL=postgresql+psycopg2://user:pass@host/db
for a hosted Postgres. No thousand loose .jpg files under data/corpus_jpg/ are required.
"""

from __future__ import annotations

import json
import os
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

import numpy as np
from sklearn.preprocessing import normalize
from sqlalchemy import Integer, LargeBinary, MetaData, String, Text, create_engine, delete, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

if TYPE_CHECKING:
    from engine import SearchEngine

from wikiart_labels import STYLE_LABELS, GENRE_LABELS, decode_label

_COLOR_DIM = 32 * 3  # color_histogram
_COMP_DIM = 4 * 4  # composition_features

_DEFAULT_SQLITE = str(Path(__file__).resolve().parent / "data" / "corpus.db")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{_DEFAULT_SQLITE}").strip()

_meta = MetaData()


class Base(DeclarativeBase):
    metadata = _meta


class AppKV(Base):
    __tablename__ = "app_kv"
    k: Mapped[str] = mapped_column(String(64), primary_key=True)
    v: Mapped[str] = mapped_column(Text, nullable=False)


class CorpusItem(Base):
    __tablename__ = "corpus_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # 0 .. n-1
    style: Mapped[str] = mapped_column(String(200), nullable=False)
    genre: Mapped[str] = mapped_column(String(200), nullable=False)
    alt: Mapped[str] = mapped_column(Text, nullable=False)
    image_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    clip: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # float32 [d]
    color: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # float32 [_COLOR_DIM] L2-norm
    comp: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # float32 [_COMP_DIM] unit norm


_engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


def _session() -> Session:
    return SessionLocal()


def _ensure_data_dir() -> None:
    if DATABASE_URL.startswith("sqlite"):
        p = Path(DATABASE_URL.replace("sqlite:///", ""))
        p.parent.mkdir(parents=True, exist_ok=True)


def init_db() -> None:
    _ensure_data_dir()
    Base.metadata.create_all(_engine)


def get_wikiart_index_key(hf_max: int) -> str:
    return json.dumps({"source": "wikiart", "hf_wikiart_max": hf_max}, sort_keys=True)


def get_stored_index_key() -> Optional[str]:
    with _session() as s:
        row = s.get(AppKV, "wikiart_index")
        if row is None:
            return None
        return row.v


def set_stored_index_key(hf_max: int) -> None:
    with _session() as s:
        s.merge(
            AppKV(
                k="wikiart_index",
                v=get_wikiart_index_key(hf_max),
            )
        )
        s.commit()


def count_corpus_rows() -> int:
    with _session() as s:
        r = s.execute(text("SELECT COUNT(*) FROM corpus_items"))
        return int(r.scalar() or 0)


def should_rebuild_corpus(hf_wikiart_max: int) -> bool:
    """True if table missing, empty, or HF_WIKIART_MAX / source changed."""
    k = get_stored_index_key()
    n = count_corpus_rows()
    if n == 0 or k is None:
        return True
    if n != hf_wikiart_max:
        return True
    try:
        j = json.loads(k)
    except json.JSONDecodeError:
        return True
    if j.get("source") != "wikiart" or int(j.get("hf_wikiart_max", -1)) != hf_wikiart_max:
        return True
    return False


def clear_corpus() -> None:
    with _session() as s:
        s.execute(delete(CorpusItem))
        s.execute(delete(AppKV).where(AppKV.k == "wikiart_index"))
        s.commit()


def f32_tobytes(a: np.ndarray) -> bytes:
    return np.asarray(a, dtype=np.float32).tobytes()


def f32_vec_d(b: bytes, d: int) -> np.ndarray:
    a = np.frombuffer(b, dtype=np.float32).copy()
    return a.reshape(d)


def f32_vec_clip(b: bytes) -> np.ndarray:
    return np.frombuffer(b, dtype=np.float32).copy()


def get_image_jpeg(corpus_id: int) -> Optional[bytes]:
    with _session() as s:
        row = s.get(CorpusItem, corpus_id)
        if row is None:
            return None
        return row.image_bytes


def load_index_from_db(
    public_base: str,
) -> tuple[list[dict[str, Any]], np.ndarray, np.ndarray, np.ndarray, int]:
    """
    Reconstruct meta + embedding matrices from DB (fast cold start, no re-encode).
    Returns (meta, clip_arr, color_arr, comp_arr, embed_dim)
    """
    with _session() as s:
        rows = s.execute(select(CorpusItem).order_by(CorpusItem.id)).scalars().all()
    if not rows:
        raise ValueError("Empty corpus_items")
    meta: list[dict[str, Any]] = []
    clip_rows: list[np.ndarray] = []
    color_rows: list[np.ndarray] = []
    comp_rows: list[np.ndarray] = []
    d_clip = 0
    for row in rows:
        meta.append(
            {
                "id": str(row.id),
                "src": f"{public_base.rstrip('/')}/corpus/file/{row.id}",
                "alt": row.alt,
                "style": row.style,
                "genre": row.genre,
            }
        )
        c = f32_vec_clip(row.clip)
        if d_clip == 0:
            d_clip = c.size
        clip_rows.append(c)
        color_rows.append(f32_vec_d(row.color, _COLOR_DIM))
        comp_rows.append(f32_vec_d(row.comp, _COMP_DIM))
    return (
        meta,
        np.vstack(clip_rows).astype(np.float32),
        np.vstack(color_rows).astype(np.float32),
        np.vstack(comp_rows).astype(np.float32),
        d_clip,
    )


def _pil_from_dataset_image(item_image) -> Any:  # PIL
    from PIL import Image
    if isinstance(item_image, Image.Image):
        return item_image.convert("RGB")
    if isinstance(item_image, dict):
        if item_image.get("bytes"):
            return Image.open(BytesIO(item_image["bytes"])).convert("RGB")
        if item_image.get("path"):
            return Image.open(item_image["path"]).convert("RGB")
    if isinstance(item_image, (bytes, bytearray)):
        return Image.open(BytesIO(item_image)).convert("RGB")
    raise TypeError(f"Unsupported image field: {type(item_image)}")


def build_wikiart_into_db(
    se: "SearchEngine",
    hf_wikiart_max: int,
) -> None:
    """Stream WikiArt, compute embeddings, store JPEG+vectors in the database."""
    from datasets import load_dataset  # type: ignore[import-not-found]

    init_db()
    clear_corpus()
    if se.model is None or se.processor is None:
        raise RuntimeError("CLIP model must be loaded before build_wikiart_into_db")
    from PIL import Image

    def jpeg_bytes(pil: Image.Image) -> bytes:
        buf = BytesIO()
        pil.save(buf, "JPEG", quality=92, optimize=True)
        return buf.getvalue()

    print(f"Building WikiArt index into database (up to {hf_wikiart_max} rows)…")
    dataset = load_dataset("huggan/wikiart", split="train", streaming=True)
    batch_pils: list[Image.Image] = []
    batch_meta: list[tuple] = []  # (n, style, genre, alt)
    for n, item in enumerate(dataset):
        if n >= hf_wikiart_max:
            break
        pil = _pil_from_dataset_image(item["image"])
        style = decode_label(item.get("style", -1), STYLE_LABELS)
        genre = decode_label(item.get("genre", -1), GENRE_LABELS)
        alt = f"{style} — {genre}"[:500]
        batch_pils.append(pil)
        batch_meta.append((n, style, genre, alt))
        if len(batch_pils) == 8 or n == hf_wikiart_max - 1:
            _flush_batch(se, batch_pils, batch_meta, jpeg_bytes)
            batch_pils = []
            batch_meta = []
    if batch_pils:
        _flush_batch(se, batch_pils, batch_meta, jpeg_bytes)
    set_stored_index_key(hf_wikiart_max)
    n_stored = count_corpus_rows()
    db_hint = (DATABASE_URL[:50] + "…") if len(DATABASE_URL) > 50 else DATABASE_URL
    print(f"✅ Stored {n_stored} corpus rows in database ({db_hint})")


def _flush_batch(
    se: "SearchEngine",
    pils: list,
    metas: list[tuple],
    jpeg_bytes,
) -> None:
    from engine import color_histogram, composition_features
    import torch

    with torch.no_grad():
        clip_mat = se._clip_embed_images_batch(pils)  # (B, d)
    rows: list[CorpusItem] = []
    for i, pil in enumerate(pils):
        n, style, genre, alt = metas[i]
        ch = color_histogram(pil)
        color_normed = normalize(ch.reshape(1, -1), norm="l2").astype(np.float32).flatten()
        comp = composition_features(pil)
        row = CorpusItem(
            id=n,
            style=style,
            genre=genre,
            alt=alt,
            image_bytes=jpeg_bytes(pil),
            clip=f32_tobytes(clip_mat[i]),
            color=f32_tobytes(color_normed),
            comp=f32_tobytes(comp),
        )
        rows.append(row)
    with _session() as s:
        for r in rows:
            s.add(r)
        s.commit()
