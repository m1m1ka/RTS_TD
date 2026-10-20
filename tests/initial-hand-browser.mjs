import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

const config = structuredClone(DEFAULT_CONFIG);
config.initial.cards = { hero_blue: 5, hero_green: 1, hero_purple: 1, training: 9, fireball: 1 };
config.initial.firstWaveDelay = 0;
config.cards.hero_blue.unit.range = 24;
config.cards.hero_blue.unit.atk = 9999;
config.enemies.grunt.maxHp = 1;
config.days[0].waves = [config.days[0].waves[0]];
config.days[0].waves[0].spawns = [{ x: 7, y: 0, delay: 0, interval: 1, enemies: [{ type: "grunt", count: 1, level: 1 }] }];
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5197", "--strictPort"], {
  stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" },
});
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch("http://127.0.0.1:5197")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(c => localStorage.setItem("friday-defense-config-v1", JSON.stringify(c)), config);
  await page.goto("http://127.0.0.1:5197");
  await page.waitForFunction(() => window.__game?.snapshot().frames > 5);
  const state = () => page.evaluate(() => window.__game.snapshot());
  assert.deepEqual((await state()).cards, {});
  assert.equal(await page.locator("#reward-dialog").isVisible(), false, "draft waits until the title transition finishes");
  await page.locator("#new-game").click();
  await page.locator('[aria-label="初始手牌五选二"]').waitFor({ state: "visible" });
  assert.equal(await page.locator("[data-reward]").count(), 5);
  await page.waitForTimeout(900);
  const before = await state(), blue = before.initialHandOptions.indexOf("hero_blue"), training = before.initialHandOptions.indexOf("training");
  const third = before.initialHandOptions.findIndex((_, i) => i !== blue && i !== training);
  const confirm = page.locator("[data-reward-confirm]");
  assert.ok(await confirm.isDisabled());
  await page.keyboard.press("Escape");
  assert.ok(await page.locator("#reward-dialog").isVisible());
  await page.locator(`[data-reward="${blue}"]`).click();
  assert.ok(await confirm.isDisabled());
  await page.locator(`[data-reward="${training}"]`).click();
  assert.ok(await confirm.isEnabled());
  await page.locator(`[data-reward="${third}"]`).click();
  assert.equal(await page.locator(".reward-card.picked").count(), 2);
  assert.equal(await page.locator(`[data-reward="${third}"]`).getAttribute("aria-pressed"), "false");
  await page.locator(`[data-reward="${training}"]`).click();
  assert.ok(await confirm.isDisabled());
  await page.locator(`[data-reward="${training}"]`).click();
  mkdirSync("logs", { recursive: true });
  await page.screenshot({ path: "logs/initial-hand-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "logs/initial-hand-mobile.png" });
  const boxes = await page.locator("[data-reward], [data-reward-confirm]").evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  }));
  assert.ok(boxes.every(r => r.x >= 0 && r.y >= 0 && r.right <= 390 && r.bottom <= 844), "all five cards and confirm fit the mobile viewport");
  await page.setViewportSize({ width: 1440, height: 900 });
  await confirm.click();
  await confirm.dispatchEvent("click");
  await page.waitForFunction(() => window.__game.snapshot().phase === "ready");
  assert.deepEqual((await state()).cards, { hero_blue: 1, training: 1 });
  assert.deepEqual((await state()).completedDays, []);
  await page.locator('[data-card="hero_blue"]').click();
  await page.evaluate(() => window.__game.clickCell(7, 3));
  assert.equal((await state()).heroes.length, 1);
  await page.locator("#start").click();
  await page.evaluate(() => window.__game.advance(120));
  await page.waitForFunction(() => window.__game.snapshot().phase === "reward");
  assert.equal(await page.locator("[data-reward]").count(), 3, "victory keeps its existing three-of-one flow");
  await page.locator('[data-reward="0"]').click();
  assert.match(await confirm.textContent(), /1 \/ 1/);
  await confirm.click();
  await page.waitForFunction(() => window.__game.snapshot().phase === "route");
  await page.locator("#route-dialog .route-node.available").first().click();
  assert.equal((await state()).phase, "between");
  assert.equal(await page.locator("#reward-dialog").isVisible(), false, "later days do not repeat initial selection");
  await page.locator("#restart").click();
  await page.locator("#confirm-restart").click();
  await page.waitForFunction(() => window.__game.snapshot().phase === "initialDraft");
  assert.deepEqual((await state()).cards, {});
  assert.equal(await page.locator("[data-reward]").count(), 5);
  await page.locator('[data-reward="0"]').click();
  await page.evaluate(async () => {
    const store = await import("/src/config/store.js");
    const c = structuredClone(store.getConfig()); c.initial.cards = { hero_green: 7 };
    await store.saveConfig(c);
  });
  await page.waitForFunction(() => window.__game.snapshot().initialHandOptions.every(key => key === "hero_green"));
  assert.equal(await page.locator(".reward-card.picked").count(), 0);
  await page.locator('[data-reward="0"]').click();
  await page.locator('[data-reward="1"]').click();
  await confirm.click();
  await page.waitForFunction(() => window.__game.snapshot().phase === "ready");
  assert.deepEqual((await state()).cards, { hero_green: 2 });
  assert.deepEqual(errors, []);
  console.log("PASS initial hand browser: menu ordering, five-of-two selection/deselection, mobile, atomic claim, deployment, victory three-of-one, later days, restart and live pool edits");
} finally {
  await browser?.close();
  server.kill();
}
