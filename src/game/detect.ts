const SOURCE_MAX = 960;
/** Mean luminance 0–255. Below this the frame is treated as too dark to read. */
export const DARK_MAX = 48;

export type DetectResult =
  | { ok: true; code: string; brightness: number }
  | { ok: false; reason: "dark" | "miss" | "empty"; brightness: number };

type BarcodeHit = { rawValue?: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<BarcodeHit[]>;
};

function meanLuma(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) return 0;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = data.length / 4;
  let sum = 0;
  for (let i = 0; i < pixels; i += 1) {
    const j = i * 4;
    sum += 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }
  return sum / pixels;
}

function drawScaled(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, dw);
  canvas.height = Math.max(1, dh);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cappedSize(sw: number, sh: number, maxEdge: number) {
  const longest = Math.max(sw, sh);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    w: Math.max(1, Math.round(sw * scale)),
    h: Math.max(1, Math.round(sh * scale)),
  };
}

export function coverSourceRect(video: HTMLVideoElement, display: DOMRect) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const ratio = vw / vh;
  const displayRatio = display.width / display.height;
  if (ratio > displayRatio) {
    const sw = vh * displayRatio;
    return { sx: (vw - sw) / 2, sy: 0, sw, sh: vh };
  }
  const sh = vw / displayRatio;
  return { sx: 0, sy: (vh - sh) / 2, sw: vw, sh };
}

export function cropVideoFrame(video: HTMLVideoElement, frame: HTMLElement): HTMLCanvasElement {
  const display = video.getBoundingClientRect();
  const box = frame.getBoundingClientRect();
  const src = coverSourceRect(video, display);
  const x = ((box.left - display.left) / display.width) * src.sw + src.sx;
  const y = ((box.top - display.top) / display.height) * src.sh + src.sy;
  const w = (box.width / display.width) * src.sw;
  const h = (box.height / display.height) * src.sh;
  const size = cappedSize(w, h, SOURCE_MAX);
  return drawScaled(video, x, y, w, h, size.w, size.h);
}

export function parseFantaCode(raw: string): string | null {
  const match = raw.trim().match(/^FANTA:([A-Za-z0-9-]+)$/);
  return match ? match[1].toUpperCase() : null;
}

async function detectRaw(canvas: HTMLCanvasElement): Promise<string | null> {
  const Detector = (
    window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
  ).BarcodeDetector;
  if (Detector) {
    try {
      const detector = new Detector({ formats: ["qr_code"] });
      const codes = await detector.detect(canvas);
      const raw = codes.find((code) => code.rawValue)?.rawValue;
      if (raw) return raw;
    } catch {
      // Fall through to zxing.
    }
  }
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const reader = new BrowserMultiFormatReader();
    const result = reader.decodeFromCanvas(canvas);
    return result.getText();
  } catch {
    return null;
  }
}

export async function classifyCanvas(source: HTMLCanvasElement): Promise<DetectResult> {
  if (source.width === 0 || source.height === 0) {
    return { ok: false, reason: "empty", brightness: 0 };
  }
  const brightness = meanLuma(source);
  const raw = await detectRaw(source);
  const code = raw ? parseFantaCode(raw) : null;
  if (code) return { ok: true, code, brightness };
  if (brightness < DARK_MAX) return { ok: false, reason: "dark", brightness };
  return { ok: false, reason: "miss", brightness };
}

export async function classifyImageFile(
  file: File,
): Promise<{ canvas: HTMLCanvasElement; result: DetectResult }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = cappedSize(img.width, img.height, SOURCE_MAX);
    const canvas = drawScaled(img, 0, 0, img.width, img.height, size.w, size.h);
    const result = await classifyCanvas(canvas);
    return { canvas, result };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("jpeg"))),
      "image/jpeg",
      quality,
    );
  });
}
