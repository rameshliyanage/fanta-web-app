import { BADGES } from "./constants";
import type { BadgeType } from "./types";

const WIDTH = 200;
const HEIGHT = 320;
const BAND = 0.22;
const MATCH_MIN = 0.52;
const MARGIN_MIN = 0.035;
/** Mean luminance 0–255. Below this the frame is treated as too dark to read. */
const DARK_MAX = 48;

export type ScoreRow = { type: BadgeType; score: number };

export type DetectResult =
  | { ok: true; type: BadgeType; score: number; scores: ScoreRow[]; brightness: number }
  | {
      ok: false;
      reason: "low" | "ambiguous" | "empty" | "dark";
      closest?: ScoreRow;
      scores: ScoreRow[];
      brightness: number;
    };

type Template = { id: BadgeType; pixels: Float32Array };

let templates: Promise<Template[]> | null = null;

function toGray(data: Uint8ClampedArray): Float32Array {
  const gray = new Float32Array(data.length / 4);
  for (let i = 0; i < gray.length; i += 1) {
    const j = i * 4;
    gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }
  return gray;
}

function ncc(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i += 1) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

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

function roleBand(canvas: HTMLCanvasElement): Float32Array {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Float32Array();
  const h = Math.max(8, Math.floor(canvas.height * BAND));
  const y = canvas.height - h;
  const { data } = ctx.getImageData(0, y, canvas.width, h);
  return toGray(data);
}

function drawFitted(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
  return canvas;
}

async function loadTemplates(): Promise<Template[]> {
  return Promise.all(
    BADGES.map(async (badge) => {
      const img = new Image();
      img.src = badge.image;
      await img.decode();
      const canvas = drawFitted(img, 0, 0, img.width, img.height);
      return { id: badge.id, pixels: roleBand(canvas) };
    }),
  );
}

function ensureTemplates() {
  if (!templates) templates = loadTemplates();
  return templates;
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
  return drawFitted(video, x, y, w, h);
}

export async function classifyCanvas(canvas: HTMLCanvasElement): Promise<DetectResult> {
  const brightness = meanLuma(canvas);
  const sample = roleBand(canvas);
  if (sample.length === 0) return { ok: false, reason: "empty", scores: [], brightness };

  const loaded = await ensureTemplates();
  const scores = loaded
    .map((template) => ({ type: template.id, score: ncc(sample, template.pixels) }))
    .sort((a, b) => b.score - a.score);

  if (brightness < DARK_MAX) {
    return { ok: false, reason: "dark", scores, brightness, closest: scores[0] };
  }

  const best = scores[0];
  const second = scores[1];
  if (!best) return { ok: false, reason: "empty", scores, brightness };
  if (best.score < MATCH_MIN) return { ok: false, reason: "low", closest: best, scores, brightness };
  if (second && best.score - second.score < MARGIN_MIN) {
    return { ok: false, reason: "ambiguous", closest: best, scores, brightness };
  }
  return { ok: true, type: best.type, score: best.score, scores, brightness };
}

export async function classifyImageFile(file: File): Promise<{ canvas: HTMLCanvasElement; result: DetectResult }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = drawFitted(img, 0, 0, img.width, img.height);
    const result = await classifyCanvas(canvas);
    return { canvas, result };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function selfCheck(): Promise<{ pass: boolean; detail: string }> {
  const results = await Promise.all(
    BADGES.map(async (badge) => {
      const response = await fetch(badge.image);
      const blob = await response.blob();
      const { result } = await classifyImageFile(
        new File([blob], `${badge.id}.png`, { type: blob.type || "image/png" }),
      );
      return { id: badge.id, result };
    }),
  );
  const misses = results.filter((row) => !row.result.ok || row.result.type !== row.id);
  if (misses.length === 0) {
    return {
      pass: true,
      detail:
        "Hold your camera and capture the full Participant Badge clearly. Make sure to have decent, proper lighting for the capture to work.",
    };
  }
  return {
    pass: false,
    detail: misses
      .map((row) =>
        row.result.ok ? `${row.id}→${row.result.type}` : `${row.id} fail`,
      )
      .join(", "),
  };
}

