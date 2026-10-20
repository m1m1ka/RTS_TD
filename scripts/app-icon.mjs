import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
// Render the existing vector artwork directly at each resolution.
const source = await readFile(new URL("../src/marine-art.js", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const images = await page.evaluate(async source => {
    const { drawMermaid } = await import("data:text/javascript;base64," + btoa(unescape(encodeURIComponent(source))));
    return [16, 32, 48, 64, 128, 256, 512].map(size => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d"); ctx.scale(size / 128, size / 128);
      ctx.lineJoin = ctx.lineCap = "round"; drawMermaid(ctx);
      return { size, png: canvas.toDataURL("image/png").split(",")[1] };
    });
  }, source);
  await mkdir("desktop", { recursive: true });
  await writeFile("desktop/icon-512.png", Buffer.from(images.at(-1).png, "base64"));
  const entries = images.filter(i => i.size <= 256), header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  const buffers = entries.map(({ size, png }, i) => {
    const data = Buffer.from(png, "base64"), at = 6 + i * 16;
    header[at] = header[at + 1] = size % 256;
    header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8); header.writeUInt32LE(offset, at + 12);
    offset += data.length; return data;
  });
  await writeFile("desktop/icon.ico", Buffer.concat([header, ...buffers]));
} finally { await browser.close(); }
