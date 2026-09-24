import { BADGES } from "./constants";
import { cardHasRoleBar, locateCard, warpCard } from "./locate";
import { readRole } from "./ocr";
import type { BadgeType } from "./types";

const WIDTH = 200;
const HEIGHT = 320;
const LARGE_W = 360;
const LARGE_H = 576;
const SOURCE_MAX = 960;
const BAND = 0.22;
const MATCH_MIN = 0.52;
const MARGIN_MIN = 0.035;
/** A gap this wide is a clear image match, so a conflicting OCR read does not veto it. */
const STRONG_MARGIN = 0.08;
/** Below this the frame does not resemble a badge, so OCR is not asked to guess. */
const OCR_FLOOR = 0.3;
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

function drawFitted(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): HTMLCanvasElement {
  return drawScaled(source, sx, sy, sw, sh, WIDTH, HEIGHT);
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
  const size = cappedSize(w, h, SOURCE_MAX);
  return drawScaled(video, x, y, w, h, size.w, size.h);
}

function scoreCanvas(canvas: HTMLCanvasElement, loaded: Template[]): ScoreRow[] {
  const sample = roleBand(canvas);
  return loaded
    .map((template) => ({ type: template.id, score: ncc(sample, template.pixels) }))
    .sort((a, b) => b.score - a.score);
}

function rank(scores: ScoreRow[]): number {
  const best = scores[0];
  const second = scores[1];
  if (!best) return -1;
  const margin = second ? best.score - second.score : 1;
  const pass = best.score >= MATCH_MIN && margin >= MARGIN_MIN ? 1 : 0;
  return pass + best.score;
}

function combine(scores: ScoreRow[], brightness: number, ocr: BadgeType | null): DetectResult {
  if (brightness < DARK_MAX) {
    return { ok: false, reason: "dark", scores, brightness, closest: scores[0] };
  }
  const best = scores[0];
  const second = scores[1];
  if (!best) return { ok: false, reason: "empty", scores, brightness };
  const margin = second ? best.score - second.score : 1;
  const nccPass = best.score >= MATCH_MIN && margin >= MARGIN_MIN;
  const nccStrong = best.score >= MATCH_MIN && margin >= STRONG_MARGIN;
  if (ocr && nccPass && ocr !== best.type) {
    if (nccStrong) {
      return { ok: true, type: best.type, score: best.score, scores, brightness };
    }
    return { ok: false, reason: "ambiguous", closest: best, scores, brightness };
  }
  if (ocr) {
    const row = scores.find((item) => item.type === ocr);
    return { ok: true, type: ocr, score: row?.score ?? best.score, scores, brightness };
  }
  if (nccPass) return { ok: true, type: best.type, score: best.score, scores, brightness };
  if (best.score >= MATCH_MIN && margin < MARGIN_MIN) {
    return { ok: false, reason: "ambiguous", closest: best, scores, brightness };
  }
  return { ok: false, reason: "low", closest: best, scores, brightness };
}

export async function classifyCanvas(source: HTMLCanvasElement): Promise<DetectResult> {
  if (source.width === 0 || source.height === 0) {
    return { ok: false, reason: "empty", scores: [], brightness: 0 };
  }
  const loaded = await ensureTemplates();
  const plainLarge = drawScaled(source, 0, 0, source.width, source.height, LARGE_W, LARGE_H);
  const plain = drawFitted(plainLarge, 0, 0, plainLarge.width, plainLarge.height);
  let fitted = plain;
  let large = plainLarge;
  let scores = scoreCanvas(plain, loaded);

  const quad = locateCard(source);
  if (quad) {
    const warpedLarge = warpCard(source, quad, LARGE_W, LARGE_H);
    if (warpedLarge && cardHasRoleBar(warpedLarge)) {
      const warped = drawFitted(warpedLarge, 0, 0, warpedLarge.width, warpedLarge.height);
      const warpedScores = scoreCanvas(warped, loaded);
      if (rank(warpedScores) > rank(scores)) {
        fitted = warped;
        large = warpedLarge;
        scores = warpedScores;
      }
    }
  }

  if (scores.length === 0) {
    return { ok: false, reason: "empty", scores, brightness: meanLuma(fitted) };
  }
  const brightness = meanLuma(fitted);
  const best = scores[0];
  const ocr =
    brightness >= DARK_MAX && best && best.score >= OCR_FLOOR ? await readRole(large) : null;
  return combine(scores, brightness, ocr);
}

export async function classifyImageFile(file: File): Promise<{ canvas: HTMLCanvasElement; result: DetectResult }> {
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

