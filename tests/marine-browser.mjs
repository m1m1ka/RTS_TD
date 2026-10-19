import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { pirateIds, piratePresets } from "../src/marine-content.js";

const config = structuredClone(DEFAULT_CONFIG);
Object.assign(config.enemies, structuredClone(piratePresets));
config.initial.firstWaveDelay = 0;
config.days[0].obstacles = []; config.days[0].mines = [];
config.days[0].waves[0].spawns = pirateIds.map((type, i) => ({ x: 1 + i * 2, y: 0, delay: 0, interval: 1, enemies: [{ type, count: 1, level: 1 }] }));
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5197", "--strictPort"], { stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" } });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch("http://127.0.0.1:5197")).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(c => { if (!localStorage.getItem("friday-defense-config-v1")) localStorage.setItem("friday-defense-config-v1", JSON.stringify(c)); }, config);
  const page = await context.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("http://127.0.0.1:5197");
  await page.waitForFunction(() => window.__game?.snapshot().frames > 3);
  assert.match(await page.locator(".core-title").textContent(), /美人鱼/);
  await page.locator('[data-card="hero_blue"]').click();
  await page.evaluate(() => window.__game.clickCell(7, 6));
  await page.locator("#start").click();
  await page.evaluate(() => window.__game.advance(.3));
  const state = await page.evaluate(() => window.__game.snapshot());
  assert.equal(state.enemies.length, 6);
  mkdirSync("logs", { recursive: true });
  await page.screenshot({ path: "logs/marine-battlefield.png" });
  const data = await page.evaluate(async () => {
    const { unitArt } = await import("/src/art.js");
    const { pirateIds, pirateLooks } = await import("/src/marine-content.js");
    const c = document.createElement("canvas"); c.width = 1140; c.height = 860;
    const g = c.getContext("2d"); g.fillStyle = "#e9dfbb"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#203c30"; g.textAlign = "center"; g.font = "bold 24px sans-serif";
    g.fillText("项目原有角色", 210, 42);
    g.drawImage(unitArt("emberblade", { portrait: true }), 25, 65, 180, 180);
    g.drawImage(unitArt("blue", { portrait: true }), 215, 65, 180, 180);
    g.fillText("守护美人鱼", 210, 340); g.drawImage(unitArt("base"), 18, 370, 384, 384);
    pirateIds.forEach((id, i) => {
      const x = 440 + i % 3 * 230, y = 45 + Math.floor(i / 3) * 390;
      g.drawImage(unitArt(id, { portrait: true }), x, y, 210, 210);
      g.fillText(pirateLooks[id], x + 105, y + 250);
      g.drawImage(unitArt(id), x + 65, y + 280, 80, 80);
    });
    return c.toDataURL();
  });
  writeFileSync("logs/marine-art-preview.png", Buffer.from(data.split(",")[1], "base64"));
  const editor = await context.newPage(); editor.on("pageerror", e => errors.push(e.message));
  await editor.goto("http://127.0.0.1:5197/config.html");
  await editor.locator('[data-section="enemies"]').click();
  await editor.locator(".hero-preset-library summary").click();
  assert.equal(await editor.locator("[data-enemy-preset]").count(), 6);
  for (const id of pirateIds) {
    if (!await editor.locator(`[data-enemy-preset="${id}"]`).isVisible()) await editor.locator(".hero-preset-library summary").click();
    await editor.locator(`[data-enemy-preset="${id}"]`).click();
    assert.equal(await editor.locator('.entity-form [data-icon-select]').inputValue(), id);
  }
  await editor.locator("#save-config").click();
  await editor.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem("friday-defense-config-v1")).enemies).filter(k => k.startsWith("pirate_")).length === 12);
  await editor.locator(".hero-preset-library summary").click();
  await editor.screenshot({ path: "logs/marine-editor.png" });
  assert.deepEqual(errors, []);
  console.log("PASS marine browser: mermaid HUD, six pirates in battle, six editable/serializable presets and no runtime errors");
} finally { await browser?.close(); server.kill(); }
