import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

const config = structuredClone(DEFAULT_CONFIG);
config.initial.cards = { hero_blue: 1 };
config.days[1].kind = "shop";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5196", "--strictPort"], {
  stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" },
});
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch("http://127.0.0.1:5196")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(c => localStorage.setItem("friday-defense-config-v1", JSON.stringify(c)), config);
  await page.goto("http://127.0.0.1:5196");
  await page.locator("#new-game").click();
  await page.locator('[aria-label="初始手牌五选二"]').waitFor({ state: "visible" });
  await page.keyboard.press("F2");
  await page.selectOption("#debug-day", config.days[1].id);
  await page.locator("[data-debug-jump]").click();
  await page.waitForFunction(() => window.__game.snapshot().phase === "shop");
  assert.ok(await page.locator("#shop-dialog").isVisible());
  assert.equal(await page.locator("#reward-dialog").isVisible(), false);
  assert.equal(await page.locator("#debug-console").isVisible(), false);
  for (const id of [config.days[0].id, config.days[0].id, config.days[2].id]) {
    await page.keyboard.press("F2");
    await page.selectOption("#debug-day", id);
    await page.locator("[data-debug-jump]").click();
    await page.waitForFunction(id => window.__game.snapshot().dayId === id && window.__game.snapshot().phase === "between", id);
    assert.equal(await page.locator("#shop-dialog").isVisible(), false);
    assert.equal(await page.locator("#reward-dialog").isVisible(), false);
    assert.equal(await page.locator("#route-dialog").isVisible(), false);
  }
  assert.deepEqual(errors, []);
  console.log("PASS debug jump browser: F2, initial-draft cancellation, shop entry, return to battle, repeated jumps, no stale dialogs or runtime errors");
} finally {
  await browser?.close();
  server.kill();
}
