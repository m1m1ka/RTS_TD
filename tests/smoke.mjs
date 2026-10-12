import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";

const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5175",
    "--strictPort",
  ],
  { stdio: "ignore", windowsHide: true },
);
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5175")).ok) break;
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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5175");
  await page.waitForFunction(() => window.__game?.snapshot().frames > 5);
  const state = () => page.evaluate(() => window.__game.snapshot());
  const weaponChecks = await page.evaluate(async () => {
    const { WeaponRig } = await import("/src/weapon-rig.js");
    const { CombatVFX } = await import("/src/combat-vfx.js");
    const THREE = await import("/node_modules/three/build/three.module.js");
    const scene = new THREE.Scene(),
      parent = new THREE.Group();
    parent.position.set(2, -1, 0);
    scene.add(parent);
    let aimCorrect = true,
      pausedStable = true,
      originCorrect = true,
      recoilWorks = true;
    for (const id of ["bow", "staff", "coffeeCannon"]) {
      const rig = new WeaponRig(id, parent);
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4,
          target = new THREE.Vector3(
            2 + Math.cos(angle) * 3,
            -1.08 + Math.sin(angle) * 3,
            0,
          );
        rig.aimAt(target, true);
        const muzzle = rig.muzzleWorld(),
          dx = muzzle.x - 2,
          dy = muzzle.y + 1.08;
        aimCorrect &&=
          Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle)) < 0.00001 &&
          dx * Math.cos(angle) + dy * Math.sin(angle) > 0;
      }
      const muzzle = rig.muzzleWorld(),
        before = rig.snapshot();
      rig.update(0, null, 0, new THREE.Vector3());
      pausedStable &&= rig.angle === before.angle;
      const vfx = new CombatVFX(scene, (u) => new THREE.Vector3(u.x, u.y, 0));
      vfx.attack({
        id: 1,
        kind: rig.spec.kind,
        source: { x: 2, y: -1 },
        target: { x: 5, y: 1 },
        duration: 0.4,
        muzzle,
      });
      originCorrect &&=
        vfx.flights
          .get(1)
          .from.distanceTo(new THREE.Vector3(muzzle.x, muzzle.y, 3.2)) <
        0.00001;
      rig.fire();
      recoilWorks &&= rig.recoil > 0;
      const recoil = rig.recoil;
      rig.update(0, null, 0, new THREE.Vector3());
      pausedStable &&= rig.recoil === recoil;
      rig.update(0.3, null, 0, new THREE.Vector3());
      recoilWorks &&= rig.recoil === 0;
      rig.dispose();
      vfx.reset();
    }
    return {
      aimCorrect,
      pausedStable,
      originCorrect,
      recoilWorks,
      bodyFixed: parent.rotation.z === 0,
      clean: parent.children.length === 0,
    };
  });
  for (const [key, value] of Object.entries(weaponChecks))
    assert.equal(value, true, "independent weapon: " + key);
  const feedbackChecks = await page.evaluate(async () => {
    const { HealthBar } = await import("/src/health-bar.js");
    const { CombatVFX } = await import("/src/combat-vfx.js");
    const THREE = await import("/node_modules/three/build/three.module.js");
    const parent = new THREE.Group();
    const enemy = new HealthBar(
      parent,
      { hp: 100, maxHp: 100, side: "enemy" },
      0.91,
    );
    const hero = new HealthBar(
      parent,
      { hp: 100, maxHp: 100, side: "hero" },
      0.91,
    );
    const hiddenAtSpawn = !enemy.snapshot().visible,
      heroVisible = hero.snapshot().visible;
    enemy.hit();
    enemy.update(60, 100, 0.05);
    const damaged = enemy.snapshot();
    enemy.update(60, 100, 0);
    const pauseStable =
      JSON.stringify(damaged) === JSON.stringify(enemy.snapshot());
    for (let i = 0; i < 20; i++) enemy.update(60, 100, 0.05);
    const settled = enemy.snapshot();
    for (let i = 0; i < 32; i++) enemy.update(60, 100, 0.05);
    const hiddenAgain = !enemy.snapshot().visible;
    enemy.hit();
    enemy.update(40, 100, 0.025);
    const refreshed = enemy.snapshot().visible;
    hero.update(60, 100, 20);
    const stillVisible = hero.snapshot().visible;
    enemy.dispose();
    hero.dispose();
    const scene = new THREE.Scene(),
      vfx = new CombatVFX(scene, (u) => new THREE.Vector3(u.x - 7, 5 - u.y, 1));
    const victim = { side: "enemy", x: 8, y: 4, type: "grunt" },
      attacker = { x: 7, y: 5 };
    vfx.hit(victim, attacker);
    vfx.death(victim, attacker);
    const bloody = vfx.snapshot(),
      stain = vfx.stains.get("8,4").mesh.position.clone();
    vfx.update(30);
    const persists =
      vfx.snapshot().bloodStains === 1 && vfx.snapshot().effects === 0;
    vfx.reset();
    for (const card of ["fireball", "lightning", "frost"])
      vfx.castCard(card, 7, 5, card === "lightning" ? 0 : 2);
    vfx.update(1);
    if (scene.children.length)
      throw new Error("card VFX must release all meshes");
    vfx.castCard("lightning", 7, 5, 0);
    vfx.reset();
    const upgrading = { id: 99, x: 7, y: 5 };
    vfx.upgrade(upgrading);
    vfx.update(0.2);
    const upgrade = vfx.effects[0];
    const upgradeScale = upgrade.mesh.scale.y;
    const upgradeAge = upgrade.age;
    vfx.update(0);
    const upgradePaused = upgrade.age === upgradeAge && upgrade.mesh.scale.y === upgradeScale;
    upgrading.x = 8;
    vfx.update(0.1);
    const upgradeFollows = upgrade.mesh.position.x === 1 && upgrade.mesh.scale.y > upgradeScale;
    vfx.upgrade(upgrading);
    const upgradeMerged = vfx.effects.length === 1 && upgrade.age === 0;
    vfx.update(0.8);
    const upgradeFades = upgrade.mesh.material.opacity < 0.3;
    vfx.update(0.2);
    const upgradeExpired = scene.children.length === 0;
    vfx.upgrade(upgrading);
    vfx.reset();
    const clean = scene.children.length === 0;
    return {
      upgradePaused,
      upgradeFollows,
      upgradeMerged,
      upgradeFades,
      upgradeExpired,
      hiddenAtSpawn,
      heroVisible,
      damaged,
      pauseStable,
      settled,
      hiddenAgain,
      refreshed,
      stillVisible,
      bloody,
      stain: { x: stain.x, y: stain.y },
      persists,
      clean,
    };
  });
  for (const key of [
    "hiddenAtSpawn",
    "heroVisible",
    "pauseStable",
    "hiddenAgain",
    "refreshed",
    "stillVisible",
    "persists",
    "clean",
    "upgradePaused",
    "upgradeFollows",
    "upgradeMerged",
    "upgradeFades",
    "upgradeExpired",
  ])
    assert.equal(feedbackChecks[key], true, key);
  assert.ok(
    feedbackChecks.damaged.visible &&
      feedbackChecks.damaged.trail > feedbackChecks.damaged.fill &&
      feedbackChecks.damaged.fill > 0.6,
    "damage animates both fill and delayed loss",
  );
  assert.ok(
    Math.abs(feedbackChecks.settled.fill - 0.6) < 0.001 &&
      feedbackChecks.settled.trail < feedbackChecks.damaged.trail,
  );
  assert.ok(feedbackChecks.bloody.activeKinds.includes("bloodJet"));
  assert.ok(
    feedbackChecks.bloody.lastDeathSpray.dx > 0 &&
      feedbackChecks.bloody.lastDeathSpray.dy > 0,
    "death spray points away from attacker",
  );
  assert.deepEqual(
    feedbackChecks.stain,
    { x: 1, y: 1 },
    "blood decal stays on the victim grid cell",
  );

  mkdirSync("logs", { recursive: true });
  const screen = (x, y) =>
    page.evaluate(([x, y]) => window.__game.cellToScreen(x, y), [x, y]);
  const drop = async (key, x, y) => {
    const card = page.locator('[data-card="' + key + '"]');
    await card.scrollIntoViewIfNeeded();
    const b = await card.boundingBox(),
      p = await screen(x, y);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(p.x, p.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  };
  assert.equal((await state()).heroes.length, 0);
  assert.equal(await page.locator(".wave-crest,#phase,#enemy-count,#enemy-avatar").count(), 0);
  assert.ok((await page.locator("#wave-progress").boundingBox()).y < 15);
  assert.equal(await page.locator(".wave-node svg").count(), 2);
  assert.equal(await page.locator(".wave-node").first().evaluate(el => el.style.left), "0%");
  assert.equal(await page.locator(".wave-finish").evaluate(el => el.style.left), "100%");
  assert.equal(await page.locator(".wave-finish.done").count(), 0);
  assert.equal(await page.locator("#wave-progress").getAttribute("aria-valuenow"), "0.00");
  assert.equal(
    await page.locator("#upgrade,#heal,#build,#hero-list,.bottom-hud").count(),
    0,
  );
  await page.screenshot({ path: "logs/cards-desktop.png" });
  await drop("hero_blue", 7, 5);
  assert.equal((await state()).cards.hero_blue, 1, "invalid drop retains card");
  await drop("hero_blue", 7, 3);
  assert.equal((await state()).heroes.length, 1);
  assert.equal((await state()).cards.hero_blue, undefined);
  await drop("hero_green", 5, 5);
  await drop("hero_purple", 9, 5);
  await drop("training", 7, 3);
  assert.ok((await state()).combat.activeKinds.includes("upgrade"), "training plays golden upgrade VFX");
  await page.screenshot({ path: "logs/upgrade-effect.png" });
  assert.equal((await state()).heroes[0].level, 2);
  assert.equal((await state()).cards.training, 1);
  const deployed = await state();
  assert.equal(
    deployed.healthBars.find((h) => h.id === deployed.heroes[0].id).level,
    2,
  );
  await drop("quiver", 5, 5);
  assert.equal((await state()).heroes[1].range, 5);
  assert.ok((await state()).heroes[1].equipment.includes("quiver"));
  await drop("guard", 7, 3);
  await drop("tower", 6, 4);
  assert.equal((await state()).towers.length, 1);
  assert.equal((await state()).inspectedUnitId, null, "deployment does not select heroes");
  assert.equal(await page.locator("#unit-inspector").isVisible(), false);
  const clickUnit = async (x, y) => {
    const p = await screen(x, y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(100);
  };
  await clickUnit(7, 3);
  let inspected = (await state()).heroes[0];
  assert.equal((await state()).inspectedUnitId, inspected.id);
  assert.equal(await page.locator("#unit-name").textContent(), inspected.name);
  assert.equal(await page.locator("#unit-rate").textContent(), inspected.rate.toFixed(1));
  assert.equal(await page.locator("#unit-hp").textContent(), `${Math.ceil(inspected.hp)} / ${Math.round(inspected.maxHp)}`);
  assert.equal(await page.locator("#unit-speed").count(), 0);
  assert.ok((await state()).movableCells.length > 0);
  assert.ok(!(await state()).movableCells.includes("6,4"), "tower blocks reachable grid");
  await page.screenshot({ path: "logs/unit-inspector.png" });
  await clickUnit(7, 3);
  assert.equal((await state()).inspectedUnitId, null, "repeat click deselects");
  assert.deepEqual((await state()).movableCells, []);
  await clickUnit(7, 3);
  await clickUnit(7, 5);
  assert.equal((await state()).inspectedUnitId, inspected.id, "invalid route retains selection");
  await clickUnit(7, 4);
  assert.equal((await state()).inspectedUnitId, null, "valid move deselects");
  assert.equal(await page.locator("#unit-inspector").isVisible(), false);
  await page.waitForTimeout(350);
  assert.equal((await state()).heroes[0].y, 4, "unit completes route after deselection");
  await clickUnit(7, 4);
  await clickUnit(7, 3);
  await page.waitForTimeout(350);
  await clickUnit(6, 4);
  assert.equal((await state()).inspectedUnitId, (await state()).towers[0].id);
  assert.deepEqual((await state()).movableCells, []);
  await clickUnit(6, 4);
  await drop("coffee", 7, 3);
  assert.equal((await state()).cards.coffee, 2, "full HP rejects healing");
  const zoom = (await state()).camera.zoom,
    anchor = await screen(6, 4);
  await page.mouse.move(anchor.x, anchor.y);
  await page.mouse.wheel(0, -150);
  await page.waitForTimeout(150);
  assert.ok((await state()).camera.zoom > zoom);
  await page.keyboard.press("Home");
  await page.locator("#start").click();
  assert.equal((await state()).phase, "waiting");
  assert.equal(await page.locator("#start").isVisible(), false, "start control disappears once the day begins");
  const afterStart = (await state()).heroes[0];
  assert.ok((await state()).combat.counts.upgrades >= 3, "battle-start upgrades also play VFX");
  assert.equal(afterStart.level, 4, "start and nearest-hero echo both level up the vanguard");
  assert.ok(afterStart.dayEffects.some(e => e.stat === "speed"));
  await drop("training", 7, 3);
  assert.equal((await state()).heroes[0].level, afterStart.level + 1, "cards remain usable while waiting for a wave");
  await page.evaluate(() => window.__game.advance(5));
  const enemy = (await state()).enemies[0];
  await drop("lightning", enemy.x, enemy.y);
  assert.equal(
    (await state()).cards.lightning,
    undefined,
    "battle card consumed",
  );
  assert.ok((await state()).combat.counts.cardCasts > 0);
  assert.ok(Number(await page.locator("#wave-progress").getAttribute("aria-valuenow")) > 0, "kills advance the wave progress bar");
  await page.locator("#pause").click();
  const before = await state();
  await page.waitForTimeout(250);
  assert.deepEqual((await state()).enemies, before.enemies);
  const inspectedEnemy = before.enemies[0];
  if (inspectedEnemy) {
    await clickUnit(inspectedEnemy.x, inspectedEnemy.y);
    assert.equal((await state()).inspectedUnitId, inspectedEnemy.id);
    assert.equal(await page.locator("#unit-name").textContent(), inspectedEnemy.name);
    assert.deepEqual((await state()).movableCells, []);
    await clickUnit(inspectedEnemy.x, inspectedEnemy.y);
    assert.equal((await state()).inspectedUnitId, null);
  }
  await page.locator("#pause").click();
  await page.screenshot({ path: "logs/cards-battle.png" });
  await page.evaluate(() => window.__game.advance(90));
  assert.equal((await state()).phase, "reward");
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#reward-dialog").isVisible(), true);
  assert.equal(await page.locator(".wave-node.done").count(), 2);
  assert.equal(await page.locator(".wave-finish.done").count(), 1, "day clear turns the finish flag green");
  assert.equal(await page.locator("#wave-progress").getAttribute("aria-valuenow"), "2.00");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#reward-dialog").isVisible(), true);
  await page.screenshot({ path: "logs/cards-rewards.png" });
  const training = (await state()).cards.training || 0;
  await page.locator('[data-reward="0"]').click();
  assert.equal((await state()).phase, "between");
  assert.equal((await state()).cards.training, training + 2);
  assert.equal((await state()).day, 2);
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#start").isVisible(), true, "next day can still be started");
  assert.equal(await page.locator(".wave-finish.done").count(), 0, "next day resets the finish flag");
  assert.equal((await state()).wave, 1);
  await page.locator("#restart").click();
  await page.locator("#confirm-restart").click();
  assert.equal((await state()).heroes.length, 0);
  assert.equal((await state()).cards.training, 2);
  await drop("hero_catgirl", 7, 3);
  assert.equal((await state()).heroes[0].useIcon, "catgirl");
  await clickUnit(7, 3);
  assert.equal(await page.locator("#unit-name").textContent(), "米娅");
  await page.screenshot({ path: "logs/catgirl-battlefield.png" });
  await clickUnit(7, 4);
  await page.waitForTimeout(350);
  assert.equal((await state()).heroes[0].y, 4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForFunction(() => window.__game?.snapshot().frames > 5);
  await page.locator('[data-card="hero_blue"]').click();
  let p = await screen(7, 3);
  await page.mouse.click(p.x, p.y);
  assert.equal((await state()).heroes.length, 1, "tap card then tap cell");
  // Actual touch pointer sequence must work without panning the camera.
  const client = await page.context().newCDPSession(page);
  const card = page.locator('[data-card="hero_green"]');
  await card.scrollIntoViewIfNeeded();
  const b = await card.boundingBox();
  p = await screen(5, 5);
  const camera = (await state()).camera;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  for (let i = 1; i <= 8; i++)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: b.x + b.width / 2 + ((p.x - b.x - b.width / 2) * i) / 8,
          y: b.y + b.height / 2 + ((p.y - b.y - b.height / 2) * i) / 8,
        },
      ],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(150);
  assert.equal((await state()).heroes.length, 2, "touch drag deploys hero");
  assert.deepEqual(
    (await state()).camera,
    camera,
    "card drag does not pan battlefield",
  );
  assert.equal(await page.locator("[data-filter]").count(), 0);
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  );
  await page.screenshot({ path: "logs/cards-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: weapons, health bars, blood, card drag/tap/touch, inventory, equipment, battle casts, rewards, zoom, pause, restart, responsive HUD",
  );
} finally {
  await browser?.close();
  server.kill();
}
