import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5176",
    "--strictPort",
  ],
  { stdio: "ignore", windowsHide: true },
);
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5176")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const chrome =
    process.env.CHROME_PATH ||
    [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ].find(existsSync);
  browser = await chromium.launch({
    ...(chrome ? { executablePath: chrome } : {}),
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
      viewport: { width: 1500, height: 1000 },
    }),
    game = await context.newPage(),
    editor = await context.newPage(),
    errors = [];
  for (const p of [game, editor])
    p.on("pageerror", (e) => errors.push(e.message));
  await game.goto("http://127.0.0.1:5176");
  await game.waitForFunction(() => window.__game?.snapshot().frames > 5);
  await editor.goto("http://127.0.0.1:5176/config.html");
  await editor.locator('[data-select="hero_catgirl"]').click();
  for (const property of ["icon", "useIcon"]) {
    const select = editor.locator(`[data-icon-select="cards.hero_catgirl.${property}"]`);
    assert.equal(await select.inputValue(), "catgirl");
    assert.equal(await select.locator('option[value="catgirl"]').textContent(), "猫女 · 米娅");
  }
  await editor.waitForFunction(() => [...document.querySelectorAll('.icon-editor img')].every(img => img.complete && img.naturalWidth > 0));
  mkdirSync("logs", { recursive: true });
  await editor.screenshot({ path: "logs/config-catgirl.png" });
  await editor.locator('[data-select="hero_blue"]').click();
  await editor.locator('[data-path="cards.hero_blue.name"]').fill("迁移先锋");
  await editor.locator('[data-path="cards.hero_blue.unit.maxHp"]').fill("777");
  await editor.locator('[data-path="cards.hero_blue.unit.speed"]').fill("2");
  // Upload embedded art through the actual file input.
  const png = await editor.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#98bc78";
    g.fillRect(8, 8, 48, 48);
    return c.toDataURL().split(",")[1];
  });
  await editor
    .locator('[data-upload="cards.hero_blue.icon"]')
    .setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await editor.waitForFunction(() =>
    document
      .querySelector("#config-message")
      .textContent.includes("图片已嵌入"),
  );
  await editor
    .locator('[data-icon-select="cards.hero_blue.useIcon"]')
    .selectOption("green");
  await editor.locator("#save-config").click();
  await game.waitForFunction(() =>
    document
      .querySelector('[data-card="hero_blue"]')
      .textContent.includes("迁移先锋"),
  );
  await game.locator('[data-card="hero_blue"]').click();
  await game.evaluate(() => window.__game.clickCell(7, 3));
  assert.equal(
    (await game.evaluate(() => window.__game.snapshot())).heroes[0].maxHp,
    777,
  );
  await editor.locator('[data-path="cards.hero_blue.unit.maxHp"]').fill("999");
  await editor.locator('[data-path="cards.hero_blue.unit.levelGrowth.maxHp"]').fill("80");
  await editor.locator('[data-path="cards.hero_blue.unit.levelGrowth.atk"]').fill("7.5");
  assert.ok((await editor.locator('[data-growth-preview="cards.hero_blue.unit"]').textContent()).includes("1319"), "level 5 preview updates while typing");
  await editor.locator(".level-growth").screenshot({ path: "logs/config-level-growth.png" });
  await editor.locator("#save-config").click();
  await game.waitForFunction(
    () => window.__game.snapshot().heroes[0].maxHp === 999,
  );
  assert.equal(
    (await game.evaluate(() => window.__game.snapshot())).heroes[0].hp,
    999,
  );
  // Add composable passives via the editor controls, then verify actual gameplay.
  await editor.locator("#new-effect").selectOption("lifesteal");
  await editor.locator('[data-action="add-effect"]').click();
  await editor
    .locator('[data-path="cards.hero_blue.effects.0.value"]')
    .fill("0.3");
  await editor.locator("#save-config").click();
  await game.waitForFunction(
    () => window.__game.snapshot().heroes[0].lifeSteal === 0.3,
  );
  // Compose a new start payload with the actual event/target/effect controls.
  await editor.locator('[data-path="cards.hero_blue.triggerRules.0.effects.0.value"]').fill("2");
  await editor.locator('[data-trigger-effect-choice="cards.hero_blue.triggerRules.0"]').selectOption("stat");
  await editor.locator('[data-action="add-trigger-effect"][data-index="0"]').click();
  await editor.locator('[data-path="cards.hero_blue.triggerRules.0.effects.1.value"]').fill("0.4");
  await editor.locator('[data-path="cards.hero_blue.triggerRules.1.trigger.scope"]').selectOption("self");
  await editor.locator('[data-path="cards.hero_blue.triggerRules.1.trigger.radius"]').fill("3");
  await editor.locator('[data-trigger-template="echo"]').click();
  await editor.locator('[data-path="cards.hero_blue.triggerRules.2.target.radius"]').fill("4");
  await editor.locator('[data-path="cards.hero_blue.triggerRules.2.target.count"]').fill("2");
  await editor.locator('[data-action="remove-trigger"][data-index="2"]').click();
  await editor.locator("#save-config").click();
  assert.equal((await game.evaluate(() => window.__game.snapshot())).heroes[0].level, 1, "saving a trigger does not fire it");
  mkdirSync("logs", { recursive: true });
  await editor.locator('.editor-panel').filter({ has: editor.getByRole("heading", { name: "触发机制", exact: true }) }).screenshot({ path: "logs/config-triggers.png" });
  await editor.evaluate(() => window.scrollTo(0, 0));
  await editor.screenshot({ path: "logs/config-cards.png", fullPage: true });
  await editor.locator('[data-section="initial"]').click();
  await editor.locator('[data-path="initial.cards.hero_blue"]').fill("3");
  await editor.locator('[data-path="initial.baseHp"]').fill("1500");
  await editor.locator('[data-path="initial.firstWaveDelay"]').fill("0.5");
  await editor.locator("#save-restart").click();
  await game.waitForFunction(
    () =>
      window.__game.snapshot().heroes.length === 0 &&
      window.__game.snapshot().cards.hero_blue === 3,
  );
  assert.equal(
    (await game.evaluate(() => window.__game.snapshot())).baseMaxHp,
    1500,
  );
  await editor.locator('[data-section="enemies"]').click();
  await editor.locator('[data-path="enemies.grunt.maxHp"]').fill("333");
  await editor.locator('[data-path="enemies.grunt.levelGrowth.maxHp"]').fill("20");
  await editor.locator('[data-path="enemies.grunt.levelGrowth.atk"]').fill("3");
  await editor.locator("#save-config").click();
  await editor.locator('[data-section="waves"]').click();
  const dragTerrain = async (from, to, button = "left") => {
    const start = editor.locator(`[data-terrain="${from}"]`);
    await start.scrollIntoViewIfNeeded();
    const a = await start.boundingBox(), b = await editor.locator(`[data-terrain="${to}"]`).boundingBox();
    await editor.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await editor.mouse.down({ button });
    await editor.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 1 });
    await editor.mouse.up({ button });
  };
  await editor.locator('[data-terrain="1,1"]').click();
  assert.equal(await editor.locator(".terrain-grid .tree").count(), 0, "painting must be explicitly enabled");
  await editor.locator("[data-terrain-toggle]").click();
  await dragTerrain("1,1", "4,1");
  assert.equal(await editor.locator(".terrain-grid .tree").count(), 4, "fast left drag fills crossed cells");
  await dragTerrain("2,1", "3,1", "right");
  assert.equal(await editor.locator(".terrain-grid .tree").count(), 2, "right drag continuously erases");
  await editor.locator('[data-terrain="7,5"]').click({ force: true });
  await editor.locator('[data-terrain="7,0"]').click({ force: true });
  assert.equal(await editor.locator(".terrain-grid .tree").count(), 2, "core and spawn cells are protected");
  await editor.locator('[data-terrain="5,1"]').hover();
  assert.equal(await editor.locator(".terrain-grid .tree").count(), 2, "pointer release stops painting");
  assert.equal(await editor.locator('[data-spawn="1,1"]').isDisabled(), true);
  await editor.locator('[data-select="1"]').click();
  assert.equal(await editor.locator(".terrain-grid .tree").count(), 0, "other days have independent maps");
  await dragTerrain("2,2", "2,2");
  await editor.locator('[data-select="0"]').click();
  assert.equal(await editor.locator(".terrain-grid .tree").count(), 2);
  await editor.locator("[data-terrain-toggle]").click();
  await editor.locator("#save-config").click();
  await game.waitForFunction(() => window.__game.snapshot().obstacles.length === 2);
  await editor.locator(".terrain-grid").screenshot({ path: "logs/config-terrain.png" });
  await game.screenshot({ path: "logs/terrain-battlefield.png" });
  await editor.locator('[data-path="days.0.waves.0.spawns.0.enemies.0.count"]').fill("2");
  await editor.locator('[data-path="days.0.waves.0.spawns.0.enemies.0.type"]').selectOption("grunt");
  await editor.locator('[data-path="days.0.waves.0.spawns.0.enemies.0.level"]').fill("4");
  for (const coord of ["14,5", "7,10", "0,5"])
    await editor.locator('[data-spawn="' + coord + '"]').click();
  await editor.locator('[data-wave-select="1"]').click();
  await editor.locator('[data-path="days.0.waves.1.startDelay"]').fill("4");
  await editor.locator('[data-path="days.0.waves.1.spawns.0.delay"]').fill("2");
  await editor.locator('[data-path="days.0.waves.1.spawns.0.enemies.0.type"]').selectOption("runner");
  await editor.locator('[data-wave-select="0"]').click();
  await editor.locator('[data-action="add-spawn-enemy"][data-point="0"]').click();
  await editor.locator('[data-path="days.0.waves.0.spawns.0.enemies.1.type"]').selectOption("tank");
  await editor.locator('[data-path="days.0.waves.0.spawns.0.enemies.1.count"]').fill("3");
  assert.ok((await editor.locator('[data-wave-select="0"] small').textContent()).includes("5"));
  await editor.locator('[data-action="remove-spawn-enemy"][data-point="0"][data-index="1"]').click();
  await editor.locator('[data-action="duplicate-wave"]').click();
  assert.equal(await editor.locator("[data-wave-select]").count(), 3);
  await editor.locator('[data-action="wave-up"]').click();
  editor.once("dialog", d => d.accept());
  await editor.locator('[data-action="delete-wave"]').click();
  assert.equal(await editor.locator("[data-wave-select]").count(), 2);
  await editor.locator('[data-action="duplicate-day"]').click();
  assert.equal(await editor.locator("[data-select]").count(), 7);
  editor.once("dialog", d => d.accept());
  await editor.locator('[data-action="delete-day"]').click();
  await editor.locator('[data-select="0"]').click();
  assert.equal(await editor.locator("[data-select]").count(), 6);
  await editor.locator("#save-config").click();
  await editor.evaluate(() => window.scrollTo(0, 0));
  await editor.screenshot({ path: "logs/config-waves.png", fullPage: true });
  await game.locator('[data-card="hero_blue"]').click();
  await game.evaluate(() => window.__game.clickCell(5, 5));
  await game.locator("#start").click();
  const started = (await game.evaluate(() => window.__game.snapshot())).heroes[0];
  assert.equal(started.level, 3, "edited level payload fires when clicking start");
  assert.equal(started.maxHp, 1159, "battle-start levels use per-hero growth");
  assert.equal(started.atk, 51);
  assert.ok(Math.abs(started.rate - 1.8) < 1e-8, "only explicit daily buffs increase attack speed, leveling does not");
  assert.equal(started.speed, 2.5, "self-scoped activation listener fires once");
  await game.evaluate(() => window.__game.advance(0.55));
  const enemy = (await game.evaluate(() => window.__game.snapshot()))
    .enemies[0];
  assert.equal(enemy.maxHp, 393);
  assert.equal(enemy.level, 4);
  assert.equal(enemy.x, 7);
  // Export and import in a clean browser context (no shared local storage).
  const downloadEvent = editor.waitForEvent("download");
  await editor.locator("#export-config").click();
  const download = await downloadEvent,
    file = await download.path(),
    exported = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(exported.version, 2);
  assert.deepEqual(exported.days[0].obstacles, [{ x: 1, y: 1 }, { x: 4, y: 1 }]);
  assert.deepEqual(exported.days[1].obstacles, [{ x: 2, y: 2 }]);
  assert.equal(exported.cards.hero_blue.unit.levelGrowth.atk, 7.5);
  assert.equal(exported.enemies.grunt.levelGrowth.maxHp, 20);
  assert.equal(exported.days[0].waves[0].spawns[0].enemies[0].level, 4);
  assert.equal(exported.cards.hero_blue.triggerRules[0].effects[1].value, 0.4);
  assert.equal(exported.days[0].waves[1].startDelay, 4);
  assert.equal(exported.days[0].waves[1].spawns[0].delay, 2);
  assert.ok(exported.cards.hero_blue.icon.startsWith("data:image/png;base64,"));
  const second = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    }),
    migrated = await second.newPage();
  migrated.on("pageerror", (e) => errors.push(e.message));
  await migrated.goto("http://127.0.0.1:5176/config.html");
  await migrated.locator("#import-file").setInputFiles(file);
  await migrated.waitForFunction(() =>
    document.querySelector("#config-message").textContent.includes("导入成功"),
  );
  await migrated.locator("#save-config").click();
  assert.equal(await migrated.locator('[data-path="cards.hero_blue.unit.levelGrowth.atk"]').inputValue(), "7.5", "growth formulas migrate across devices");
  const migratedGame = await second.newPage();
  await migratedGame.goto("http://127.0.0.1:5176");
  await migratedGame.waitForFunction(
    () => window.__game?.snapshot().cards.hero_blue === 3,
  );
  assert.equal((await migratedGame.evaluate(() => window.__game.snapshot())).cards.hero_catgirl, 1);
  assert.deepEqual((await migratedGame.evaluate(() => window.__game.snapshot())).obstacles, exported.days[0].obstacles, "maps migrate across devices");
  assert.ok(await migratedGame.locator('[data-card="hero_catgirl"] img').evaluate(img => img.complete && img.naturalWidth > 0));
  assert.equal(
    (await migratedGame.evaluate(() => window.__game.snapshot())).baseMaxHp,
    1500,
  );
  assert.equal(await migrated.locator('[data-path="cards.hero_blue.triggerRules.0.effects.1.value"]').inputValue(), "0.4", "trigger rules migrate across devices");
  assert.ok(
    await migratedGame
      .locator('[data-card="hero_blue"] img')
      .getAttribute("src")
      .then((s) => s.startsWith("data:image/png")),
  );
  await migratedGame.reload();
  await migratedGame.waitForFunction(
    () => window.__game?.snapshot().baseMaxHp === 1500,
  );
  // Invalid saves and invalid imports leave the stored configuration intact.
  await migrated.locator('[data-path="cards.hero_blue.unit.maxHp"]').fill("0");
  await migrated.locator("#save-config").click();
  assert.ok(
    (await migrated.locator("#config-message").textContent()).includes(
      "必须为",
    ),
  );
  await migrated
    .locator("#import-file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":99}'),
    });
  await migrated.waitForFunction(() =>
    document.querySelector("#config-message").textContent.includes("导入失败"),
  );
  assert.equal(
    await migrated.evaluate(
      () =>
        JSON.parse(localStorage.getItem("friday-defense-config-v1")).cards
          .hero_blue.unit.maxHp,
    ),
    999,
  );
  await editor.setViewportSize({ width: 390, height: 844 });
  await editor.evaluate(() => window.scrollTo(0, 0));
  await editor.screenshot({ path: "logs/config-mobile.png", fullPage: true });
  assert.ok(
    await editor.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS config browser: UI edits, upload, composable effects, live tabs, restart, spawning, migration with images, reload, invalid rejection, mobile layout",
  );
} finally {
  await browser?.close();
  server.kill();
}
