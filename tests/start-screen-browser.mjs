import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5198", "--strictPort"], {
  stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" },
});
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch("http://127.0.0.1:5198")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true, args: ["--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(config => {
    localStorage.setItem("friday-defense-config-v1", JSON.stringify(config));
    window.close = () => { window.exitRequested = true; };
  }, { ...structuredClone(DEFAULT_CONFIG), initial: { ...structuredClone(DEFAULT_CONFIG.initial), cards: { hero_blue: 1, hero_green: 1, hero_purple: 1, training: 1, fireball: 1 } } });
  await page.goto("http://127.0.0.1:5198");
  await page.waitForFunction(() => window.__game?.snapshot().frames > 5);
  const state = () => page.evaluate(() => window.__game.snapshot());
  assert.equal(await page.title(), "卡片勇者");
  assert.equal((await state()).startScreen, "menu");
  assert.ok(await page.locator("#new-game").evaluate(el => el === document.activeElement));
  assert.equal(await page.locator(".hud").isVisible(), false);
  assert.equal(await page.locator("#hand-next").isVisible(), false, "hand paging controls cannot leak into the menu");
  await page.keyboard.press("Space");
  // Space activates the focused start button; use F2 on a fresh menu for blocking.
  await page.reload();
  await page.waitForFunction(() => window.__game?.snapshot().frames > 5);
  await page.keyboard.press("F2");
  await page.keyboard.press("Digit1");
  assert.equal((await state()).debugOpen, false);
  assert.equal((await state()).paused, false);
  const waterTime = (await state()).ocean.time;
  await page.waitForTimeout(200);
  assert.ok((await state()).ocean.time > waterTime, "menu uses the animated scene ocean");
  assert.equal((await state()).heroes.length, 0);
  assert.equal((await state()).enemies.length, 0);
  assert.ok(await page.locator("[data-menu-icon]").evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)));
  mkdirSync("logs", { recursive: true });
  await page.screenshot({ path: "logs/start-screen-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "logs/start-screen-mobile.png" });
  const title = await page.locator(".title-emblem h1").boundingBox();
  assert.ok(title.x >= 0 && title.x + title.width <= 390, "mobile title fits viewport");
  await page.locator("#exit-game").click();
  assert.ok(await page.evaluate(() => window.exitRequested));
  assert.match(await page.locator("#menu-status").textContent(), /关闭此标签页/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#new-game").click();
  assert.equal((await state()).startScreen, "transition");
  assert.ok(await page.locator("#scene-transition").isVisible());
  await page.keyboard.press("F2");
  await page.evaluate(() => document.getElementById("new-game").click());
  await page.waitForFunction(() => window.__game.snapshot().startScreen === "playing");
  assert.equal(await page.locator("#start-screen").isVisible(), false);
  assert.equal(await page.locator("#scene-transition").isVisible(), false);
  assert.ok(await page.locator(".hud").isVisible());
  assert.equal((await state()).debugOpen, false);
  assert.equal((await state()).phase, "initialDraft");
  const initial = await state();
  const blue = initial.initialHandOptions.indexOf("hero_blue");
  assert.ok(blue >= 0);
  await page.locator(`[data-reward="${blue}"]`).click();
  await page.locator(`[data-reward="${blue === 0 ? 1 : 0}"]`).click();
  await page.locator("[data-reward-confirm]").click();
  await page.waitForFunction(() => window.__game.snapshot().phase === "ready");
  await page.locator('[data-card="hero_blue"]').first().click();
  await page.evaluate(() => window.__game.clickCell(7, 3));
  assert.equal((await state()).heroes.length, 1, "first level supports deployment after transition");
  await page.screenshot({ path: "logs/start-screen-first-level.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForFunction(() => window.__game?.snapshot().frames > 5);
  const still = (await state()).ocean.time;
  await page.waitForTimeout(150);
  assert.equal((await state()).ocean.time, still);
  await page.locator("#new-game").press("Enter");
  await page.waitForFunction(() => window.__game.snapshot().startScreen === "playing");
  assert.deepEqual(errors, []);
  console.log("PASS start screen: ocean, icons, keyboard/input isolation, exit fallback, responsive layout, single transition, deployment and reduced motion");
} finally {
  await browser?.close();
  server.kill();
}
