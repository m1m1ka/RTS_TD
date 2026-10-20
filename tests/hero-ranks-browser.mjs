import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";

const c = structuredClone(DEFAULT_CONFIG), url = "http://127.0.0.1:5205";
c.initial.cards = { hero_blue: 2 }; c.initial.firstWaveDelay = 0; c.initial.boatSpeed = 20;
c.days = c.days.slice(0, 2);
c.days.forEach((d, i) => {
  d.kind = "battle"; d.obstacles = []; d.mines = []; d.next = c.days[i + 1] ? [c.days[i + 1].id] : [];
  d.waves = [{ id: "rank_test", name: "升阶验证", hpScale: 1, atkScale: 1, startDelay: 0,
    spawns: [{ x: 0, y: 3, delay: 0, interval: 1, enemies: [{ type: "grunt", count: 1, level: 1 }] }] }];
});
Object.assign(c.cards.hero_blue.unit, { atk: 999, range: 24, rate: 20, critChance: 0 });
c.cards.hero_blue.effects = [{ type: "stat", stat: "atk", mode: "add", value: 5 }];
c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), trigger: { event: "preparation", scope: "any", radius: -1 },
  effects: [{ type: "generateCard", pool: "selected", category: "all", cards: ["coffee"], count: 1 }] }];
c.enemies.grunt.maxHp = 1; c.enemies.grunt.atk = 0;
for (const pool of Object.values(c.rewardPools)) pool.cards = { training: 1 };
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5205", "--strictPort"],
  { stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" } });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), errors = [];
  context.setDefaultTimeout(15000);
  await context.addInitScript(config => { if (!localStorage.getItem("friday-defense-config-v1")) localStorage.setItem("friday-defense-config-v1", JSON.stringify(config)); }, c);
  const editor = await context.newPage(); editor.on("pageerror", e => errors.push(e.message));
  await editor.goto(url + "/config.html");
  const input = path => editor.locator(`[data-path="${path}"]`);
  const ranked = (path, rank) => editor.locator(`[data-rank-value="${path}"][data-rank-index="${rank}"]`);
  for (const [i, level] of [2, 4, 6].entries()) await input(`cards.hero_blue.rankLevels.${i}`).fill(String(level));
  for (const [i, value] of [20, 30, 40].entries()) await ranked("cards.hero_blue.effects.0.value", i + 1).fill(String(value));
  await ranked("cards.hero_blue.triggerRules.0.effects.0.count", 2).fill("3");
  await editor.locator("#save-config").click();
  assert.ok(!(await editor.locator("#config-message").getAttribute("class")).includes("error"));
  await editor.reload();
  assert.equal(await input("cards.hero_blue.rankLevels.1").inputValue(), "4");
  assert.equal(await ranked("cards.hero_blue.effects.0.value", 2).inputValue(), "30");
  // Validate variants, not just the base effect.
  await ranked("cards.hero_blue.triggerRules.0.effects.0.count", 2).fill("0");
  await editor.locator("#save-config").click(); assert.match(await editor.locator("#config-message").textContent(), /2 阶/);
  await ranked("cards.hero_blue.triggerRules.0.effects.0.count", 2).fill("3");
  await input("cards.hero_blue.rankLevels.1").fill("2");
  await editor.locator("#save-config").click(); assert.match(await editor.locator("#config-message").textContent(), /递增/);
  await input("cards.hero_blue.rankLevels.1").fill("4"); await editor.locator("#save-config").click();
  mkdirSync("logs", { recursive: true });
  await editor.locator(".editor-panel").filter({ has: input("cards.hero_blue.rankLevels.0") }).screenshot({ path: "logs/hero-ranks-editor.png" });
  await editor.locator(".effect-row").filter({ has: ranked("cards.hero_blue.effects.0.value", 2) }).screenshot({ path: "logs/hero-rank-values.png" });
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__game?.snapshot().frames > 3);
  const snap = () => page.evaluate(() => window.__game.snapshot());
  const deploy = async (x, y) => { await page.locator('[data-card="hero_blue"]').first().click(); await page.evaluate(([x,y]) => window.__game.clickCell(x,y), [x,y]); };
  await deploy(5, 3); let state = await snap();
  const id = state.heroes[0].id; assert.equal(state.heroes[0].rank, 0); assert.equal(state.cards.coffee, 1);
  await deploy(5, 3); state = await snap();
  assert.equal(state.heroes[0].level, 4); assert.equal(state.heroes[0].rank, 2); assert.equal(state.cards.coffee, 1, "rank-up does not replay preparation");
  assert.equal(state.heroes[0].atk, 999 + c.cards.hero_blue.unit.levelGrowth.atk * 3 + 30);
  await page.evaluate(() => window.__game.clickCell(5, 3));
  assert.match(await page.locator("#unit-role").textContent(), /2 阶.*Lv\.4/);
  await page.screenshot({ path: "logs/hero-rank-inspector.png" });
  await page.locator("#start").click(); await page.evaluate(() => window.__game.advance(8));
  assert.equal((await snap()).phase, "reward");
  await page.locator('[data-reward="0"]').click(); await page.locator("[data-reward-confirm]").click();
  await page.locator(`#route-dialog [data-route-node="${c.days[1].id}"]`).click(); await page.locator("[data-route-depart]").click();
  state = await snap(); assert.equal(state.heroes.length, 0); assert.equal(state.heroReserve[0].id, id);
  assert.equal(state.heroReserve[0].rank, 2); assert.equal(state.cards.hero_blue, 1);
  assert.match(await page.locator('[data-card="hero_blue"] .card-kind').textContent(), /2阶/);
  await page.waitForTimeout(100); assert.ok(!(await snap()).unitVisuals.some(v => v.id === id), "recalled hero has no lingering battlefield sprite");
  assert.equal(state.cards.coffee, 1, "entering the next day does not trigger preparation before deployment");
  await page.locator("#start").click(); assert.equal((await snap()).phase, "between", "empty board cannot begin battle");
  await deploy(9, 7); state = await snap();
  assert.equal(state.heroes[0].id, id); assert.equal(state.heroes[0].rank, 2); assert.equal(state.heroes[0].level, 4);
  assert.equal(state.cards.coffee, 4, "manual redeployment uses the preserved hero's rank-two preparation values");
  assert.equal(state.heroReserve.length, 0);
  await ranked("cards.hero_blue.effects.0.value", 2).fill("50"); await editor.locator("#save-config").click();
  await page.waitForFunction(() => window.__game.snapshot().heroes[0].atk === 999 + 12 * 3 + 50);
  await ranked("cards.hero_blue.effects.0.value", 2).fill(""); await editor.locator("#save-config").click();
  await page.waitForFunction(() => window.__game.snapshot().heroes[0].atk === 999 + 12 * 3 + 5);
  await editor.reload(); assert.equal(await ranked("cards.hero_blue.effects.0.value", 2).inputValue(), "", "clearing an override persists rank-zero inheritance");
  assert.deepEqual(errors, []);
  console.log("PASS hero rank/day browser: thresholds and per-rank values, save/reload/validation, real duplicate upgrades, inspector, next-day recall/visual removal, manual redeployment, ranked preparation, hot edit and inheritance reset");
} finally { await browser?.close(); server.kill(); }
