import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
const url = "http://127.0.0.1:5196", c = structuredClone(DEFAULT_CONFIG);
for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
c.initial.cards = { hero_blue: 2, training: 20, coffee: 10 };
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5196", "--strictPort"], {
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
  await page.goto(url + "/config.html");
  await page.locator('[data-select="hero_blue"]').click();
  for (const name of ["fiveCards", "cardGrowth", "cardRefund"]) await page.locator(`[data-trigger-template="${name}"]`).click();
  const root = "cards.hero_blue.triggerRules";
  assert.equal(await page.locator(`[data-path="${root}.0.trigger.every"]`).inputValue(), "5");
  assert.equal(await page.locator(`[data-path="${root}.1.effects.0.critDamage"]`).inputValue(), "5");
  assert.equal(await page.locator(`[data-path="${root}.2.effects.0.chance"]`).inputValue(), "20");
  await page.locator(`[data-path="${root}.0.effects.0.category"]`).selectOption("resource");
  await page.locator(`[data-path="${root}.2.effects.0.chance"]`).fill("100");
  await page.locator(`[data-path="${root}.1.effects.0.atk"]`).fill("3");
  const save = async () => {
    await page.locator("#save-config").click();
    await page.waitForFunction(() => document.querySelector("#save-state").textContent.includes("已保存"));
  };
  await save();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("friday-defense-config-v1")));
  assert.equal(stored.cards.hero_blue.triggerRules.length, 3);
  assert.equal(stored.cards.hero_blue.triggerRules[1].effects[0].atk, 3);
  await page.reload();
  await page.locator('[data-select="hero_blue"]').click();
  assert.equal(await page.locator(`[data-path="${root}.2.effects.0.chance"]`).inputValue(), "100");
  mkdirSync("logs", { recursive: true });
  await page.locator(`[data-path="${root}.1.effects.0.atk"]`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "logs/card-play-triggers-editor.png" });
  // Restrict generation to coffee in the saved fixture for deterministic inventory assertions.
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("friday-defense-config-v1"));
    c.cards.hero_blue.triggerRules[0].effects[0] = { type: "generateCard", pool: "selected", category: "all", cards: ["coffee"], count: 1 };
    localStorage.setItem("friday-defense-config-v1", JSON.stringify(c));
  });
  const game = await context.newPage();
  game.on("pageerror", e => errors.push(e.message));
  await game.goto(url);
  await game.waitForFunction(() => window.__game?.snapshot().frames > 3);
  const use = async key => {
    await game.locator(`[data-card="${key}"]`).first().click();
    await game.evaluate(() => window.__game.clickCell(5, 5));
  };
  await use("hero_blue");
  for (let i = 0; i < 5; i++) await use("training");
  const snapshot = await game.evaluate(() => window.__game.snapshot());
  assert.equal(snapshot.cards.training, 20, "resource cards return to hand");
  assert.equal(snapshot.cards.coffee, 11, "five successful plays generate exactly one card");
  assert.equal(snapshot.heroes[0].level, 6, "returned cards do not replay their effect");
  assert.ok(snapshot.heroes[0].triggerPermanentEffects.some(e => e.randomGrowth));
  assert.equal(Object.values(snapshot.heroes[0].cardPlayCounts).every(n => n === 0), true);
  await use("hero_blue");
  assert.equal((await game.evaluate(() => window.__game.snapshot())).cards.hero_blue, undefined, "hero upgrade is consumed and not refunded");
  await game.screenshot({ path: "logs/card-play-triggers-game.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(`[data-path="${root}.1.effects.0.critDamage"]`).scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await page.screenshot({ path: "logs/card-play-triggers-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS card-play browser: three templates, configurable values, save/reload, real card play, generation/refund/growth, duplicate upgrade, mobile and no runtime errors");
} finally {
  await browser?.close();
  server.kill();
}
