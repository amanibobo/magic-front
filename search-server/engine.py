"""
CLIP + color + composition search over local inspiration images.
Aligns with current2classic notebook behavior; N is small (brute-force), no FAISS required.
"""

from __future__ import annotations

import json
import os
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from sklearn.preprocessing import normalize
from transformers import CLIPModel, CLIPProcessor

# Default matches notebook; override for faster CPU: openai/clip-vit-base-patch32
CLIP_MODEL_ID = os.environ.get("CLIP_MODEL_ID", "openai/clip-vit-large-patch14")
MANIFEST_PATH = Path(__file__).resolve().parent / "painting_manifest.json"
INSPIRATION_DIR = Path(
    os.environ.get(
        "INSPIRATION_DIR",
        str(Path(__file__).resolve().parent.parent / "web" / "public" / "inspiration"),
    )
)

# WikiArt (huggan/wikiart) is indexed by default into SQLite/Postgres (see corpus_db).
# Set SEARCH_CORPUS=local to use only web/public/inspiration + painting_manifest.json.
SEARCH_CORPUS = os.environ.get("SEARCH_CORPUS", "wikiart").strip().lower()
HF_WIKIART_MAX = int(os.environ.get("HF_WIKIART_MAX", "1500"))
# Base URL the browser can use to load /corpus/file/{id} (must match the uvicorn address).
SEARCH_PUBLIC_BASE = os.environ.get("SEARCH_PUBLIC_BASE", "http://127.0.0.1:8000").rstrip("/")
# Legacy on-disk cache (only used if a row is missing in the database).
CORPUS_CACHE_DIR = Path(
    os.environ.get("CORPUS_CACHE_DIR", str(Path(__file__).resolve().parent / "data" / "corpus_jpg"))
)


def _clip_feature_tensor(out) -> torch.Tensor:
    """transformers 5.6+ returns BaseModelOutputWithPooling; older versions return a tensor."""
    if isinstance(out, torch.Tensor):
        return out
    po = getattr(out, "pooler_output", None)
    if po is not None:
        return po
    raise TypeError(f"Unexpected CLIP output type: {type(out)}")


def color_histogram(pil_img: Image.Image, bins: int = 32) -> np.ndarray:
    arr = np.array(pil_img.resize((224, 224)))
    hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
    h = cv2.calcHist([hsv], [0], None, [bins], [0, 180]).flatten()
    s = cv2.calcHist([hsv], [1], None, [bins], [0, 256]).flatten()
    v = cv2.calcHist([hsv], [2], None, [bins], [0, 256]).flatten()
    hist = np.concatenate([h, s, v]).astype(np.float32)
    hist /= hist.sum() + 1e-8
    return hist


def composition_features(pil_img: Image.Image, grid: int = 4) -> np.ndarray:
    arr = np.array(pil_img.resize((224, 224)))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    h, w = edges.shape
    ch, cw = h // grid, w // grid
    feats = np.array(
        [edges[i * ch : (i + 1) * ch, j * cw : (j + 1) * cw].mean() / 255.0 for i in range(grid) for j in range(grid)],
        dtype=np.float32,
    )
    n = np.linalg.norm(feats) + 1e-8
    return feats / n


class SearchEngine:
    def __init__(self) -> None:
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model: CLIPModel | None = None
        self.processor: CLIPProcessor | None = None
        self.meta: list[dict] = []
        self.clip_arr: np.ndarray | None = None
        self.color_arr: np.ndarray | None = None
        self.comp_arr: np.ndarray | None = None
        self._embed_dim: int = 0
        self.corpus_mode: str = "unknown"

    def _clip_embed_image(self, pil: Image.Image) -> np.ndarray:
        assert self.model and self.processor
        inputs = self.processor(images=pil, return_tensors="pt").to(self.device)
        with torch.no_grad():
            t = _clip_feature_tensor(self.model.get_image_features(**inputs))
            t = t / t.norm(dim=-1, keepdim=True)
        return t.cpu().numpy().astype(np.float32)

    def _clip_embed_images_batch(self, pils: list[Image.Image], batch_size: int = 8) -> np.ndarray:
        assert self.model and self.processor
        out: list[np.ndarray] = []
        for i in range(0, len(pils), batch_size):
            batch = pils[i : i + batch_size]
            inputs = self.processor(images=batch, return_tensors="pt", padding=True).to(self.device)
            with torch.no_grad():
                t = _clip_feature_tensor(self.model.get_image_features(**inputs))
                t = t / t.norm(dim=-1, keepdim=True)
            out.append(t.cpu().numpy().astype(np.float32))
        return np.vstack(out)

    def clip_embed_text(self, text: str) -> np.ndarray:
        assert self.model and self.processor
        inputs = self.processor(text=[text], return_tensors="pt", padding=True, truncation=True).to(self.device)
        with torch.no_grad():
            t = _clip_feature_tensor(self.model.get_text_features(**inputs))
            t = t / t.norm(dim=-1, keepdim=True)
        return t.cpu().numpy().astype(np.float32)

    def _load_corpus_local(self) -> list[Path]:
        with open(MANIFEST_PATH) as f:
            manifest: list[dict] = json.load(f)
        self.meta = []
        paths: list[Path] = []
        for item in manifest:
            p = INSPIRATION_DIR / item["file"]
            if not p.exists():
                continue
            paths.append(p)
            self.meta.append(
                {
                    "id": item["id"],
                    "src": f"/inspiration/{item['file']}",
                    "alt": item.get("alt", item["file"]),
                    "style": "—",
                    "genre": "—",
                }
            )
        return paths

    def load(self) -> None:
        if SEARCH_CORPUS == "local" or HF_WIKIART_MAX <= 0:
            self.corpus_mode = "local"
            paths: list[Path] = self._load_corpus_local()
            if not paths:
                raise FileNotFoundError(
                    f"No local corpus images. Check {INSPIRATION_DIR} and {MANIFEST_PATH}."
                )
            print(f"Loading CLIP ({CLIP_MODEL_ID}) on {self.device}…")
            self.model = CLIPModel.from_pretrained(CLIP_MODEL_ID).to(self.device).eval()
            self.processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
            self._embed_dim = int(self.model.config.projection_dim)  # type: ignore[arg-type]
            pils = [Image.open(p).convert("RGB") for p in paths]
            print("Embedding corpus images…")
            self.clip_arr = self._clip_embed_images_batch(pils)
            color_list = [color_histogram(p) for p in pils]
            color_norms = np.stack([normalize(c.reshape(1, -1), norm="l2") for c in color_list]).astype(
                np.float32
            )
            self.color_arr = color_norms.squeeze(axis=1)
            comp_list = [composition_features(p) for p in pils]
            self.comp_arr = np.stack(comp_list, axis=0).astype(np.float32)
            print(f"✅ Index ready: corpus={self.corpus_mode}  |  {len(self.meta)} paintings  |  dim={self._embed_dim}")
            return

        # WikiArt → SQLite/Postgres (see corpus_db); embeddings persisted for fast restarts
        import corpus_db

        corpus_db.init_db()
        print(f"Loading CLIP ({CLIP_MODEL_ID}) on {self.device}…")
        self.model = CLIPModel.from_pretrained(CLIP_MODEL_ID).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)

        try:
            self.corpus_mode = "wikiart"
            if corpus_db.should_rebuild_corpus(HF_WIKIART_MAX):
                print("Corpus empty or out of date — building from huggan/wikiart…")
                corpus_db.build_wikiart_into_db(self, HF_WIKIART_MAX)
            (
                self.meta,
                self.clip_arr,
                self.color_arr,
                self.comp_arr,
                d_clip,
            ) = corpus_db.load_index_from_db(SEARCH_PUBLIC_BASE)
            self._embed_dim = d_clip
        except Exception as e:
            print(f"WikiArt database corpus failed ({e}); falling back to local inspiration images.")
            self.corpus_mode = "local (fallback)"
            self.meta = []
            paths: list[Path] = self._load_corpus_local()
            if not paths:
                raise
            pils = [Image.open(p).convert("RGB") for p in paths]
            self._embed_dim = int(self.model.config.projection_dim)  # type: ignore[arg-type]
            self.clip_arr = self._clip_embed_images_batch(pils)
            color_list = [color_histogram(p) for p in pils]
            color_norms = np.stack([normalize(c.reshape(1, -1), norm="l2") for c in color_list]).astype(
                np.float32
            )
            self.color_arr = color_norms.squeeze(axis=1)
            comp_list = [composition_features(p) for p in pils]
            self.comp_arr = np.stack(comp_list, axis=0).astype(np.float32)
            return

        print(
            f"✅ Index ready: corpus={self.corpus_mode} (database)  |  {len(self.meta)} paintings  |  dim={self._embed_dim}"
        )

    def health(self) -> dict:
        return {
            "ok": self.model is not None and len(self.meta) > 0,
            "paintings": len(self.meta),
            "device": self.device,
            "model": CLIP_MODEL_ID,
            "corpus": self.corpus_mode,
        }

    def search_by_image(
        self,
        pil: Image.Image,
        top_k: int,
        w_clip: float,
        w_color: float,
        w_comp: float,
    ) -> list[dict]:
        if not self.model or self.clip_arr is None:
            raise RuntimeError("Engine not loaded")

        q_c = self._clip_embed_image(pil)
        ch = color_histogram(pil)
        q_color = normalize(ch.reshape(1, -1), norm="l2").astype(np.float32).flatten()
        q_comp = composition_features(pil)
        w_sum = w_clip + w_color + w_comp
        if w_sum <= 0:
            w_clip, w_color, w_comp, w_sum = 0.6, 0.25, 0.15, 1.0
        w_clip, w_color, w_comp = w_clip / w_sum, w_color / w_sum, w_comp / w_sum

        n = self.clip_arr.shape[0]
        sim_clip = (self.clip_arr @ q_c.T).flatten()
        sim_color = (self.color_arr @ q_color).flatten()
        sim_comp = np.array([float(np.dot(self.comp_arr[i], q_comp)) for i in range(n)])

        combined = w_clip * sim_clip + w_color * sim_color + w_comp * sim_comp
        order = np.argsort(-combined)[: int(top_k)]

        results: list[dict] = []
        for rank, idx in enumerate(order, start=1):
            i = int(idx)
            meta_i = self.meta[i]
            results.append(
                {
                    "id": f"r{rank}-{meta_i['id']}",
                    "src": meta_i["src"],
                    "alt": meta_i["alt"],
                    "rank": rank,
                    "score": float(combined[i]),
                    "style": str(meta_i.get("style", "—")),
                    "genre": str(meta_i.get("genre", "—")),
                    "clip": float(w_clip * sim_clip[i]),
                    "color": float(w_color * sim_color[i]),
                    "comp": float(w_comp * sim_comp[i]),
                }
            )
        return results

    def search_by_text(self, text: str, top_k: int) -> list[dict]:
        if not self.model or self.clip_arr is None:
            raise RuntimeError("Engine not loaded")
        if not text.strip():
            return []

        q = self.clip_embed_text(text.strip())  # (1, D)
        sim = (self.clip_arr @ q.T).flatten()
        order = np.argsort(-sim)[: int(top_k)]
        results: list[dict] = []
        for rank, idx in enumerate(order, start=1):
            i = int(idx)
            s = float(sim[i])
            meta_i = self.meta[i]
            results.append(
                {
                    "id": f"r{rank}-t-{meta_i['id']}",
                    "src": meta_i["src"],
                    "alt": meta_i["alt"],
                    "rank": rank,
                    "score": s,
                    "style": str(meta_i.get("style", "—")),
                    "genre": str(meta_i.get("genre", "—")),
                    "clip": s,
                    "color": 0.0,
                    "comp": 0.0,
                }
            )
        return results
