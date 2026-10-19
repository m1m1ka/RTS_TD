import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { selectAttackModule } from "../src/attack-modules.js";

const config = structuredClone(DEFAULT_CONFIG), url = "http://127.0.0.1:5204";
config.initial.cards = { hero_blue: 1 }; config.initial.firstWaveDelay = 0; config.initial.boatSpeed = 20;
for (const card of Object.values(config.cards)) if (card.category === "hero") card.triggerRules = [];
selectAttackModule(config.cards.hero_blue.unit, "slash");
Object.assign(config.cards.hero_blue.unit, { maxHp: 10000, atk: 10, range: 1, speed: 4, critChance: 0 });
selectAttackModule(config.enemies.grunt, "bow");
Object.assign(config.enemies.grunt, { maxHp: 10000, atk: 1, range: 20, rate: 4, speed: 1, critChance: 0 });
config.days[0].obstacles = []; config.days[0].mines = [];
config.days[0].waves = [{ id: "retaliation", name: "受击反击", startDelay: 0, hpScale: 1, atkScale: 1,
  spawns: [{ x: 0, y: 3, delay: 0, interval: 1, enemies: [{ type: "grunt", count: 1, level: 1 }] }] }];
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5204", "--strictPort"],
  { stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" } });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), errors = [];
  await context.addInitScript(c => localStorage.setItem("friday-defense-config-v1", JSON.stringify(c)), config);
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__game?.snapshot().frames > 3);
  await page.locator('[data-card="hero_blue"]').click(); await page.evaluate(() => window.__game.clickCell(6, 3));
  await page.evaluate(() => { document.querySelector("#start").click(); document.querySelector("#pause").click(); window.__game.advance(1.1); });
  let state = await page.evaluate(() => window.__game.snapshot());
  assert.ok(state.heroes[0].x < 6, "incoming ranged attacks trigger visible pursuit");
  assert.equal(state.heroes[0].retaliationTargetId, state.enemies[0].id);
  const priorHp = state.heroes[0].hp;
  await page.evaluate(() => {
    const state = window.__game.snapshot(), h = state.heroes[0];
    document.querySelector("#pause").click();
    if (state.inspectedUnitId !== h.id) window.__game.clickCell(h.x, h.y);
    window.__game.clickCell(12, 8);
    document.querySelector("#pause").click();
  });
  state = await page.evaluate(() => window.__game.snapshot());
  assert.deepEqual(state.heroes[0].path.at(-1), { x: 12, y: 8 });
  assert.equal(state.heroes[0].retaliationTargetId, null);
  const route = await page.evaluate(() => {
    const states = [];
    for (let i = 0; i < 300; i++) {
      window.__game.advance(.025);
      const h = window.__game.snapshot().heroes[0];
      states.push({ x: h.x, y: h.y, goal: h.path.at(-1) || null });
      if (!h.path.length) break;
    }
    return states;
  });
  assert.ok(route.slice(0, -1).every(s => s.goal.x === 12 && s.goal.y === 8), "continuous enemy fire cannot replace a player order");
  assert.deepEqual(route.at(-1), { x: 12, y: 8, goal: null });
  state = await page.evaluate(() => window.__game.snapshot());
  assert.ok(state.heroes[0].hp < priorHp, "hero was hit during the manual move");
  await page.evaluate(() => window.__game.advance(5));
  state = await page.evaluate(() => window.__game.snapshot());
  const h = state.heroes[0], e = state.enemies[0];
  assert.equal(Math.max(Math.abs(h.x - e.x), Math.abs(h.y - e.y)), 1);
  assert.ok(e.hp < e.maxHp, "counterattack deals damage after the order completes");
  assert.ok(state.combatNumbers.some(n => n.unitId === e.id), "counterattack uses existing hit effects");
  assert.deepEqual(errors, []);
  console.log("PASS retaliation browser: real boat/ranged hits, automatic approach, UI movement interrupt, manual destination under sustained fire, deferred counterattack and rendered damage");
} finally { await browser?.close(); server.kill(); }
