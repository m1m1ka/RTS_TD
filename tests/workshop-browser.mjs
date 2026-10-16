import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { createPresetCard } from "../src/hero-presets.js";
const url = "http://127.0.0.1:5189";
const c = structuredClone(DEFAULT_CONFIG);
c.cards.hero_blue = createPresetCard("gearengineer");
c.initial.cards = { hero_blue: 1, training: 3, parts: 2 };
c.initial.firstWaveDelay = 100;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5189", "--strictPort"], {
  stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" },
});
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000);
  const editor = await context.newPage(), errors = [];
  editor.on("pageerror", e => errors.push(e.message));
  await editor.goto(url + "/config.html");
  await editor.evaluate(config => localStorage.setItem("friday-defense-config-v1", JSON.stringify(config)), c);
  await editor.reload();
  const game = await context.newPage(); game.on("pageerror", e => errors.push(e.message));
  await game.goto(url); await game.waitForFunction(() => window.__game?.snapshot().frames > 3);
  await editor.bringToFront();
  await editor.locator('[data-trigger-template="parts"]').click();
  const r = "cards.hero_blue.triggerRules.0";
  await editor.locator(`[data-path="${r}.trigger.interval"]`).fill("2");
  await editor.locator('[data-trigger-template="engineering"]').click();
  const t = "cards.hero_blue.triggerRules.1";
  assert.equal(await editor.locator(`[data-path="${t}.target.kind"]`).inputValue(), "eventTower");
  await editor.locator(`[data-path="${t}.effects.0.percent"]`).fill("100");
  await editor.locator(`[data-path="${t}.trigger.radius"]`).fill("4");
  // Switching a legacy event initializes the interval and removes an invalid tower target.
  await editor.locator(`[data-path="${t}.trigger.event"]`).selectOption("interval");
  assert.equal(await editor.locator(`[data-path="${t}.trigger.interval"]`).inputValue(), "10");
  assert.equal(await editor.locator(`[data-path="${t}.target.kind"]`).inputValue(), "self");
  await editor.locator(`[data-path="${t}.trigger.event"]`).selectOption("towerBuilt");
  assert.equal(await editor.locator(`[data-path="${t}.target.kind"]`).inputValue(), "eventTower");
  await editor.locator('#save-config').click();
  await editor.waitForFunction(() => JSON.parse(localStorage.getItem("friday-defense-config-v1")).cards.hero_blue.triggerRules.length === 2);
  await editor.locator('[data-category="resource"]').click();
  await editor.locator('[data-select="parts"]').click();
  assert.equal(await editor.locator('[data-path="cards.parts.temporary"]').isChecked(), true);
  assert.match(await editor.locator('#card-preview .card-kind').innerText(), /临时/);
  await editor.locator('[data-path="cards.parts.temporary"]').uncheck();
  await editor.locator('[data-path="cards.parts.temporary"]').check();
  await editor.locator('#save-config').click();
  await editor.reload();
  await editor.locator('[data-category="resource"]').click();
  await editor.locator('[data-select="parts"]').click();
  assert.equal(await editor.locator('[data-path="cards.parts.temporary"]').isChecked(), true);
  mkdirSync("logs", { recursive: true });
  await editor.screenshot({ path: "logs/workshop-config.png" });
  await game.bringToFront();
  const play = async (key, x, y) => {
    await game.locator(`[data-card="${key}"]`).focus(); await game.keyboard.press("Enter");
    await game.evaluate(([x,y]) => window.__game.clickCell(x,y), [x,y]);
  };
  assert.match(await game.locator('[data-card="parts"] .card-kind').innerText(), /临时/);
  await play("hero_blue", 5, 5);
  await play("training", 5, 5); // Lv 2
  await play("parts", 5, 4);
  await game.waitForFunction(() => window.__game.snapshot().towers[0]?.level === 3);
  const tower = await game.evaluate(() => window.__game.snapshot().towers[0]);
  assert.equal(tower.atk, c.cards.parts.unit.atk + 12);
  assert.equal(tower.hp, tower.maxHp);
  await game.locator('#start').click();
  await game.locator('#pause').click();
  const before = await game.evaluate(() => window.__game.snapshot().cards.parts);
  await game.evaluate(() => window.__game.advance(4.05));
  assert.equal(await game.evaluate(() => window.__game.snapshot().cards.parts), before + 2);
  await game.locator('#pause').click();
  await play("parts", 6, 5);
  await game.waitForFunction(() => window.__game.snapshot().towers.length === 2);
  const state = await game.evaluate(() => window.__game.snapshot());
  assert.equal(state.towers[1].level, 3);
  assert.equal(state.heroes[0].useIcon, "gearengineer");
  await game.screenshot({ path: "logs/workshop-battlefield.png" });
  assert.deepEqual(errors, []);
  console.log("PASS workshop browser: editable temporary card, production/build templates, event switching, persistence/live sync, engineer deployment, turret levels/growth and timed inventory HUD");
} finally {
  await browser?.close(); server.kill();
}
