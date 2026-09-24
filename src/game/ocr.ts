import { createWorker, PSM } from "tesseract.js";
import type { Worker } from "tesseract.js";
import type { BadgeType } from "./types";

const ROLES: { word: string; type: BadgeType }[] = [
  { word: "DELEGATE", type: "delegate" },
  { word: "OFFICIAL", type: "official" },
  { word: "SPEAKER", type: "speaker" },
  { word: "GUEST", type: "guest" },
  { word: "CREW", type: "crew" },
];

let workerPromise: Promise<Worker | null> | null = null;

function levenshtein(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1);
  const next = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    next[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = next[j];
  }
  return prev[b.length];
}

function matchRole(raw: string, confidence: number): BadgeType | null {
  const text = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (text.length < 3 || text.length > 14) return null;
  const exact = ROLES.find((role) => text === role.word);
  // These short lines often come back with a confidence of 0 even when the word is right.
  if (exact) return exact.type;
  const contained = ROLES.filter((role) => text.includes(role.word));
  if (contained.length > 1) return null;
  if (contained.length === 1) return confidence >= 45 ? contained[0].type : null;
  const ranked = ROLES.map((role) => ({
    type: role.type,
    word: role.word,
    dist: levenshtein(text, role.word),
  })).sort((a, b) => a.dist - b.dist);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || !second) return null;
  const limit = best.word.length <= 5 ? 1 : 2;
  if (best.dist <= limit && second.dist >= best.dist + 1 && confidence >= 55) return best.type;
  return null;
}

/** Inverted role bar: dark type on a light ground, which is what the OCR model expects. */
function roleStrip(card: HTMLCanvasElement): HTMLCanvasElement {
  const bandHeight = Math.max(16, Math.round(card.height * 0.18));
  const y = card.height - bandHeight;
  const scale = Math.max(1, 120 / bandHeight);
  const stripWidth = Math.round(card.width * scale);
  const stripHeight = Math.round(bandHeight * scale);
  const strip = document.createElement("canvas");
  strip.width = stripWidth;
  strip.height = stripHeight;
  const stripCtx = strip.getContext("2d", { willReadFrequently: true });
  if (!stripCtx) return strip;
  stripCtx.drawImage(card, 0, y, card.width, bandHeight, 0, 0, stripWidth, stripHeight);
  const image = stripCtx.getImageData(0, 0, stripWidth, stripHeight);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  stripCtx.putImageData(image, 0, 0);
  const pad = 24;
  const out = document.createElement("canvas");
  out.width = stripWidth + pad * 2;
  out.height = stripHeight + pad * 2;
  const outCtx = out.getContext("2d");
  if (!outCtx) return strip;
  outCtx.fillStyle = "#f4f4f4";
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.drawImage(strip, pad, pad);
  return out;
}

function ensureWorker(): Promise<Worker | null> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      errorHandler: () => undefined,
    })
      .then(async (worker) => {
        await worker.setParameters({
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          tessedit_pageseg_mode: PSM.SINGLE_LINE,
          user_defined_dpi: "300",
        });
        return worker;
      })
      .catch(() => {
        workerPromise = null;
        return null;
      });
  }
  return workerPromise;
}

/** Starts the OCR download. Capture still works from the image match if this is not ready. */
export function preloadOcr(): void {
  void ensureWorker();
}

export function whenOcrReady(): Promise<boolean> {
  return ensureWorker().then((worker) => worker !== null);
}

async function recognize(card: HTMLCanvasElement): Promise<{ text: string; confidence: number } | null> {
  if (!workerPromise) return null;
  const worker = await Promise.race([
    workerPromise,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 1500);
    }),
  ]);
  if (!worker) return null;
  try {
    const { data } = await worker.recognize(roleStrip(card), {}, { text: true });
    return { text: data.text, confidence: data.confidence };
  } catch {
    return null;
  }
}

export async function readRole(card: HTMLCanvasElement): Promise<BadgeType | null> {
  const found = await recognize(card);
  if (!found) return null;
  return matchRole(found.text, found.confidence);
}
