import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

const config = structuredClone(DEFAULT_CONFIG), url = "http://127.0.0.1:5206";
config.initial.firstWaveDelay = 0; config.initial.cards = { hero_blue: 1, coin_purse: 1 };
config.cards.coin_purse.effects[0].value = 100;
config.cards.hero_blue.triggerRules = [];
Object.assign(config.cards.hero_blue.unit, { atk: 999, range: 24, rate: 20 });
config.cards.hero_green.rarity = "rare"; config.cards.hero_purple.rarity = "epic";
config.enemies.grunt.maxHp = 1; config.enemies.grunt.atk = 0;
config.days = config.days.slice(0, 3);
config.days.forEach((d, i) => {
  d.next = config.days[i + 1] ? [config.days[i + 1].id] : []; d.obstacles = []; d.mines = [];
  if (i) { d.kind = "shop"; d.shop = { useDefaults: true }; d.waves = []; }
});
config.days[0].mines = [{ x: 3, y: 3, maxHp: 180 }];
config.days[0].waves = [{ id: "economy", name: "金币测试", startDelay: 0, hpScale: 1, atkScale: 1,
  spawns: [{ x: 0, y: 5, delay: 0, interval: 1, enemies: [{ type: "grunt", count: 1, level: 1 }] }] }];
const prices = { commonHeroPrice: 3, rareHeroPrice: 7, epicHeroPrice: 12, heroPackPrice: 11, resourcePackPrice: 13, equipmentPackPrice: 17,
  refreshCost: 2, refreshIncrease: 3, mineGold: 7, victoryGold: 9 };
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5206", "--strictPort"],
  { stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" } });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), errors = [];
  context.setDefaultTimeout(15000);
  await context.addInitScript(c => { if (!localStorage.getItem("friday-defense-config-v1")) localStorage.setItem("friday-defense-config-v1", JSON.stringify(c)); }, config);
  const editor = await context.newPage(); editor.on("pageerror", e => errors.push(e.message));
  await editor.goto(url + "/config.html"); await editor.locator('[data-section="initial"]').click();
  const field = key => editor.locator(`[data-path="initial.economy.${key}"]`);
  for (const [key, value] of Object.entries(prices)) await field(key).fill(String(value));
  await editor.locator("#save-config").click(); assert.ok(!(await editor.locator("#config-message").getAttribute("class")).includes("error"));
  await editor.reload(); await editor.locator('[data-section="initial"]').click();
  for (const [key, value] of Object.entries(prices)) assert.equal(await field(key).inputValue(), String(value));
  await field("refreshIncrease").fill("-1"); await editor.locator("#save-config").click();
  assert.match(await editor.locator("#config-message").textContent(), /refreshIncrease/);
  await field("refreshIncrease").fill("3"); await editor.locator("#save-config").click();
  mkdirSync("logs", { recursive: true });
  await editor.locator(".editor-panel").filter({ has: field("mineGold") }).screenshot({ path: "logs/economy-config.png" });
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__game?.snapshot().frames > 3);
  const snap = () => page.evaluate(() => window.__game.snapshot());
  const use = async (key, x, y) => { await page.locator(`[data-card="${key}"]`).click(); await page.evaluate(([x,y]) => window.__game.clickCell(x,y), [x,y]); };
  await use("coin_purse", 1, 1); await use("hero_blue", 7, 3);
  await page.locator("#start").click(); await page.evaluate(() => window.__game.advance(10));
  assert.equal((await snap()).phase, "reward"); assert.equal((await snap()).gold, 116, "9 victory + 7 surviving mine");
  await page.locator('[data-reward="0"]').click(); await page.locator("[data-reward-confirm]").click();
  await page.locator(`#route-dialog [data-route-node="${config.days[1].id}"]`).click(); await page.locator("[data-route-depart]").click();
  let state = await snap(); assert.equal(state.shop.refreshCount, 0);
  for (const [i, key] of state.shop.heroes.entries()) {
    const expected = prices[(config.cards[key].rarity || "common") + "HeroPrice"];
    assert.equal(await page.locator(`[data-shop-hero="${i}"]`).locator("..").locator(".shop-price").textContent(), `◉ ${expected}`);
  }
  const expected = prices[(config.cards[state.shop.heroes[0]].rarity || "common") + "HeroPrice"];
  await page.locator('[data-shop-hero="0"]').click();
  await page.waitForFunction(() => !document.querySelector("#shop-dialog").hasAttribute("aria-busy"));
  assert.equal((await snap()).gold, 116 - expected);
  for (const cost of [2, 5]) {
    state = await snap();
    assert.equal(state.shop.prices.refreshCost, cost); assert.match(await page.locator("[data-shop-refresh]").textContent(), new RegExp(String(cost)));
    await page.locator("[data-shop-refresh]").click();
    await page.waitForFunction(() => !document.querySelector("#shop-dialog").hasAttribute("aria-busy"));
    assert.equal((await snap()).gold, state.gold - cost);
  }
  await field("refreshIncrease").fill("4"); await editor.locator("#save-config").click();
  await page.waitForFunction(() => window.__game.snapshot().shop.prices.refreshCost === 10);
  assert.equal((await snap()).shop.refreshCount, 2);
  state = await snap(); const category = state.shop.packs[0].category, packPrice = prices[category + "PackPrice"];
  assert.match(await page.locator('[data-shop-pack="0"]').getAttribute("aria-label"), new RegExp(String(packPrice)));
  await page.locator('[data-shop-pack="0"]').click(); await page.locator('[data-pack-choice="0"]').waitFor({ state: "visible" });
  assert.equal((await snap()).gold, state.gold - packPrice);
  await page.locator('[data-pack-choice="0"]').click(); await page.locator("[data-pack-claim]").click();
  await page.waitForFunction(() => window.__game.snapshot().shop.opening === null);
  await page.locator("[data-shop-leave]").click();
  await page.locator(`#route-dialog [data-route-node="${config.days[2].id}"]`).click(); await page.locator("[data-route-depart]").click();
  assert.equal((await snap()).shop.prices.refreshCost, 2); assert.equal((await snap()).shop.refreshCount, 0);
  // Per-node opt-out can override all three qualities while the global defaults remain intact.
  await editor.locator('[data-section="waves"]').click(); await editor.locator('[data-select="2"]').click();
  await editor.locator('[data-path="days.2.shop.useDefaults"]').uncheck();
  await editor.locator('[data-path="days.2.shop.heroPrices.epic"]').fill("1"); await editor.locator("#save-config").click();
  await page.waitForFunction(() => window.__game.snapshot().shop.prices.heroPrices.epic === 1);
  assert.deepEqual(errors, []);
  console.log("PASS economy browser: global editor, persistence/validation, victory+mine payout, rarity shelf labels/payment, pack prices, escalating refresh/live edits/reset, local shop overrides");
} finally { await browser?.close(); server.kill(); }
