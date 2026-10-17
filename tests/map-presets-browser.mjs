import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

const url = "http://127.0.0.1:5195";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5195", "--strictPort"], {
  stdio: "ignore", windowsHide: true, env: { ...process.env, FRIDAY_CONFIG_SYNC: "0" },
});
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  const executablePath = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000);
  const page = await context.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(url + "/config.html");
  const save = async () => {
    await page.locator("#save-config").click();
    await page.waitForFunction(() => document.querySelector("#save-state").textContent.includes("已保存"));
  };
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("friday-defense-config-v1")));
  await page.locator('[data-section="maps"]').click();
  await page.locator('[data-action="add-map"]').click();
  const name = page.locator('[data-path^="mapPresets."][data-path$=".name"]');
  const id = (await name.getAttribute("data-path")).split(".")[1];
  await name.fill("林间矿场");
  await page.locator("[data-terrain-toggle]").click();
  await page.locator('[data-terrain="2,2"]').click();
  await page.locator('[data-terrain-brush]').selectOption("mine");
  await page.locator('[data-mine-hp]').fill("456");
  await page.locator('[data-mine-hp]').press("Tab");
  await page.locator('[data-terrain="4,4"]').click();
  await save();
  assert.deepEqual((await stored()).mapPresets[id].mines, [{ x: 4, y: 4, maxHp: 456 }]);
  await page.reload();
  await page.locator('[data-section="maps"]').click();
  await page.locator(`[data-select="${id}"]`).click();
  assert.equal(await name.inputValue(), "林间矿场");
  assert.match(await page.locator('[data-terrain="2,2"]').getAttribute("class"), /tree/);
  mkdirSync("logs", { recursive: true });
  await page.screenshot({ path: "logs/map-presets-editor.png" });
  await page.locator('[data-action="duplicate-map"]').click();
  const copyId = (await name.getAttribute("data-path")).split(".")[1];
  await name.fill("矿场副本");
  await save();
  await page.locator('[data-section="waves"]').click();
  for (const index of [0, 1]) {
    await page.locator(`[data-select="${index}"]`).click();
    await page.locator('[data-map-preset]').selectOption(id);
    assert.match(await page.locator('#config-message').innerText(), /已套用/);
  }
  await save();
  let config = await stored();
  assert.deepEqual(config.days[0].obstacles, [{ x: 2, y: 2 }]);
  assert.deepEqual(config.days[1].mines, [{ x: 4, y: 4, maxHp: 456 }]);
  assert.deepEqual(config.days[0].waves, DEFAULT_CONFIG.days[0].waves);
  await page.screenshot({ path: "logs/map-presets-level.png" });
  await page.locator('[data-section="maps"]').click();
  await page.locator(`[data-select="${id}"]`).click();
  await page.locator("[data-terrain-toggle]").click();
  await page.locator('[data-terrain-brush]').selectOption("tree");
  await page.locator('[data-terrain="3,3"]').click();
  await save();
  assert.equal((await stored()).days[0].obstacles.length, 1, "preset edits do not change applied maps");
  // Save a level layout back into a new preset.
  await page.locator('[data-section="waves"]').click();
  await page.locator('[data-action="capture-map"]').click();
  const capturedId = (await name.getAttribute("data-path")).split(".")[1];
  await save();
  assert.deepEqual((await stored()).mapPresets[capturedId].mines, config.days[0].mines);
  // Reject a preset that covers the current level's spawn.
  const gate = config.days[0].waves[0].spawns[0];
  await page.locator('[data-action="add-map"]').click();
  const blockedId = (await name.getAttribute("data-path")).split(".")[1];
  if (await page.locator("[data-terrain-toggle]").getAttribute("aria-pressed") !== "true") await page.locator("[data-terrain-toggle]").click();
  await page.locator(`[data-terrain="${gate.x},${gate.y}"]`).click();
  await page.locator('[data-section="waves"]').click();
  await page.locator('[data-map-preset]').selectOption(blockedId);
  assert.match(await page.locator('#config-message').innerText(), /出生点/);
  await save();
  assert.deepEqual((await stored()).days[0].obstacles, config.days[0].obstacles);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-config").click();
  const download = await downloadPromise;
  await page.locator("#import-file").setInputFiles(await download.path());
  await page.waitForFunction(() => document.querySelector("#config-message").textContent.includes("导入成功"));
  await save();
  assert.equal((await stored()).mapPresets[id].name, "林间矿场");
  await page.locator('[data-section="maps"]').click();
  await page.locator(`[data-select="${copyId}"]`).click();
  await page.locator('[data-action="delete-map"]').click();
  await save();
  assert.equal((await stored()).mapPresets[copyId], undefined);
  assert.deepEqual((await stored()).days[0].mines, config.days[0].mines);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: "logs/map-presets-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS map presets browser: draw/create/copy/delete, reuse across levels, persistence, capture, import/export, independent edits, blocked spawns and mobile");
} finally {
  await browser?.close();
  server.kill();
}
