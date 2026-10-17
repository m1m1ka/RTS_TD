import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

const url = "http://127.0.0.1:5193";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5193", "--strictPort"], {
  stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" },
});
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  const executablePath = process.env.CHROME_PATH || [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  context.setDefaultTimeout(15000);
  const editor = await context.newPage(), errors = [];
  editor.on("pageerror", e => errors.push(e.message));
  await editor.goto(url + "/config.html");
  const input = path => editor.locator(`[data-path="${path}"]`);
  assert.equal(await input("cards.hero_blue.statSource").inputValue(), "custom");
  assert.equal(await input("cards.hero_blue.unit.maxHp").inputValue(), String(DEFAULT_CONFIG.cards.hero_blue.unit.maxHp));
  await input("cards.hero_blue.rarity").selectOption("epic");
  await input("cards.hero_blue.role").selectOption("tank");
  assert.equal(await input("cards.hero_blue.unit.maxHp").inputValue(), "800");
  assert.ok(await input("cards.hero_blue.unit.maxHp").isDisabled());
  assert.ok(await input("cards.hero_blue.unit.levelGrowth.atk").isDisabled());
  assert.match(await editor.locator("#card-preview .card-kind").innerText(), /史诗 · 坦克/);
  await editor.locator('[data-select="hero_green"]').click();
  await input("cards.hero_green.rarity").selectOption("rare");
  await input("cards.hero_green.role").selectOption("marksman");
  await editor.locator('[data-section="initial"]').click();
  assert.equal(await editor.locator(".hero-role-preset").count(), 15);
  await editor.locator(".hero-stat-tier.rarity-epic summary").click();
  await input("initial.heroStatPresets.epic.tank.maxHp").fill("1234");
  await input("initial.heroStatPresets.epic.tank.levelGrowth.maxHp").fill("99");
  await input("initial.heroStatPresets.epic.tank.rate").fill("2.5");
  await editor.locator('[data-section="cards"]').click();
  assert.equal(await input("cards.hero_blue.unit.maxHp").inputValue(), "1234");
  assert.equal(await input("cards.hero_blue.unit.levelGrowth.maxHp").inputValue(), "99");
  assert.equal(await input("cards.hero_blue.unit.rate").inputValue(), "2.5");
  await editor.locator("#save-config").click();
  await editor.waitForFunction(() => document.querySelector("#save-state").textContent.includes("已保存"));
  await editor.reload();
  assert.equal(await input("cards.hero_blue.rarity").inputValue(), "epic");
  assert.equal(await input("cards.hero_blue.unit.maxHp").inputValue(), "1234");

  const game = await context.newPage();
  game.on("pageerror", e => errors.push(e.message));
  await game.goto(url);
  await game.waitForFunction(() => window.__game?.snapshot().frames > 3);
  const colors = [];
  for (const [id, rarity, label] of [["hero_blue", "epic", "史诗"], ["hero_green", "rare", "稀有"], ["hero_purple", "common", "普通"]]) {
    const card = game.locator(`[data-card="${id}"].rarity-${rarity}`);
    assert.match(await card.innerText(), new RegExp(label));
    colors.push(await card.evaluate(el => getComputedStyle(el).backgroundColor));
  }
  assert.equal(new Set(colors).size, 3, "three visibly different card backgrounds");
  await game.locator('[data-card="hero_blue"]').focus();
  await game.keyboard.press("Enter");
  await game.evaluate(() => window.__game.clickCell(7, 3));
  assert.equal(await game.evaluate(() => window.__game.snapshot().heroes[0].maxHp), 1234);
  await editor.bringToFront();
  await editor.locator('[data-section="initial"]').click();
  await editor.locator(".hero-stat-tier.rarity-epic summary").click();
  await input("initial.heroStatPresets.epic.tank.maxHp").fill("1400");
  await editor.locator("#save-config").click();
  await game.waitForFunction(() => window.__game.snapshot().heroes[0].maxHp === 1400);

  await editor.locator('[data-section="cards"]').click();
  await input("cards.hero_blue.statSource").selectOption("custom");
  await input("cards.hero_blue.unit.maxHp").fill("1555");
  await editor.locator('[data-section="initial"]').click();
  await editor.locator(".hero-stat-tier.rarity-epic summary").click();
  await input("initial.heroStatPresets.epic.tank.maxHp").fill("1600");
  await editor.locator('[data-section="cards"]').click();
  assert.equal(await input("cards.hero_blue.unit.maxHp").inputValue(), "1555");
  await input("cards.hero_blue.statSource").selectOption("preset");
  assert.equal(await input("cards.hero_blue.unit.maxHp").inputValue(), "1600");
  // Export/import carries the full preset matrix and metadata.
  const downloadPromise = editor.waitForEvent("download");
  await editor.locator("#export-config").click();
  const download = await downloadPromise;
  await editor.locator("#save-config").click();
  await editor.waitForFunction(() => document.querySelector("#save-state").textContent.includes("已保存"));
  await editor.locator("#import-file").setInputFiles(await download.path());
  await editor.waitForFunction(() => document.querySelector("#config-message").textContent.includes("导入成功"));
  await editor.locator('[data-select="hero_blue"]').click();
  assert.equal(await input("cards.hero_blue.unit.maxHp").inputValue(), "1600");
  await editor.locator(".hero-preset-library summary").click();
  await editor.locator('[data-hero-preset="ironwarden"]').click();
  assert.equal(await input("cards.hero_ironwarden_1.role").inputValue(), "tank");
  assert.equal(await input("cards.hero_ironwarden_1.statSource").inputValue(), "preset");
  await editor.locator("#save-config").click();

  mkdirSync("logs", { recursive: true });
  await editor.locator('[data-select="hero_blue"]').click();
  await editor.locator('[data-path="cards.hero_blue.rarity"]').scrollIntoViewIfNeeded();
  await editor.screenshot({ path: "logs/hero-grades-editor.png" });
  await game.bringToFront();
  await game.screenshot({ path: "logs/hero-grades-hand.png" });
  // Exercise the same rendering used by rewards and shop packs.
  const rendering = await game.evaluate(async () => {
    const { getConfig } = await import("/src/config/store.js");
    const { RewardUI } = await import("/src/reward-ui.js");
    const { ShopUI } = await import("/src/shop-ui.js");
    const config = getConfig(), keys = ["hero_blue", "hero_green", "hero_purple"];
    const fixture = { config, phase: "reward", rewardOptions: keys };
    const ui = new RewardUI(fixture, () => {});
    ui.update();
    const reward = [...document.querySelectorAll("[data-reward]")].map(el => ({ className: el.className, color: getComputedStyle(el).backgroundColor }));
    const shop = keys.map(key => ShopUI.prototype.card.call({ game: fixture }, key, ""));
    ui.reset();
    return { reward, shop };
  });
  for (const [i, rarity] of ["epic", "rare", "common"].entries()) {
    assert.match(rendering.reward[i].className, new RegExp("rarity-" + rarity));
    assert.match(rendering.shop[i], new RegExp("rarity-" + rarity));
    assert.equal(rendering.reward[i].color, colors[i]);
  }
  await editor.setViewportSize({ width: 390, height: 844 });
  await editor.locator('[data-section="initial"]').click();
  assert.ok(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await editor.screenshot({ path: "logs/hero-grades-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS hero grades browser: preset selection/editing, persistence, live combat sync, custom values, import/export, new heroes, all card surfaces and mobile layout");
} finally {
  await browser?.close();
  server.kill();
}
