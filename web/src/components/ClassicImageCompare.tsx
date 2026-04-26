"use client";

import {
  ChevronRight,
  ChevronsUpDown,
  Download,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  SlidersHorizontal,
  Wand2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { INSPIRATION_GRID_ITEMS } from "@/lib/inspiration";
import { runSearchRequest, type SearchResult } from "@/lib/search-client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MagicHourNavbar } from "@/components/MagicHourNavbar";
import { CreditsIcon, MagicHourNavActions } from "@/components/MagicHourNavActions";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const NUM_IMAGES = [1, 2, 3, 4] as const;
type TopKChoice = (typeof NUM_IMAGES)[number];

const TEXT_PLACEHOLDER =
  "e.g. a dramatic battle scene at sunset, or Impressionist riverside in golden hour";
const PHOTO_PLACEHOLDER = "Describe what you want the image to be";

/** Magic Hour “M” mark (same path as `MagicHourNavbar` logo) — merge watermark + export. */
const MAGIC_HOUR_MARK_PATH =
  "M28.9376 17.7504L20.6061 0.179184C20.5245 0.00554876 20.2345 0.00554876 20.1529 0.179184L17.1524 6.50446C17.128 6.55304 17.128 6.60885 17.1512 6.65846L22.4639 17.9044C22.5017 17.983 22.5906 18.0347 22.6905 18.0347H28.7098C28.8828 18.0347 29.0021 17.8869 28.9376 17.7504ZM8.85138 0.179184L17.7286 18.938C17.7518 18.9876 17.7518 19.0434 17.7274 19.093L14.7269 25.4193C14.6441 25.593 14.3553 25.593 14.2725 25.4193L8.85016 13.9832C8.76854 13.8106 8.4786 13.8106 8.39698 13.9832L6.53674 17.9034C6.49897 17.9819 6.40882 18.0336 6.31015 18.0336L0.289647 18.0326C0.116659 18.0326 -0.00151013 17.8848 0.0630564 17.7484L8.39698 0.17815C8.47982 0.00554896 8.76854 0.00554876 8.85138 0.179184Z";

function MagicHourMergeWatermark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 29 26"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d={MAGIC_HOUR_MARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** Mark / compare artwork for the "Classic Image Compare" header (80×80 viewBox). */
function ClassicImageCompareMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="m41.06,59.19v-7.08c0-2.43.02-4.88.02-7.31v-26.97c0-.06,0-.12-.02-.18v-5.26h-2.4v5.26h-13.57c-4.1,0-7.45,3.31-7.45,7.45v29.82c0,4.1,3.35,7.45,7.45,7.45h13.57v5.26h2.4s0-5.26.02-5.26c0,0,0-3.17-.02-3.17Zm-14.48-32.51c1.55-1.46,2.37-3.01,2.78-3.96.41.95,1.23,2.5,2.78,3.96,1.79,1.68,3.66,2.41,4.69,2.73-1.03.32-2.91,1.05-4.69,2.73-1.55,1.46-2.37,3.01-2.78,3.96-.41-.95-1.23-2.5-2.78-3.96-1.79-1.68-3.66-2.41-4.69-2.73,1.03-.32,2.91-1.05,4.69-2.73Zm8.4,32.51h-9.6c-2.37,0-4.3-1.92-4.3-4.3v-2.31c0-.36.14-.7.39-.95l11.11-11.1,6.08,5.71v12.95h-3.68Z" />
      <path d="m54.91,17.64h-11.43v28.45l16.27-15.78v24.57c0,2.38-1.93,4.32-4.32,4.32h-11.96v3.17h11.43c4.13,0,7.45-3.35,7.45-7.45v-29.82c0-4.13-3.31-7.45-7.45-7.45Z" />
    </svg>
  );
}

/** Sidebar field row matching Magic Hour / headshot config layout. */
function SidebarField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation="vertical"
      className={cn(
        "group/field data-[invalid=true]:text-destructive flex w-full flex-col gap-3 !p-0 [&>*]:w-full [&>.sr-only]:w-auto",
        className
      )}
    >
      <div
        data-slot="field-label"
        className="text-muted-foreground group/field peer/field flex w-fit items-center gap-2 text-sm font-medium leading-snug select-none group-data-[disabled=true]/field:opacity-50"
      >
        {label}
      </div>
      <div
        data-slot="field-content"
        className="group/field-content flex flex-1 flex-col gap-1.5 leading-snug"
      >
        {children}
      </div>
    </div>
  );
}

const IMAGE_UPLOAD_ACCEPT =
  "image/png,.png,image/jpg,.jpg,image/jpeg,.jpeg,image/heic,.heic,image/webp,.webp,image/avif,.avif,image/jp2,.jp2,image/tiff,.tiff,image/bmp,.bmp";

type GenerationRun = {
  id: string;
  sourceKind: "image" | "text";
  sourceLabel: string;
  /** Data URL when sourceKind is image; null for text */
  sourceDataUrl: string | null;
  matches: SearchResult[];
  at: number;
  /** Which `matches` entry is shown on the right in the main comparison and download */
  focusMatchIndex: number;
};

function focusedMatch(run: GenerationRun): SearchResult | null {
  const n = run.matches.length;
  if (n === 0) return null;
  const i = run.focusMatchIndex;
  const j = Math.min(Math.max(0, i === undefined || i === null || !Number.isFinite(i) ? 0 : i), n - 1);
  return run.matches[j] ?? null;
}

function formatTimeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 45) return "just now";
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number
) {
  const tr = dWidth / dHeight;
  const ir = img.naturalWidth / img.naturalHeight;
  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;
  if (ir > tr) {
    sh = img.naturalHeight;
    sw = sh * tr;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / tr;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
}

function absoluteUrlForCanvas(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
  if (typeof window === "undefined") return src;
  return `${window.location.origin}${src.startsWith("/") ? src : `/${src}`}`;
}

/** User input (left) and focused match (right), e.g. WikiArt image from /corpus/file/{id} on the search-server. */
async function renderMergedCanvas(run: GenerationRun): Promise<HTMLCanvasElement | null> {
  const top = focusedMatch(run);
  if (!top) return null;
  const W = 1600;
  const H = 900;
  const half = W / 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0c0d17";
  ctx.fillRect(0, 0, W, H);

  if (run.sourceKind === "image" && run.sourceDataUrl) {
    const left = await loadImageEl(run.sourceDataUrl);
    drawImageCover(ctx, left, 0, 0, half, H);
  } else {
    ctx.fillStyle = "#0c0d17";
    ctx.fillRect(0, 0, half, H);
    ctx.fillStyle = "rgba(250,250,250,0.92)";
    ctx.font = "500 28px ui-sans-serif, system-ui, sans-serif";
    const text = run.sourceLabel;
    const maxW = half - 80;
    let y = 80;
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, 40, y);
        y += 36;
        line = w;
        if (y > H - 60) break;
      } else {
        line = test;
      }
    }
    if (line && y <= H - 60) ctx.fillText(line, 40, y);
  }

  const rightImg = await loadImageEl(absoluteUrlForCanvas(top.src));
  drawImageCover(ctx, rightImg, half, 0, half, H);

  const seamW = 4;
  ctx.fillStyle = "#000000";
  ctx.fillRect(half - seamW / 2, 0, seamW, H);

  /* Bottom-right Magic Hour mark — visible, not overwhelming (~10% of canvas width max). */
  try {
    const logoDataUrl = `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 26"><path fill="rgba(255,255,255,0.92)" d="${MAGIC_HOUR_MARK_PATH}"/></svg>`
    )}`;
    const logo = await loadImageEl(logoDataUrl);
    const targetW = Math.min(120, Math.round(W * 0.065));
    const targetH = (targetW * 26) / 29;
    const padR = 18;
    const padB = 14;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, W - targetW - padR, H - targetH - padB, targetW, targetH);
    ctx.restore();
  } catch {
    /* ignore watermark load errors */
  }

  return canvas;
}

async function downloadMergedComparison(run: GenerationRun): Promise<void> {
  const canvas = await renderMergedCanvas(run);
  if (!canvas) return;
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No blob"));
          return;
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `classic-compare-${run.id.replace(/[^a-z0-9-]/gi, "").slice(0, 20)}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      },
      "image/png",
      0.92
    );
  });
}

export function ClassicImageCompare() {
  const [mode, setMode] = useState<"image" | "text">("image");
  const [prompt, setPrompt] = useState("");
  const [topK, setTopK] = useState<TopKChoice>(2);
  const [wClip, setWClip] = useState(0.6);
  const [wColor, setWColor] = useState(0.25);
  const [wComp, setWComp] = useState(0.15);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  /** For sending the real file to `/api/search` (CLIP). Cleared when upload cleared. */
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [credits, setCredits] = useState(400);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(
    "Ready. Set CLASSIC_SEARCH_API_URL in .env and run the search-server (search-server/README.md)."
  );
  const [mainTab, setMainTab] = useState<"inspiration" | "generations">("inspiration");
  const [generationRuns, setGenerationRuns] = useState<GenerationRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** Data URL of merged side-by-side for fullscreen lightbox */
  const [mergedPreviewDataUrl, setMergedPreviewDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cost = useMemo(() => 5 * topK, [topK]);
  const weightSummary = useMemo(
    () =>
      `CLIP ${wClip.toFixed(2)} · Color ${wColor.toFixed(2)} · Comp ${wComp.toFixed(2)}`,
    [wClip, wColor, wComp]
  );

  const selectedRun = useMemo((): GenerationRun | null => {
    if (generationRuns.length === 0) return null;
    if (selectedRunId) {
      return generationRuns.find((r) => r.id === selectedRunId) ?? generationRuns[0]!;
    }
    return generationRuns[0]!;
  }, [generationRuns, selectedRunId]);

  /** Shown only after the first successful Find, then always (while this session has any runs). */
  const showGenerationsTab = generationRuns.length > 0;

  const setRunFocusMatch = useCallback((runId: string, matchIndex: number) => {
    setGenerationRuns((prev) =>
      prev.map((r) => {
        if (r.id !== runId) return r;
        const maxI = r.matches.length - 1;
        if (maxI < 0) return r;
        return { ...r, focusMatchIndex: Math.min(Math.max(0, matchIndex), maxI) };
      })
    );
  }, []);

  const onFile = (f: File | null) => {
    if (!f || !f.type.startsWith("image/")) {
      setFilePreview(null);
      setFileName(null);
      setUploadedFile(null);
      return;
    }
    setUploadedFile(f);
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setFilePreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const runSearch = useCallback(async () => {
    if (credits < cost) {
      setStatus("Not enough credits (demo).");
      return;
    }
    if (mode === "text" && !prompt.trim()) {
      setStatus("Enter a text description first.");
      return;
    }
    if (mode === "image" && !filePreview) {
      setStatus("Upload a photo first.");
      return;
    }
    setLoading(true);
    setStatus("Searching…");
    const t0 = performance.now();
    const totalW = wClip + wColor + wComp;
    const nc = totalW > 0 ? totalW : 1;

    let matches: SearchResult[] = [];
    let searchError: string | null = null;

    try {
      if (mode === "text") {
        const res = await runSearchRequest({
          mode: "text",
          query: prompt.trim(),
          topK,
          wClip,
          wColor,
          wComp,
        });
        if (res.ok && res.results.length > 0) {
          matches = res.results;
        } else {
          searchError = res.ok ? "Search returned no results" : res.error;
        }
      } else {
        let file: File | null = uploadedFile;
        if (!file && filePreview?.startsWith("data:") && fileName) {
          const blob = await fetch(filePreview).then((r) => r.blob());
          file = new File([blob], fileName, { type: blob.type || "image/png" });
        }
        if (file) {
          const res = await runSearchRequest({
            mode: "image",
            file,
            topK,
            wClip,
            wColor,
            wComp,
          });
          if (res.ok && res.results.length > 0) {
            matches = res.results;
          } else {
            searchError = res.ok ? "Search returned no results" : res.error;
          }
        } else {
          searchError = "No file to send to the search API";
        }
      }
    } catch {
      searchError = "Request failed";
    }

    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    if (searchError || matches.length === 0) {
      setLoading(false);
      const err = searchError ?? "No matches returned";
      if (mode === "text") {
        setStatus(
          `⚡ ${elapsed}s  |  ${err}  |  "${prompt.trim().slice(0, 48)}${prompt.length > 48 ? "…" : ""}"`
        );
      } else {
        setStatus(
          `⚡ ${elapsed}s  |  ${err}  |  Weights — CLIP:${(wClip / nc).toFixed(2)} Color:${(wColor / nc).toFixed(2)} Comp:${(wComp / nc).toFixed(2)}`
        );
      }
      return;
    }

    const newRun: GenerationRun = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceKind: mode,
      sourceLabel: mode === "text" ? prompt.trim().slice(0, 200) : (fileName ?? "Uploaded image"),
      sourceDataUrl: mode === "image" ? filePreview : null,
      matches,
      at: Date.now(),
      focusMatchIndex: 0,
    };
    setGenerationRuns((prev) => [newRun, ...prev]);
    setSelectedRunId(newRun.id);
    setCredits((c) => Math.max(0, c - cost));
    setMainTab("generations");
    setLoading(false);

    if (mode === "text") {
      setStatus(
        `⚡ ${elapsed}s  |  CLIP ranked  |  ${matches.length} matches  |  "${prompt.trim().slice(0, 48)}${prompt.length > 48 ? "…" : ""}"`
      );
    } else {
      setStatus(
        `⚡ ${elapsed}s  |  CLIP ranked  |  ${matches.length} matches  |  Weights — CLIP:${(wClip / nc).toFixed(2)} Color:${(wColor / nc).toFixed(2)} Comp:${(wComp / nc).toFixed(2)}`
      );
    }
  }, [
    credits,
    cost,
    fileName,
    filePreview,
    uploadedFile,
    mode,
    prompt,
    topK,
    wClip,
    wColor,
    wComp,
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const onDownloadRun = (run: GenerationRun) => {
    void (async () => {
      try {
        await downloadMergedComparison(run);
        showToast("Downloaded merged image");
      } catch {
        showToast("Download failed. Try again.");
      }
    })();
  };

  const openMergedPreview = (run: GenerationRun) => {
    void (async () => {
      try {
        const c = await renderMergedCanvas(run);
        if (!c) return;
        setMergedPreviewDataUrl(c.toDataURL("image/png"));
      } catch {
        showToast("Could not open preview");
      }
    })();
  };

  const closeMergedPreview = useCallback(() => {
    setMergedPreviewDataUrl(null);
  }, []);

  useEffect(() => {
    if (!mergedPreviewDataUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMergedPreview();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mergedPreviewDataUrl, closeMergedPreview]);

  const scrollToGenerationCard = (runId: string) => {
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      document.getElementById(`gen-card-${runId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0c0d17] pt-2.5 text-white sm:pt-2">
      {toast && (
        <div className="bg-card text-foreground fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg ring-1 ring-white/10">
          {toast}
        </div>
      )}

      {mergedPreviewDataUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Generation preview"
          onClick={closeMergedPreview}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeMergedPreview();
            }}
            className="text-foreground/90 hover:text-foreground absolute right-4 top-4 z-[101] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
          <div
            className="flex max-h-[min(90dvh,900px)] max-w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mergedPreviewDataUrl}
              alt="Generation"
              className="max-h-[min(90dvh,900px)] max-w-full object-contain"
            />
          </div>
        </div>
      )}

      <nav className="z-20 flex h-14 min-h-14 min-w-0 shrink-0 items-center justify-between gap-2 bg-[#0c0d17] px-2.5 sm:px-4">
        <MagicHourNavbar activeId="image" />

        <MagicHourNavActions credits={credits} className="min-w-0 shrink-0" />
      </nav>

      {/* Inset: slightly tighter under the nav so the section sits higher */}
      <div className="box-border flex h-full min-h-0 min-w-0 flex-1 flex-col px-2.5 pb-2.5 pt-0.5 sm:px-4 sm:pb-4 sm:pt-1">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-3 sm:gap-4 lg:flex-row lg:items-stretch lg:gap-5">
        <section
          className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl sm:rounded-2xl"
          aria-label="Workspace"
        >
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden max-lg:overflow-y-auto lg:flex-row lg:items-stretch">
        {/* Left column: Classic card — full section height on lg; slightly less left padding */}
        <aside
          className={cn(
            "order-2 flex h-full w-full min-w-60 min-h-0 shrink-0 flex-col bg-background pl-2 pr-1.5 pt-2 pb-2 sm:pl-3 sm:pr-2.5 sm:pt-3 sm:pb-3 lg:order-1 lg:self-stretch",
            "md:max-w-xs lg:max-w-sm xl:max-w-md"
          )}
        >
          <div
            className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[#0c0d17]"
          >
          <div className="flex w-full shrink-0 items-center border-b-2 border-white/10 p-3">
            <Popover>
              <PopoverTrigger
                type="button"
                className={cn(
                  "group flex w-full cursor-pointer items-center gap-4 rounded-lg p-3 text-left outline-none",
                  "text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  "bg-transparent hover:bg-[#2a2c3c] data-[popup-open]:bg-[#2a2c3c]"
                )}
                aria-haspopup="dialog"
              >
                <div className="size-12 rounded-md bg-transparent p-1 text-foreground group-data-[popup-open]:bg-white/10 group-hover:bg-white/[0.08]">
                  <ClassicImageCompareMark className="size-full" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 select-none text-left">
                  <div className="text-base font-semibold leading-[130%] tracking-[-0.01rem]">
                    Classic Image Compare
                  </div>
                  <div className="text-muted-foreground text-xs font-normal leading-[130%] tracking-[0.005rem]">
                    Match your photo to paintings
                  </div>
                </div>
                <ChevronsUpDown className="text-muted-foreground ml-auto size-5 shrink-0" aria-hidden />
              </PopoverTrigger>
              <PopoverContent className="w-72" align="start" side="bottom" sideOffset={6}>
                <p className="text-muted-foreground text-sm">Project and settings (hook up your app).</p>
              </PopoverContent>
            </Popover>
          </div>

          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable] pb-24",
              "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20"
            )}
          >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="p-3">
              <div
                data-slot="field-content"
                className="group/field-content flex flex-1 flex-col gap-1.5 leading-snug"
              >
                <div
                  className="flex h-fit w-full items-stretch justify-start rounded-xl bg-[#222336] p-1"
                  role="tablist"
                  aria-label="Search input mode"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "image"}
                    onClick={() => setMode("image")}
                    className={cn(
                      "relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-wrap hover:opacity-85",
                      mode === "image"
                        ? "bg-foreground text-background font-medium [&_svg]:fill-background [&_svg]:stroke-foreground"
                        : "text-foreground/80 [&_svg]:fill-muted-foreground [&_svg]:stroke-muted"
                    )}
                  >
                    Image search
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "text"}
                    onClick={() => setMode("text")}
                    className={cn(
                      "relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-wrap hover:opacity-85",
                      mode === "text"
                        ? "bg-foreground text-background font-medium [&_svg]:fill-background [&_svg]:stroke-foreground"
                        : "text-foreground/80 [&_svg]:fill-muted-foreground [&_svg]:stroke-muted"
                    )}
                  >
                    Text search
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 flex w-full min-h-0 flex-1 flex-col gap-3 px-4 py-2 sm:px-6 md:py-2">
              <h5 className="text-lg font-semibold leading-[150%] tracking-[-0.01rem] lg:text-xl">
                Configure your search
              </h5>
              {mode === "text" && (
              <div className="mt-0 flex flex-col gap-3 outline-none" role="tabpanel" aria-label="Text search">
                <SidebarField label="Prompt">
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <Textarea
                      id="configure-prompt"
                      className="min-h-[100px] resize-none border-0 bg-transparent py-2.5 text-sm text-foreground focus-visible:ring-0"
                      placeholder={PHOTO_PLACEHOLDER}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                    />
                    <div className="flex flex-wrap items-center gap-2 border-t border-border/80 px-2 py-2">
                      <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-gray-400">1:1</span>
                      <span className="flex items-center gap-0.5 rounded-md bg-white/5 px-2 py-1 text-xs text-gray-400">
                        General
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      </span>
                      <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-gray-400">640px</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-[11px]">{TEXT_PLACEHOLDER}</p>
                </SidebarField>
              </div>
              )}

              {mode === "image" && (
              <div className="mt-0 flex flex-col gap-3 outline-none" role="tabpanel" aria-label="Image search">
                <SidebarField label="Upload your image (Required)">
                  <div
                    role="presentation"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      "flex h-full min-h-40 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#9382FF]/75 bg-[#9382FF]/10 p-2 outline-none focus-visible:ring-2 focus-visible:ring-[#9382FF]/50"
                    )}
                  >
                    <div
                      className={cn(
                        "@container flex h-32 min-h-0 w-full max-w-48 flex-col items-center justify-center gap-0.5 text-[#9382FF] md:max-w-full md:gap-1.5"
                      )}
                    >
                      <input
                        id="image-upload-input"
                        ref={fileInputRef}
                        accept={IMAGE_UPLOAD_ACCEPT}
                        tabIndex={-1}
                        type="file"
                        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                        className="sr-only"
                      />
                      {filePreview ? (
                        <div className="flex w-full max-w-full flex-col items-center justify-center gap-2 p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={filePreview}
                            alt="Preview"
                            className="max-h-28 w-full max-w-full object-contain"
                          />
                          {fileName && (
                            <p className="w-full truncate text-center text-[10px] text-[#9382FF]/90">
                              {fileName}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <ImageIcon
                              className="size-6 shrink-0 text-[#9382FF]"
                              strokeWidth={2}
                              aria-hidden
                            />
                            <h5 className="text-center text-sm font-normal leading-snug tracking-[-0.01em] sm:text-base">
                              Upload Image
                            </h5>
                          </div>
                          <div
                            className="hidden max-w-full px-1 text-center text-[10px] font-light leading-tight @min-[12rem]:block"
                            style={{ letterSpacing: "-0.01em" }}
                          >
                            (.png, .jpg, .jpeg, .heic, .webp, .avif, .jp2, .tiff, .bmp)
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </SidebarField>
                <SidebarField label="Similarity weights">
                  <Popover>
                    <PopoverTrigger
                      type="button"
                      aria-haspopup="dialog"
                      className={cn(
                        "data-[popup-open]:bg-[#2a2c3c] relative inline-flex h-auto w-full cursor-pointer items-center",
                        "justify-between gap-2 rounded-2xl border border-white/10 py-2.5 pl-4 pr-10 text-left",
                        "text-sm font-medium text-foreground shadow-xs transition-all outline-none",
                        "hover:bg-[#2a2c3c]",
                        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-25",
                        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                        "bg-[#1f202e]"
                      )}
                    >
                      <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2 overflow-hidden py-0.5 text-left">
                        <div className="bg-primary/15 flex size-8 shrink-0 items-center justify-center self-center rounded-sm">
                          <SlidersHorizontal className="text-primary size-4" aria-hidden />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 text-left">
                          <div className="text-foreground text-sm font-semibold leading-tight tracking-[-0.01rem]">
                            Match weights
                          </div>
                          <div
                            className="text-muted-foreground line-clamp-1 w-full text-xs font-normal leading-tight tracking-[-0.01rem] md:text-sm"
                            title={weightSummary}
                          >
                            {weightSummary}
                          </div>
                        </div>
                      </div>
                      <ChevronRight
                        className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2 my-auto size-4 md:right-4"
                        aria-hidden
                      />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(calc(100vw-1.5rem),22rem)] gap-0 p-4"
                      align="end"
                      alignOffset={-4}
                      side="right"
                      sideOffset={8}
                    >
                      <PopoverHeader className="gap-0.5 p-0 pb-1">
                        <PopoverTitle>Similarity weights</PopoverTitle>
                        <PopoverDescription>
                          Balance CLIP, color, and layout signals in the search score.
                        </PopoverDescription>
                      </PopoverHeader>
                      <div className="mt-1 space-y-2">
                        <WeightRow label="CLIP" value={wClip} onChange={setWClip} />
                        <WeightRow label="Color" value={wColor} onChange={setWColor} />
                        <WeightRow label="Comp" value={wComp} onChange={setWComp} />
                      </div>
                    </PopoverContent>
                  </Popover>
                </SidebarField>
              </div>
              )}

              <SidebarField label="Number of paintings" className="mt-2">
                <div className="grid grid-cols-4 gap-1.5">
                  {NUM_IMAGES.map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={topK === n ? "default" : "outline"}
                      size="lg"
                      onClick={() => setTopK(n)}
                      className={cn(
                        "h-10 rounded-lg py-2.5 text-sm font-medium",
                        topK === n
                          ? "border-transparent !bg-[#5200FF] !text-white shadow-md shadow-violet-900/30 hover:!bg-[#5c1fff] hover:!text-white"
                          : [
                              "!border !bg-[#1f202e] text-foreground transition-colors",
                              "hover:!border-white/20 hover:!bg-[#2a2c3c] hover:text-foreground",
                              "!border-white/10",
                            ]
                      )}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </SidebarField>
            </div>
          </div>
          </div>

          <div className="z-10 mt-auto flex w-full flex-col items-center rounded-b-2xl bg-inherit p-4 pb-6 pt-0 backdrop-blur-sm max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:rounded-b-none md:sticky md:bottom-0 md:px-2 md:pt-4 md:pb-4">
            <p className="text-muted-foreground mb-2 block text-center text-xs font-normal leading-[130%] tracking-[0.005rem]">
              Your balance: {credits} Credits
            </p>
            <div className="flex w-full min-w-0 justify-center px-1">
              <Button
                type="button"
                onClick={() => void runSearch()}
                disabled={loading}
                className="h-11 w-full min-w-[75%] flex-1 flex-wrap items-center justify-center gap-2.5 rounded-lg border-0 !bg-[#5200FF] px-5 py-0 text-base font-medium !text-white text-wrap shadow-xs hover:!bg-[#5c1fff] has-[>svg]:px-4 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <>
                    <span className="whitespace-nowrap">Find {topK} paintings</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-sm tabular-nums">
                      <CreditsIcon className="size-3.5 shrink-0 text-white/90" />
                      {cost}
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
          </div>
        </aside>

        {/* Main — Inspiration: inner div is the only vertical scrollport on lg */}
        <main className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background [flex:1_1_0%] max-lg:min-h-[min(70vh,36rem)] lg:order-2">
          <div
            className="inspiration-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain py-4 pl-3 pr-4 [scrollbar-gutter:stable] sm:py-6 sm:pl-4 sm:pr-6"
            data-slot="inspiration-scroll"
          >
            <div className="mb-4">
              <div
                className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl bg-[#0c0d17]/40 p-1"
                role="tablist"
                aria-label="Main area"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mainTab === "inspiration"}
                  onClick={() => setMainTab("inspiration")}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-xl px-3 py-0 text-sm font-medium text-foreground transition-colors",
                    mainTab === "inspiration"
                      ? "bg-[#222336] text-foreground shadow-none"
                      : "text-foreground/80 hover:text-foreground"
                  )}
                >
                  <Lightbulb className="size-3.5 shrink-0" fill="currentColor" aria-hidden />
                  Inspiration
                </button>
                {showGenerationsTab && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mainTab === "generations"}
                    onClick={() => setMainTab("generations")}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-xl px-3 py-0 text-sm font-medium transition-colors",
                      mainTab === "generations"
                        ? "bg-foreground text-background"
                        : "text-foreground/80 hover:text-foreground"
                    )}
                  >
                    <ImageIcon className="size-3.5 shrink-0" aria-hidden />
                    My Generations
                  </button>
                )}
              </div>
            </div>

            {mainTab === "inspiration" && loading && (
              <div
                className="flex min-h-[min(40vh,24rem)] flex-col items-center justify-center gap-4 py-12"
                role="status"
                aria-live="polite"
                aria-label="Searching"
              >
                <Loader2 className="size-12 shrink-0 animate-spin text-[#5200FF]" aria-hidden />
                <p className="text-muted-foreground text-center text-sm">Searching the index…</p>
              </div>
            )}

            {mainTab === "inspiration" && !loading && (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                {INSPIRATION_GRID_ITEMS.map((item) => (
                  <div
                    key={item.id}
                    className="group bg-card/40 ring-border/80 relative mb-4 break-inside-avoid overflow-hidden rounded-xl ring-1"
                  >
                    <div
                      className="relative w-full"
                      style={{ aspectRatio: `${item.w} / ${item.h}` }}
                    >
                      <Image
                        src={item.src}
                        alt={item.alt}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        unoptimized
                      />
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => showToast("Inspiration card (demo)")}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 pointer-events-auto absolute right-2 top-2 h-7 w-7 rounded-full p-0 shadow-none transition-opacity opacity-0 group-hover:opacity-100"
                      aria-label="Inspiration action"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {showGenerationsTab && mainTab === "generations" && loading && (
              <div
                className="flex min-h-[min(40vh,24rem)] flex-col items-center justify-center gap-4 py-12"
                role="status"
                aria-live="polite"
                aria-label="Searching"
              >
                <Loader2 className="size-12 shrink-0 animate-spin text-[#5200FF]" aria-hidden />
                <p className="text-muted-foreground text-center text-sm">Searching the index…</p>
              </div>
            )}

            {showGenerationsTab && mainTab === "generations" && !loading && generationRuns.length > 0 && (
              <div className="space-y-8 pb-2">
                {generationRuns.map((run) => {
                  if (run.matches.length === 0) return null;
                  const right = focusedMatch(run);
                  if (!right) return null;
                  const focusIdx = Math.min(
                    Math.max(0, run.focusMatchIndex ?? 0),
                    run.matches.length - 1
                  );
                  const headline =
                    run.sourceKind === "text" ? run.sourceLabel : `Photo match · ${run.sourceLabel}`;

                  return (
                    <article
                      key={run.id}
                      id={`gen-card-${run.id}`}
                      className="max-w-4xl overflow-hidden rounded-2xl bg-[#12131f] ring-1 ring-white/10"
                    >
                      <button
                        type="button"
                        onClick={() => openMergedPreview(run)}
                        className="group relative w-full min-h-48 cursor-zoom-in overflow-hidden border-0 bg-black p-0 text-left"
                        style={{ aspectRatio: "16/9" }}
                        aria-label="View full size comparison"
                      >
                        <div className="absolute inset-0 flex">
                          <div className="relative h-full w-1/2 min-w-0">
                            {run.sourceKind === "image" && run.sourceDataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={run.sourceDataUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[#0c0d17] p-3">
                                <p className="line-clamp-6 text-center text-xs leading-relaxed text-white/80">
                                  {run.sourceLabel}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="relative h-full w-1/2 min-w-0 border-l-4 border-black">
                            <Image
                              key={`${run.id}-right-${focusIdx}`}
                              src={right.src}
                              alt={right.alt}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 50vw, 40vw"
                              unoptimized
                            />
                          </div>
                        </div>
                        <MagicHourMergeWatermark className="pointer-events-none absolute bottom-2 right-2 h-auto w-14 text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] sm:bottom-2.5 sm:right-2.5 sm:w-20" />
                      </button>

                      <div className="space-y-1.5 p-3 sm:p-4">
                        <h3 className="text-foreground line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                          {headline}
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          {formatTimeAgo(run.at)} · CLIP-ranked from corpus · Classic image compare ·{" "}
                          {run.id.split("-").pop()?.slice(0, 8) ?? "result"}
                        </p>
                        {run.matches.length > 1 && (
                          <div className="pt-1">
                            <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">
                              All matches — tap to show on the right
                            </p>
                            <div
                              className="flex gap-2 overflow-x-auto pb-1 [scrollbar-gutter:stable]"
                              role="list"
                              aria-label="Choose which match to compare"
                            >
                              {run.matches.map((m, idx) => {
                                const isFocus = idx === focusIdx;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    role="listitem"
                                    onClick={() => setRunFocusMatch(run.id, idx)}
                                    className={cn(
                                      "relative h-20 w-16 shrink-0 cursor-pointer overflow-hidden rounded-md text-left ring-1 ring-inset ring-[#5200FF]/40 transition-[box-shadow,ring] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5200FF]/50",
                                      isFocus
                                        ? "ring-2 ring-inset ring-[#5200FF]/90"
                                        : "hover:ring-[#5200FF]/60"
                                    )}
                                    aria-pressed={isFocus}
                                    aria-label={`Match ${idx + 1} of ${run.matches.length}, score ${m.score.toFixed(3)}`}
                                  >
                                    <Image
                                      src={m.src}
                                      alt={m.alt}
                                      fill
                                      className="object-cover"
                                      sizes="64px"
                                      unoptimized
                                    />
                                    <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/75 px-0.5 py-0.5 text-center text-[9px] font-medium tabular-nums text-white/95">
                                      #{m.rank}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-border/40 border-t bg-black/20 px-2 py-2 sm:px-3">
                        <Button
                          type="button"
                          onClick={() => onDownloadRun(run)}
                          variant="secondary"
                          className="gap-2 rounded-full border-0 bg-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 shadow-none hover:bg-zinc-500"
                        >
                          <Download className="size-4 shrink-0" />
                          Download
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="bg-card/35 border-border/60 text-muted-foreground mt-6 rounded-lg border px-3 py-2 text-xs">
              Status: {status}
            </div>
          </div>
        </main>
      </div>
        </section>

        {/* Right rail — stacked generation previews; gap from main section above */}
        <aside
          className="hidden h-full min-h-0 w-20 shrink-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background p-2.5 sm:w-24 sm:p-3 lg:flex lg:flex-col lg:self-stretch xl:w-28 xl:p-4"
          aria-label="Saved comparisons"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
            {generationRuns.length > 0
              ? generationRuns.map((run) => {
                const isActive = selectedRun?.id === run.id;
                const railRight = focusedMatch(run);
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => {
                      setSelectedRunId(run.id);
                      setMainTab("generations");
                      scrollToGenerationCard(run.id);
                    }}
                    className={cn(
                      "w-full shrink-0 overflow-hidden rounded-sm border-0 bg-black p-0 ring-1 ring-inset ring-[#5200FF]/30",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5200FF]/50",
                      isActive
                        ? "opacity-100 ring-2 ring-inset ring-[#5200FF]/70"
                        : "opacity-80 hover:ring-[#5200FF]/45"
                    )}
                    aria-pressed={isActive}
                    aria-label="Open generation in My Generations"
                  >
                    <div className="flex h-12 w-full gap-0">
                      <div className="relative h-full min-w-0 flex-1 overflow-hidden bg-black">
                        {run.sourceKind === "image" && run.sourceDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={run.sourceDataUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-zinc-950" aria-hidden />
                        )}
                      </div>
                      <div className="relative h-full min-w-0 flex-1 overflow-hidden bg-black">
                        {railRight && (
                          <Image
                            key={`${run.id}-rail-${run.focusMatchIndex ?? 0}`}
                            src={railRight.src}
                            alt={railRight.alt}
                            fill
                            className="object-cover"
                            sizes="80px"
                            unoptimized
                          />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
              : null}
          </div>
        </aside>
        </div>
      </div>
    </div>
  );
}

function WeightRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-10">{label}</span>
      <Slider
        className="flex-1"
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? (v[0] ?? 0) : v)}
      />
      <span className="text-muted-foreground w-7 tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}
