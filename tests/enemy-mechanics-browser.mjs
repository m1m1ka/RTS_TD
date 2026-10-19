import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { selectAttackModule } from "../src/attack-modules.js";

const config = structuredClone(DEFAULT_CONFIG), url = "http://127.0.0.1:5203";
config.initial.cards = { hero_blue: 1 }; config.initial.firstWaveDelay = 0; config.initial.boatSpeed = 20;
for (const card of Object.values(config.cards)) if (card.category === "hero") card.triggerRules = [];
Object.assign(config.cards.hero_blue.unit, { atk: 100, maxHp: 10000, range: 1, rate: 2, speed: 4, critChance: 0, mechanics: { knockback: { distance: 1 } } });
selectAttackModule(config.cards.hero_blue.unit, "bow");
Object.assign(config.enemies.grunt, { maxHp: 10000, atk: 0, speed: 2 });
config.days[0].obstacles = []; config.days[0].mines = [];
config.days[0].waves = [{ id: "defense", name: "抵挡与击退", startDelay: 0, hpScale: 1, atkScale: 1,
  spawns: [{ x: 0, y: 3, delay: 0, interval: 100, enemies: [{ type: "grunt", count: 1 }] }] }];
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5203", "--strictPort"],
  { stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" } });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), errors = [];
  context.setDefaultTimeout(15000);
  await context.addInitScript(c => { if (!localStorage.getItem("friday-defense-config-v1")) localStorage.setItem("friday-defense-config-v1", JSON.stringify(c)); }, config);
  const editor = await context.newPage(); editor.on("pageerror", e => errors.push(e.message));
  await editor.goto(url + "/config.html"); await editor.locator('[data-section="enemies"]').click(); await editor.locator('[data-select="grunt"]').click();
  const toggle = editor.locator('[data-mechanic="rangedReduction"]'), root = "enemies.grunt.mechanics.rangedReduction";
  assert.equal(await toggle.isChecked(), false);
  await toggle.check(); await editor.locator(`[data-path="${root}.mode"]`).selectOption("fixed");
  assert.equal(await editor.locator(`[data-path="${root}.value"]`).getAttribute("max"), "100000");
  await editor.locator(`[data-path="${root}.value"]`).fill("70"); await editor.locator("#save-config").click();
  await editor.waitForFunction(() => JSON.parse(localStorage.getItem("friday-defense-config-v1")).enemies.grunt.mechanics?.rangedReduction.value === 70);
  await editor.reload(); await editor.locator('[data-section="enemies"]').click(); await editor.locator('[data-select="grunt"]').click();
  assert.equal(await editor.locator(`[data-path="${root}.mode"]`).inputValue(), "fixed");
  await editor.locator(`[data-path="${root}.mode"]`).selectOption("percent");
  assert.equal(await editor.locator(`[data-path="${root}.value"]`).getAttribute("max"), "100");
  await editor.locator(`[data-path="${root}.value"]`).fill("100"); await editor.locator("#save-config").click();
  await editor.waitForFunction(() => JSON.parse(localStorage.getItem("friday-defense-config-v1")).enemies.grunt.mechanics?.rangedReduction.value === 100);
  mkdirSync("logs", { recursive: true }); await editor.screenshot({ path: "logs/enemy-ranged-defense-config.png" });
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__game?.snapshot().frames > 3);
  await page.locator('[data-card="hero_blue"]').click(); await page.evaluate(() => window.__game.clickCell(1, 3));
  await page.evaluate(() => { window.__game.clickCell(1, 3); window.__game.clickCell(0, 3); window.__game.advance(.5); });
  const snap = () => page.evaluate(() => window.__game.snapshot());
  assert.equal((await snap()).heroes[0].x, 0);
  await page.evaluate(() => { document.querySelector("#start").click(); document.querySelector("#pause").click(); window.__game.advance(.35); });
  let state = await snap(), heroId = state.heroes[0].id;
  assert.equal(state.heroes[0].x, 2);
  assert.ok(state.combatStatuses.some(s => s.type === "knockback" && s.text === "击退" && s.unitId === heroId), "landing knockback displays text over the hero");
  await page.evaluate(() => window.__game.advance(1.1));
  state = await snap(); const enemyId = state.enemies[0].id;
  assert.ok(state.combatStatuses.some(s => s.type === "blocked" && s.text === "抵挡" && s.unitId === enemyId));
  assert.ok(state.combatStatuses.some(s => s.type === "knockback" && s.text === "击退" && s.unitId === enemyId), "hero's attack displays knockback text over the enemy");
  assert.equal(state.enemies[0].hp, state.enemies[0].maxHp, "100% resistance prevents all damage");
  assert.equal(state.combatNumbers.filter(n => n.unitId === enemyId).length, 0, "no misleading damage number for a fully blocked hit");
  await page.screenshot({ path: "logs/enemy-block-and-knockback.png" });
  const status = state.combatStatuses; await page.waitForTimeout(160); assert.deepEqual((await snap()).combatStatuses, status, "pause freezes status text");
  // Existing enemies update immediately; partial blocking shows both text and damage.
  await editor.locator(`[data-path="${root}.value"]`).fill("50"); await editor.locator("#save-config").click();
  await page.waitForFunction(() => window.__game.snapshot().enemies[0].mechanics.rangedReduction.value === 50);
  await page.evaluate(() => window.__game.advance(1.5)); state = await snap();
  assert.ok(state.enemies[0].hp < state.enemies[0].maxHp);
  assert.ok(state.combatNumbers.some(n => n.unitId === enemyId && n.text === "−50"));
  await editor.locator('[data-mechanic="rangedReduction"]').uncheck(); await editor.locator("#save-config").click();
  await page.waitForFunction(() => !window.__game.snapshot().enemies[0].mechanics.rangedReduction);
  const blocks = (await snap()).combatStatuses.filter(s => s.type === "blocked").length;
  await page.evaluate(() => window.__game.advance(1));
  assert.equal((await snap()).combatStatuses.filter(s => s.type === "blocked").length, blocks, "disabled armor produces no new block labels");
  await page.locator("#pause").click(); await page.waitForTimeout(1100); await page.locator("#pause").click();
  assert.equal((await snap()).combatStatuses.filter(s => s.type === "blocked").length, 0, "status labels expire normally");
  await page.locator("#restart").click(); await page.locator("#confirm-restart").click();
  assert.equal((await snap()).combatStatuses.length, 0, "reset clears floating statuses");
  assert.deepEqual(errors, []);
  console.log("PASS enemy defense browser: optional fixed/percent config, persistence/live disable, full/partial block text, landing and attack knockback labels, pause, expiry and cleanup");
} finally { await browser?.close(); server.kill(); }
