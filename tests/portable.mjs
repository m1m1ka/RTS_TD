import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const profile = await mkdtemp(path.join(tmpdir(), "cardheroes-portable-"));
const child = spawn(process.argv[2], ["--remote-debugging-port=5195", "--user-data-dir=" + profile, "--enable-unsafe-swiftshader"], { env, windowsHide: true, stdio: "ignore" });
let browser;
try {
  let endpoint;
  for (let i = 0; i < 120; i++) {
    try {
      const result = await fetch("http://127.0.0.1:5195/json/version");
      endpoint = (await result.json()).webSocketDebuggerUrl;
      if (endpoint) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(endpoint, "portable executable starts independently");
  browser = await chromium.connectOverCDP(endpoint);
  const page = browser.contexts()[0].pages()[0];
  await page.locator("#new-game").waitFor({ state: "visible" });
  assert.equal(await page.title(), "卡片勇者");
  assert.equal(await page.locator("#sound").getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(async () => (await fetch("/config/game.json")).status), 200);
  const exited = new Promise(resolve => child.once("exit", resolve));
  await page.locator("#exit-game").click();
  await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error("Exit timed out")), 10000))]);
  console.log("PASS portable EXE: standalone extraction/start, title, audio default, bundled config and exit");
} finally {
  await browser?.close().catch(() => {});
  child.kill();
}
