# Label lists aligned with huggan/wikiart class indices (see current2classic notebook).

STYLE_LABELS = [
    "Abstract Expressionism",
    "Action Painting",
    "Analytical Cubism",
    "Art Nouveau",
    "Baroque",
    "Color Field Painting",
    "Contemporary Realism",
    "Cubism",
    "Early Renaissance",
    "Expressionism",
    "Fauvism",
    "High Renaissance",
    "Impressionism",
    "Mannerism / Late Renaissance",
    "Minimalism",
    "Naïve Art / Primitivism",
    "New Realism",
    "Northern Renaissance",
    "Pointillism",
    "Pop Art",
    "Post-Impressionism",
    "Realism",
    "Rococo",
    "Romanticism",
    "Symbolism",
    "Synthetic Cubism",
    "Ukiyo-e",
]

GENRE_LABELS = [
    "Abstract",
    "Cityscape",
    "Flower Painting",
    "Genre Painting",
    "Illustration",
    "Landscape",
    "Nude Painting",
    "Portrait",
    "Religious Painting",
    "Sketch & Study",
    "Still Life",
]


def decode_label(idx: int | str | object, label_list: list[str], fallback: str = "Unknown") -> str:
    if isinstance(idx, str) and idx.strip():
        return idx
    try:
        i = int(idx)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return fallback
    if 0 <= i < len(label_list):
        return label_list[i]
    return fallback
