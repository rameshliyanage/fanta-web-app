export type ContactRead = { name: string; company: string };

const EMPTY: ContactRead = { name: "", company: "" };

function band(
  card: HTMLCanvasElement,
  y0: number,
  y1: number,
): HTMLCanvasElement {
  const x = Math.round(card.width * 0.08);
  const y = Math.round(card.height * y0);
  const w = Math.max(1, Math.round(card.width * 0.84));
  const h = Math.max(1, Math.round(card.height * (y1 - y0)));
  const longest = Math.max(w, h);
  const scale = longest > 800 ? 800 / longest : 1;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * scale));
  out.height = Math.max(1, Math.round(h * scale));
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.drawImage(card, x, y, w, h, 0, 0, out.width, out.height);
  return out;
}

function jpegBase64(canvas: HTMLCanvasElement): string {
  const url = canvas.toDataURL("image/jpeg", 0.8);
  const comma = url.indexOf(",");
  return comma === -1 ? "" : url.slice(comma + 1);
}

export async function readContact(card: HTMLCanvasElement): Promise<ContactRead> {
  const nameJpeg = jpegBase64(band(card, 0.28, 0.48));
  const companyJpeg = jpegBase64(band(card, 0.52, 0.72));
  if (!nameJpeg || !companyJpeg) return EMPTY;
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJpeg, companyJpeg }),
      signal: AbortSignal.timeout(2000),
    });
    const data = (await response.json()) as Partial<ContactRead>;
    return {
      name: typeof data.name === "string" ? data.name : "",
      company: typeof data.company === "string" ? data.company : "",
    };
  } catch {
    return EMPTY;
  }
}
