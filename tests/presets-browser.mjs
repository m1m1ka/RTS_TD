import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { heroPresets, createPresetCard, presetIds } from "../src/hero-presets.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { Game, attackKind } from "../src/game.js";
const fixture = structuredClone(DEFAULT_CONFIG);
assert.equal(heroPresets.filter(p => p.theme === "blood").length, 8);
assert.equal(heroPresets.filter(p => p.theme === "workshop").length, 5);
fixture.initial.cards = {};
for (const p of heroPresets) {
  fixture.cards[`hero_${p.id}`] = createPresetCard(p.id);
  fixture.initial.cards[`hero_${p.id}`] = 1;
}
const c = assertConfig(fixture), engine = new Game(() => {}, c);
assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c);
engine.playCard("hero_ironwarden", 7, 3);
assert.equal(attackKind(engine.heroes[0]), "slash");
engine.heroes[0].weapon = "bow";
assert.equal(attackKind(engine.heroes[0]), "arrow", "weapon can override a preset's melee action");
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5179", "--strictPort"], { stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" } });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch("http://127.0.0.1:5179")).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  context.setDefaultTimeout(15000);
  const editor = await context.newPage(), errors = [];
  editor.on("pageerror", e => errors.push(e.message));
  await editor.goto("http://127.0.0.1:5179/config.html");
  await editor.locator(".hero-preset-library summary").click();
  assert.equal(await editor.locator("[data-hero-preset]").count(), heroPresets.length);
  const images = await editor.locator(".hero-preset-grid img").evaluateAll(imgs => imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth === 128 })));
  assert.ok(images.every(i => i.loaded)); assert.equal(new Set(images.map(i => i.src)).size, heroPresets.length);
  mkdirSync("logs", { recursive: true });
  await editor.locator(".hero-preset-library").screenshot({ path: "logs/hero-presets-gallery.png" });
  for (const p of heroPresets) {
    await editor.locator(".hero-preset-library").evaluate(el => el.open = true);
    await editor.locator(`[data-hero-preset="${p.id}"]`).click();
    const key = `hero_${p.id}_1`;
    assert.equal(await editor.locator(`[data-icon-select="cards.${key}.icon"]`).inputValue(), p.id);
    assert.equal(await editor.locator(`[data-icon-select="cards.${key}.useIcon"]`).inputValue(), p.id);
    assert.equal(await editor.locator(`[data-path="cards.${key}.unit.attackModule"]`).inputValue(), p.weapon || p.melee || "claw");
    assert.equal(await editor.locator(`[data-path="cards.${key}.unit.attackModule"] option`).count(), 8);
    assert.equal(await editor.locator(`[data-path="cards.${key}.unit.type"]`).count(), 0);
  }
  await editor.locator("#save-config").click();
  const saved = await editor.evaluate(() => JSON.parse(localStorage.getItem("friday-defense-config-v1")));
  for (const p of heroPresets) assert.equal(saved.cards[`hero_${p.id}_1`].name, p.name);
  assert.deepEqual(saved.initial.cards, DEFAULT_CONFIG.initial.cards, "creating templates does not modify starting inventory");
  await editor.locator(".hero-preset-library").evaluate(el => el.open = true);
  await editor.setViewportSize({ width: 390, height: 844 });
  await editor.locator(".hero-preset-library").screenshot({ path: "logs/hero-presets-mobile.png" });
  assert.ok(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const gameContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await gameContext.addInitScript(config => localStorage.setItem("friday-defense-config-v1", JSON.stringify(config)), c);
  const game = await gameContext.newPage(); game.on("pageerror", e => errors.push(e.message));
  await game.goto("http://127.0.0.1:5179");
  await game.waitForFunction(() => window.__game?.snapshot().frames > 5);
  const slots = [1,3,5,7,9].flatMap(y => [1,3,5,7,9,11,13].map(x => [x,y])).filter(([x,y]) => x !== 7 || y !== 5);
  for (let i = 0; i < heroPresets.length; i++) {
    await game.locator(`[data-card="hero_${heroPresets[i].id}"]`).focus();
    await game.keyboard.press("Enter");
    await game.evaluate(([x,y]) => window.__game.clickCell(x,y), slots[i]);
  }
  await game.waitForFunction(n => window.__game.snapshot().healthBars.length === n, heroPresets.length);
  const state = await game.evaluate(() => window.__game.snapshot());
  assert.deepEqual(state.heroes.map(h => h.useIcon), presetIds);
  assert.equal(state.weapons.length, heroPresets.filter(p => p.weapon).length, "ranged weapons use independent rigs");
  await game.screenshot({ path: "logs/hero-presets-battlefield.png" });
  // Exercise both new independent weapons in real combat, including bullet VFX.
  const rangedConfig = structuredClone(c);
  rangedConfig.initial.cards = { hero_musketeer: 1, hero_arbalist: 1 };
  rangedConfig.initial.firstWaveDelay = 0;
  rangedConfig.enemies.grunt.maxHp = 10000;
  rangedConfig.enemies.grunt.atk = 1;
  rangedConfig.days[0].obstacles = [];
  rangedConfig.days[0].mines = [];
  rangedConfig.days[0].waves = [{ id: "ranged_test", name: "Ranged", startDelay: 0, hpScale: 1, atkScale: 1,
    spawns: [{ x: 14, y: 5, delay: 0, interval: 1, enemies: [{ type: "grunt", count: 3, level: 1 }] }] }];
  const rangedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  rangedContext.setDefaultTimeout(15000);
  await rangedContext.addInitScript(config => localStorage.setItem("friday-defense-config-v1", JSON.stringify(config)), assertConfig(rangedConfig));
  const ranged = await rangedContext.newPage(); ranged.on("pageerror", e => errors.push(e.message));
  await ranged.goto("http://127.0.0.1:5179");
  await ranged.waitForFunction(() => window.__game?.snapshot().frames > 3);
  for (const [key, x, y] of [["hero_musketeer",12,4],["hero_arbalist",11,5]]) {
    await ranged.locator(`[data-card="${key}"]`).click();
    await ranged.evaluate(([x,y]) => window.__game.clickCell(x,y), [x,y]);
  }
  await ranged.locator("#start").click();
  await ranged.waitForFunction(() => {
    const s = window.__game.snapshot();
    return s.combat.counts.bullet > 0 && s.combat.counts.arrow > 0 && s.enemies.some(e => e.hp < e.maxHp);
  });
  const fired = await ranged.evaluate(() => window.__game.snapshot());
  assert.deepEqual(new Set(fired.weapons.map(w => w.weapon)), new Set(["musket", "crossbow"]));
  assert.ok(fired.weapons.some(w => Math.abs(w.targetAngle) > .1), "new weapons rotate toward their targets");
  await ranged.screenshot({ path: "logs/medieval-ranged-combat.png" });
  await rangedContext.close();
  // A native canvas contact sheet includes existing heroes for style comparison.
  await editor.setViewportSize({ width: 1050, height: 740 });
  await editor.evaluate(async () => {
    const { unitArt } = await import("/src/art.js");
    const { heroPresets } = await import("/src/hero-presets.js");
    const canvas = document.createElement("canvas"); canvas.id = "contact-sheet"; canvas.width = 1000; canvas.height = Math.ceil((heroPresets.length + 4) / 5) * 230;
    const g = canvas.getContext("2d"); g.fillStyle = "#eef0dd"; g.fillRect(0,0,1000,canvas.height);
    const list = [{ id: "blue", name: "阿蓝 · 原有" }, { id: "green", name: "小叶 · 原有" }, { id: "purple", name: "咕咕 · 原有" }, { id: "catgirl", name: "米娅 · 原有" }, ...heroPresets];
    list.forEach((p,i) => { const x = i % 5 * 200, y = Math.floor(i / 5) * 230;
      g.drawImage(unitArt(p.id, { portrait: true }), x + 20, y + 10, 150,150);
      g.drawImage(unitArt(p.id), x + 136, y + 114, 52,52);
      g.fillStyle = "#34513e"; g.font = "bold 18px sans-serif"; g.textAlign = "center"; g.fillText(p.name, x+100,y+190);
      g.font = "13px sans-serif"; g.fillText(p.role || "风格参照",x+100,y+214);
    });
    document.body.replaceChildren(canvas);
  });
  await editor.locator("#contact-sheet").screenshot({ path: "logs/hero-presets-sheet.png" });
  assert.deepEqual(errors, []);
  console.log(`PASS presets: ${heroPresets.length} unique looks, including 8 blood-themed heroes; template creation, icons, portable config, deployment, independent ranged weapons and mobile gallery`);
} finally { await browser?.close(); server.kill(); }
