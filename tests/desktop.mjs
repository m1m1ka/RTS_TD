import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const userData = await mkdtemp(path.join(tmpdir(), "cardheroes-test-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  env,
  executablePath: process.env.DESKTOP_DEV ? path.resolve("node_modules/electron/dist/electron.exe") : path.resolve(process.env.DESKTOP_EXE || "release/final/win-unpacked/卡片勇者.exe"),
  args: [...(process.env.DESKTOP_DEV ? ["."] : []), "--user-data-dir=" + userData, "--enable-unsafe-swiftshader"],
});
try {
  const page = await app.firstWindow(), errors = [];
  page.on("pageerror", e => { errors.push(e.message); console.error(e.message); });
  page.on("console", e => { if (e.type() === "error") console.error(e.text()); });
  await page.locator("#new-game").waitFor({ state: "visible" });
  assert.equal(await page.title(), "卡片勇者");
  assert.ok(await page.locator("#new-game").isVisible());
  assert.equal((await page.locator("#sound").getAttribute("aria-pressed")) === "true", true);
  await page.locator("#new-game").click();
  await page.locator('[data-reward="0"]').click();
  await page.locator('[data-reward="1"]').click();
  await page.locator("[data-reward-confirm]").click();
  await page.locator("#reward-dialog").waitFor({ state: "hidden" });
  assert.deepEqual(await page.locator(".system-controls > *").evaluateAll(nodes => nodes.map(n => n.id)), ["sound", "fullscreen"]);
  await page.locator("#sound").click();
  assert.equal((await page.locator("#sound").getAttribute("aria-pressed")) === "true", false);
  await page.locator("#sound").click();
  assert.equal((await page.locator("#sound").getAttribute("aria-pressed")) === "true", true);
  await page.locator("#fullscreen").click();
  await page.waitForFunction(() => document.querySelector("#fullscreen").getAttribute("aria-pressed") === "true");
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), true);
  await page.waitForTimeout(1000);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#fullscreen").getAttribute("aria-pressed") === "false");
  await page.waitForTimeout(1000);
  await page.keyboard.press("F11");
  await page.waitForFunction(() => document.querySelector("#fullscreen").getAttribute("aria-pressed") === "true");
  await page.locator("#fullscreen").click();
  await page.waitForFunction(() => document.querySelector("#fullscreen").getAttribute("aria-pressed") === "false");
  assert.equal(await page.evaluate(async () => (await fetch("/config/game.json")).status), 200);
  await mkdir("logs", { recursive: true });
  await page.screenshot({ path: "logs/desktop-game.png" });
  assert.deepEqual(errors, []);
  await page.reload();
  await page.locator("#exit-game").click();
  console.log("PASS packaged desktop: title, config, initial draft, two controls, default audio, native fullscreen/Escape/F11, exit");
} finally {
  await app.close().catch(() => {});
}
