import { createServer } from "node:http";

const PORT = 8787;
const MAX_BODY = 1_500_000;
const MODEL = "gemini-2.5-flash";

function clean(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/[^A-Za-z0-9 &.'-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

function isBase64(value) {
  return typeof value === "string" && value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(json);
}

async function readGemini(nameJpeg, companyJpeg) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 503, body: { name: "", company: "" } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Read the handwritten block capitals. The first image is NAME. The second image is COMPANY. Return only those strings. Use an empty string if a line is blank or unreadable. Do not invent text.",
                },
                { inline_data: { mime_type: "image/jpeg", data: nameJpeg } },
                { inline_data: { mime_type: "image/jpeg", data: companyJpeg } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                company: { type: "STRING" },
              },
              required: ["name", "company"],
            },
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    if (!response.ok) return { status: 200, body: { name: "", company: "" } };
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text ?? "";
    const parsed = JSON.parse(text);
    return {
      status: 200,
      body: { name: clean(parsed.name), company: clean(parsed.company) },
    };
  } catch {
    return { status: 200, body: { name: "", company: "" } };
  } finally {
    clearTimeout(timer);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("too-large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      send(res, 200, { ok: true });
      console.log(`200 ${Date.now() - started}ms`);
      return;
    }
    if (req.method !== "POST" || url.pathname !== "/api/contact") {
      send(res, 404, { name: "", company: "" });
      console.log(`404 ${Date.now() - started}ms`);
      return;
    }
    const raw = await readBody(req);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      send(res, 400, { name: "", company: "" });
      console.log(`400 ${Date.now() - started}ms`);
      return;
    }
    if (!isBase64(body.nameJpeg) || !isBase64(body.companyJpeg)) {
      send(res, 400, { name: "", company: "" });
      console.log(`400 ${Date.now() - started}ms`);
      return;
    }
    const result = await readGemini(body.nameJpeg, body.companyJpeg);
    send(res, result.status, result.body);
    console.log(`${result.status} ${Date.now() - started}ms`);
  } catch (error) {
    const status = error && error.status === 413 ? 413 : 400;
    if (!res.headersSent) send(res, status, { name: "", company: "" });
    console.log(`${status} ${Date.now() - started}ms`);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`contact listening on 127.0.0.1:${PORT}`);
});
