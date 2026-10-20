import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
const config = structuredClone(DEFAULT_CONFIG), url = "http://127.0.0.1:5207";
config.initial.cards = { hero_blue: 1, coin_purse: 1 };
config.cards.hero_blue.tags = [];
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5207", "--strictPort"],
  { stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" } });
let browser;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), errors = [];
  await context.addInitScript(c => { if (!localStorage.getItem("friday-defense-config-v1")) localStorage.setItem("friday-defense-config-v1", JSON.stringify(c)); }, config);
  const editor = await context.newPage(); editor.on("pageerror", e => errors.push(e.message));
  await editor.goto(url + "/config.html");
  await editor.locator('[data-select="hero_blue"]').click();
  await editor.locator('[data-hero-tag="battleStart"]').check();
  await editor.locator('[data-hero-tag="parts"]').check();
  await editor.locator('[data-hero-tag="follower"]').check();
  await editor.locator('[data-section="initial"]').click();
  const text = "自定义开战说明 <b>白字</b>";
  await editor.locator('[data-path="initial.heroTagDescriptions.follower"]').fill("随从协助英雄战斗");
  await editor.locator('[data-path="initial.heroTagDescriptions.battleStart"]').fill(text);
  await editor.locator("#save-config").click();
  assert.ok(!(await editor.locator("#config-message").getAttribute("class")).includes("error"));
  await editor.reload();
  await editor.locator('[data-select="hero_blue"]').click();
  assert.ok(await editor.locator('[data-hero-tag="parts"]').isChecked());
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__game?.snapshot().frames > 3);
  const card = page.locator('[data-card="hero_blue"]'), tooltip = page.locator("#hero-tag-tooltip");
  await card.hover(); await tooltip.waitFor({ state: "visible" });
  assert.equal(await tooltip.locator("section").count(), 3);
  assert.equal(await tooltip.locator("section").last().locator("strong").textContent(), "随从");
  assert.equal(await tooltip.locator("p").last().textContent(), "随从协助英雄战斗");
  assert.equal(await tooltip.locator("p").first().textContent(), text);
  assert.equal(await tooltip.locator("p b").count(), 0);
  const box = await tooltip.boundingBox(), anchor = await card.boundingBox();
  assert.ok(box.y + box.height <= anchor.y);
  assert.equal(await tooltip.evaluate(el => getComputedStyle(el).color), "rgb(255, 255, 255)");
  assert.equal(await tooltip.evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0.82)");
  mkdirSync("logs", { recursive: true }); await page.screenshot({ path: "logs/hero-tags.png" });
  await page.locator('[data-card="coin_purse"]').hover(); await tooltip.waitFor({ state: "hidden" });
  await card.focus(); await tooltip.waitFor({ state: "visible" });
  await page.keyboard.press("Escape"); await tooltip.waitFor({ state: "hidden" });
  // Use the production reward/shop renderers inside modal dialogs to verify top-layer visibility.
  await page.evaluate(async c => {
    const { RewardUI } = await import("/src/reward-ui.js");
    c.cards.hero_blue.tags = ["parts"];
    const game = { config: c, phase: "reward", rewardOptions: ["hero_blue"] };
    new RewardUI(game, () => {}).update();
  }, config);
  await page.locator("[data-reward]").hover(); await tooltip.waitFor({ state: "visible" });
  assert.ok(await tooltip.evaluate(el => el.matches(":popover-open")));
  await page.evaluate(async c => {
    document.querySelector("#reward-dialog").close();
    const { ShopUI } = await import("/src/shop-ui.js");
    document.querySelector("#shop-dialog").removeAttribute("id");
    const dialog = document.createElement("dialog"); dialog.id = "shop-dialog"; document.body.append(dialog);
    const ui = new ShopUI({ config: c }, () => {});
    ui.dialog.innerHTML = ui.card("hero_blue", 'data-test-shop disabled');
    ui.dialog.showModal();
  }, config);
  await page.locator("[data-test-shop]").hover(); await tooltip.waitFor({ state: "visible" });
  assert.ok(await tooltip.evaluate(el => el.matches(":popover-open")));
  await page.evaluate(() => { document.querySelector("#shop-dialog").close(); document.activeElement?.blur(); }); await page.mouse.move(10, 500); await tooltip.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log("PASS hero tags browser: editor persistence, custom text, safe rendering, position/style, keyboard, non-heroes, reward/shop modal visibility");
} finally { await browser?.close(); server.kill(); }
