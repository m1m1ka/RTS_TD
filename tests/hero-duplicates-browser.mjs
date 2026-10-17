import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

const url = "http://127.0.0.1:5194", c = structuredClone(DEFAULT_CONFIG);
c.initial.cards = { hero_blue: 4, hero_green: 2, training: 3, coffee: 2 };
for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5194", "--strictPort"], {
  stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" },
});
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  const executablePath = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000);
  await context.addInitScript(config => {
    if (!localStorage.getItem("friday-defense-config-v1")) localStorage.setItem("friday-defense-config-v1", JSON.stringify(config));
  }, c);
  const page = await context.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.snapshot().frames > 3);
  const blues = page.locator('[data-card="hero_blue"]');
  assert.equal(await blues.count(), 4);
  assert.equal(await page.locator('[data-card="hero_green"]').count(), 2);
  assert.equal(await page.locator("#hand .hero .card-count").count(), 0);
  assert.equal(await page.locator('[data-card="training"]').count(), 1);
  assert.equal(await page.locator('[data-card="training"] .card-count').innerText(), "×3");
  assert.equal(await page.evaluate(() => Object.values(window.__game.snapshot().cards).reduce((a, b) => a + b, 0)), 11);
  const badge = await page.locator('[data-card="training"] .card-count').evaluate(el => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, shadow: style.boxShadow, border: style.borderTopWidth, radius: style.borderRadius };
  });
  assert.deepEqual(badge, { background: "rgba(0, 0, 0, 0)", shadow: "none", border: "0px", radius: "0px" });
  await blues.nth(1).click();
  assert.equal(await page.locator("#hand .selected").count(), 1);
  assert.equal(await blues.nth(1).getAttribute("aria-pressed"), "true");
  await blues.nth(2).click();
  assert.equal(await page.locator("#hand .selected").count(), 1);
  assert.equal(await blues.nth(2).getAttribute("aria-pressed"), "true");
  await page.evaluate(() => window.__game.clickCell(7, 3));
  assert.equal(await blues.count(), 3);
  assert.match(await blues.first().innerText(), /升级\+3/);
  await blues.nth(1).focus();
  await page.keyboard.press("Enter");
  await page.evaluate(() => window.__game.clickCell(8, 6));
  assert.equal(await page.evaluate(() => window.__game.snapshot().heroes.length), 1);
  assert.equal(await blues.count(), 3);
  assert.match(await page.locator("#toast").innerText(), /不能重复上场/);
  await page.evaluate(() => window.__game.clickCell(7, 3));
  assert.equal(await page.evaluate(() => window.__game.snapshot().heroes[0].level), 4);
  assert.equal(await blues.count(), 2);
  // Drag only the second copy; the aim arrow validates the same deployed hero.
  const box = await blues.nth(1).boundingBox();
  const target = await page.evaluate(() => window.__game.cellToScreen(7, 3));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  assert.equal(await page.locator(".card-aim").getAttribute("data-valid"), "true");
  assert.equal(await page.locator("#hand .selected").count(), 1);
  await page.mouse.up();
  await page.waitForFunction(() => window.__game.snapshot().heroes[0].level === 7);
  assert.equal(await blues.count(), 1);
  assert.equal(await page.evaluate(() => window.__game.snapshot().heroes.length), 1);
  assert.equal(await page.evaluate(() => Object.values(window.__game.snapshot().cards).reduce((a, b) => a + b, 0)), 8);
  mkdirSync("logs", { recursive: true });
  await page.screenshot({ path: "logs/hero-duplicates-desktop.png" });
  const editor = await context.newPage();
  editor.on("pageerror", e => errors.push(e.message));
  await editor.goto(url + "/config.html");
  assert.equal(await editor.locator("#card-preview .card-count").count(), 0);
  await editor.locator('[data-category="resource"]').click();
  assert.equal(await editor.locator("#card-preview .card-count").innerText(), "×1");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForFunction(() => window.__game?.snapshot().frames > 3);
  assert.equal(await blues.count(), 4);
  assert.equal(await page.locator("#hand .hero .card-count").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await blues.nth(2).scrollIntoViewIfNeeded();
  await blues.nth(2).click();
  assert.equal(await page.locator("#hand .selected").count(), 1);
  await page.screenshot({ path: "logs/hero-duplicates-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS duplicate heroes browser: separate cards, independent mouse/keyboard selection, drag upgrade, invalid deployment, counts, preview and mobile layout");
} finally {
  await browser?.close();
  server.kill();
}
