import { pirateIds } from "./marine-content.js";
import * as THREE from "three";
import "./style.css";
import "./cards.css";
import { unitArt, mapArt, oceanArt, shorelineArt } from "./art.js";
import { OceanMotion } from "./ocean-motion.js";
import { BoatVisuals } from "./boat-visuals.js";
import { CREW_SPRITE_SIZE, BOAT_SLOTS } from "./sea-arrivals.js";
import { GoldVisuals } from "./gold-visuals.js";
import { presetIds } from "./hero-presets.js";
import { Game, W, H, BASE, dist, inside } from "./game.js";
import { gridDistance } from "./grid-distance.js";
import { CombatVFX } from "./combat-vfx.js";
import { HealthBar } from "./health-bar.js";
import { combatNumber } from "./combat-numbers.js";
import { WeaponRig } from "./weapon-rig.js";
import { FOLLOWER_SCALE } from "./followers.js";
import { CardUI } from "./card-ui.js";
import { cards } from "./cards.js";
import { subscribeConfig, configLoadError } from "./config/store.js";
import { cardRadius } from "./config/schema.js";
import { iconURL } from "./config/icons.js";
import { getWeaponSpec } from "./weapons.js";
import { WaveProgress } from "./wave-progress.js";
import { RouteMap } from "./route-map.js";
import { heroRoles, inferHeroRole } from "./hero-grades.js";
import { ShopUI } from "./shop-ui.js";
import { SoundPlayer } from "./audio/player.js";
import { getAudioConfig, subscribeAudioConfig } from "./audio/store.js";
import { RetroRenderer, installCabinetPattern } from "./retro-renderer.js";
import "./retro-theme.css";
import "./retro-hud.css";

const audioStats = { counts: {}, last: null };
const gameAudio = new SoundPlayer(getAudioConfig(), {
  onError: message => toast(message),
  onPlayed: event => { audioStats.counts[event.key] = (audioStats.counts[event.key] || 0) + 1; audioStats.last = event; },
});
subscribeAudioConfig(config => gameAudio.setConfig(config));
document.addEventListener("pointerdown", () => gameAudio.unlock(), { capture: true });
document.addEventListener("keydown", () => gameAudio.unlock(), { capture: true });

const $ = (id) => document.getElementById(id),
  arena = $("arena");
const waveProgress = new WaveProgress($("wave-progress"));
const scene = new THREE.Scene();
scene.background = new THREE.Color("#101018");
const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
camera.position.z = 20;
const MIN_ZOOM = .8,
  MAX_ZOOM = 3.2;
let overviewY = 0;
camera.zoom = innerWidth <= 700 ? 1.65 : 1;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const retroRenderer = new RetroRenderer(renderer);
arena.prepend(renderer.domElement);
renderer.domElement.setAttribute(
  "aria-label",
  "战场：点击英雄选择，点击沙滩逐格移动",
);
renderer.domElement.tabIndex = 0;
const textures = {},
  arts = {},
  whiteTextures = {};
for (const type of [
  ...presetIds,
  ...pirateIds,
  "catgirl",
  "blue",
  "green",
  "purple",
  "base",
  "grunt",
  "runner",
  "tank",
  "boss",
  "tower",
]) {
  arts[type] = unitArt(type);
  textures[type] = new THREE.CanvasTexture(arts[type]);
  textures[type].colorSpace = THREE.SRGBColorSpace;
  const white = document.createElement("canvas");
  white.width = white.height = arts[type].width;
  const ctx = white.getContext("2d");
  ctx.drawImage(arts[type], 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#fff7dd";
  ctx.fillRect(0, 0, white.width, white.height);
  whiteTextures[type] = new THREE.CanvasTexture(white);
  whiteTextures[type].colorSpace = THREE.SRGBColorSpace;
}
const artUrls = Object.fromEntries(
  Object.entries(arts).map(([key, value]) => [key, value.toDataURL()]),
);
installCabinetPattern(arts);
const geometry = new THREE.PlaneGeometry(1, 1);
function plane(w, h, color, opacity = 1) {
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
    }),
  );
  m.scale.set(w, h, 1);
  return m;
}
function imagePlane(texture, w = 1, h = w) {
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  m.scale.set(w, h, 1);
  return m;
}
function pos(x, y, z = 1) {
  return new THREE.Vector3(x - 7, 5 - y, z);
}
const mapTexture = new THREE.CanvasTexture(mapArt());
mapTexture.colorSpace = THREE.SRGBColorSpace;
const board = imagePlane(mapTexture, 15, 11);
board.position.z = 0;
scene.add(board);
const oceanTexture = new THREE.CanvasTexture(oceanArt());
oceanTexture.colorSpace = THREE.SRGBColorSpace;
oceanTexture.wrapS = oceanTexture.wrapT = THREE.RepeatWrapping;
oceanTexture.repeat.set(90 / 12, 60 / 12);
const ocean = imagePlane(oceanTexture, 90, 60);
const oceanMotion = new OceanMotion(ocean.material);
ocean.position.z = -0.1;
scene.add(ocean);
const shoreTexture = new THREE.CanvasTexture(shorelineArt());
shoreTexture.colorSpace = THREE.SRGBColorSpace;
const shore = imagePlane(shoreTexture, 16.4, 12.4);
shore.position.z = -0.05;
scene.add(shore);
const reducedOceanMotion = matchMedia("(prefers-reduced-motion: reduce)");
const selection = plane(0.97, 0.97, "#d7efa2", 0.15);
selection.position.z = 0.12;
scene.add(selection);
const outlineTexture = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  g.strokeStyle = "#d5ed9c";
  g.lineWidth = 4;
  g.setLineDash([13, 6]);
  g.strokeRect(4, 4, 88, 88);
  return new THREE.CanvasTexture(c);
})();
const selectionOutline = imagePlane(outlineTexture, 1.02);
selectionOutline.position.z = 0.16;
scene.add(selectionOutline);
const hover = plane(0.96, 0.96, "#ddf4b6", 0.2);
hover.position.z = 0.2;
hover.visible = false;
scene.add(hover);
const rangeGroup = new THREE.Group(),
  moveGroup = new THREE.Group(),
  pathGroup = new THREE.Group();
scene.add(rangeGroup, moveGroup, pathGroup);
const unitMeshes = new Map(),
  effects = [];
let game,
  inspectedUnitId = null,
  moveKey = "",
  moveCells = new Set(),
  paused = false,
  speed = 1,
  sound = false,
  toastTimer,
  bannerTimer,
  resultTimer,
  frame = 0,
  uiTimer = 0,
  pointerCell = null,
  rangeKey = "",
  pathKey = "",
  lastTime = performance.now(),
  wallTime = 0;
let best = 0;
try {
  best = Number(localStorage.getItem("friday-defense-best") || 0);
} catch {}
const baseSprite = imagePlane(textures.base, 1.65, 1.65);
baseSprite.position.copy(pos(7, 5, 1));
scene.add(baseSprite);
const baseWhite = imagePlane(whiteTextures.base, 1.65);
baseWhite.position.copy(pos(7, 5, 1.05));
baseWhite.material.opacity = 0;
scene.add(baseWhite);
function motionState(sprite, white, size) {
  return {
    sprite,
    white,
    size,
    hitTimer: 0,
    hitDirection: new THREE.Vector2(0, 1),
    attack: 0,
    attackDuration: 0.3,
    attackDirection: new THREE.Vector2(1, 0),
  };
}
const baseMotion = motionState(baseSprite, baseWhite, 1.65);
const goldVisuals = new GoldVisuals(scene, camera, pos);
const boatVisuals = new BoatVisuals(scene, pos);
const combatVFX = new CombatVFX(scene, (unit) =>
  unit === BASE
    ? baseSprite.position.clone()
    : unitMeshes.get(unit.id)?.group.position.clone() ||
      pos(unit.x, unit.y, 1.1),
  renderer,
);
function textTexture(text, color = "#f3edc5", size = 24) {
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  const font = `900 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  g.font = font;
  c.width = Math.max(256, Math.ceil(g.measureText(text).width) + 24);
  c.height = 64;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = font;
  g.strokeStyle = "#101018";
  g.lineJoin = "round";
  g.lineWidth = 6;
  g.strokeText(text, c.width / 2, 32);
  g.fillStyle = color;
  g.fillText(text, c.width / 2, 32);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const baseGlow = plane(1.6, 1.6, "#d8d27c", 0.055);
baseGlow.position.copy(pos(7, 5, 0.1));
scene.add(baseGlow);
const gateGroup = new THREE.Group();
scene.add(gateGroup);
let gateKey = "";
function updateGates() {
  const gates = game.currentWave()?.spawns || [],
    key = JSON.stringify(gates.map(({ x, y }) => [x, y]));
  if (key === gateKey) return;
  gateKey = key;
  for (const m of [...gateGroup.children]) {
    m.material.map.dispose();
    m.material.dispose();
    m.removeFromParent();
  }
  for (const gate of gates) {
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const g = c.getContext("2d");
    g.strokeStyle = "#94513d";
    g.globalAlpha = 0.85;
    g.lineWidth = 3;
    g.setLineDash([5, 6]);
    g.strokeRect(9, 9, 78, 78);
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(30, 38);
    g.lineTo(48, 54);
    g.lineTo(66, 38);
    g.stroke();
    const m = imagePlane(new THREE.CanvasTexture(c), 0.88);
    m.position.copy(pos(gate.x, gate.y, 0.15));
    m.rotation.z = Math.atan2(7 - gate.x, 5 - gate.y);
    gateGroup.add(m);
  }
}

const fireflies = [];
const glowTexture = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d"),
    r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "#d5ff89");
  r.addColorStop(0.2, "#a7ed66aa");
  r.addColorStop(1, "#8ed85200");
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
for (let i = 0; i < 22; i++) {
  const m = imagePlane(glowTexture, 0.1 + Math.random() * 0.1);
  m.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, 2);
  scene.add(m);
  fireflies.push({
    m,
    x: m.position.x,
    y: m.position.y,
    phase: Math.random() * 10,
  });
}
function resize() {
  const w = arena.clientWidth,
    h = arena.clientHeight,
    compact = w <= 700;
  const top = compact ? 122 : h < 540 ? 70 : 100,
    bottom = compact ? 185 : h < 540 ? 155 : 195;
  const scale = Math.min(
    w / (compact ? 15.6 : 16.5),
    Math.max(100, h - top - bottom) / 11.5,
  );
  const width = w / scale,
    height = h / scale;
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  const nextOverviewY = (top - bottom) / (2 * scale);
  camera.position.y += nextOverviewY - overviewY;
  overviewY = nextOverviewY;
  constrainCamera();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  renderer.setSize(w, h, false);
  retroRenderer.resize(w, h);
}
new ResizeObserver(resize).observe(arena);
function constrainCamera() {
  const halfWidth = (camera.right - camera.left) / (2 * camera.zoom);
  const halfHeight = (camera.top - camera.bottom) / (2 * camera.zoom);
  const limitX = Math.max(0.3, 13.5 - halfWidth + 0.5);
  const limitY = Math.max(0.5, 11.5 - halfHeight + 2.3);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -limitX, limitX);
  camera.position.y = THREE.MathUtils.clamp(
    camera.position.y,
    overviewY - limitY,
    overviewY + limitY,
  );
  camera.updateMatrixWorld();
}
function worldFromScreen(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector3(
    ((clientX - r.left) / r.width) * 2 - 1,
    (-(clientY - r.top) / r.height) * 2 + 1,
    0,
  ).unproject(camera);
}
function zoomAt(clientX, clientY, nextZoom) {
  const before = worldFromScreen(clientX, clientY);
  camera.zoom = THREE.MathUtils.clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  camera.updateProjectionMatrix();
  const after = worldFromScreen(clientX, clientY);
  camera.position.x += before.x - after.x;
  camera.position.y += before.y - after.y;
  constrainCamera();
  hover.visible = false;
}
function overview() {
  camera.zoom = MIN_ZOOM;
  camera.position.set(0, overviewY, 20);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  hover.visible = false;
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2600);
}
function banner(text) {
  $("wave-banner").textContent = text;
  $("wave-banner").classList.add("visible");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(
    () => $("wave-banner").classList.remove("visible"),
    2200,
  );
}
function tone(freq = 440, duration = 0.06, type = "sine", volume = 0.025) {
  gameAudio.tone(freq, duration, type, volume);
}
function floating(unit, text, color = "#fbefc3", number = null, status = null) {
  const tex = textTexture(text, color, number?.fontSize ?? (status ? 36 : 29)),
    scale = number ? 1.4 : status ? 1.65 : 1,
    m = imagePlane(tex, 1.25 * tex.image.width / 256 * scale, 0.32 * scale);
  m.position.copy(pos(unit.x, unit.y - 0.45, 4));
  if (status) {
    const recent = effects.filter(e => e.status && e.unitId === unit.id && e.life > e.max - .25).length;
    m.position.y += .4 + Math.min(recent, 3) * .3;
  }
  const overlapping = number ? effects.filter(e => e.number && e.unitId === unit.id && e.life > e.max - .2).length : 0;
  if (overlapping) {
    m.position.x += (overlapping % 2 ? -1 : 1) * .16 * Math.ceil(overlapping / 2);
    m.position.y += Math.min(overlapping, 4) * .1;
  }
  m.renderOrder = 20;
  m.material.depthTest = false;
  scene.add(m);
  const duration = number?.duration ?? .8;
  effects.push({ m, baseScale: m.scale.clone(), life: duration, max: duration, vy: number ? .8 : .65, texture: tex, number, status, text, unitId: unit.id });
}
function floatingNumber(event) {
  const number = combatNumber(event);
  if (number) floating(event.unit, number.text, number.color, number);
}
function burst(unit, color) {
  combatVFX.burst(unit, color);
}
function shoot(attack) {
  const { source, target } = attack,
    visual = unitMeshes.get(source.id) || addVisual(source);
  syncWeapon(visual, source);
  if (visual.weapon) {
    const targetPosition =
      unitMeshes.get(target.id)?.group.position || pos(target.x, target.y, 1.1);
    visual.weapon.aimAt(targetPosition, true);
    const muzzle = visual.weapon.muzzleWorld();
    combatVFX.attack({ ...attack, muzzle });
    visual.weapon.fire();
  } else combatVFX.attack(attack);
  visual.attackDuration = Math.max(0.25, attack.duration);
  visual.attack = visual.attackDuration;
  visual.attackDirection
    .set(target.x - source.x, source.y - target.y)
    .normalize();
  visual.recoil = !!getWeaponSpec(source);
}
function applyMotion(v, dt, id = 0) {
  v.hitTimer = Math.max(0, v.hitTimer - dt);
  v.attack = Math.max(0, v.attack - dt);
  const hit = v.hitTimer > 0 ? 1 - v.hitTimer / 0.32 : 1;
  const shake =
    Math.sin(hit * Math.PI * 4) * Math.exp(-hit * 4) * (v.hitTimer > 0 ? 1 : 0);
  const swing =
    v.attack > 0 ? Math.sin((1 - v.attack / v.attackDuration) * Math.PI) : 0;
  const lunge = swing * (v.recoil ? -0.07 : 0.12);
  v.sprite.position.x =
    v.hitDirection.x * shake * 0.19 + v.attackDirection.x * lunge;
  v.sprite.position.y =
    v.hitDirection.y * shake * 0.19 +
    v.attackDirection.y * lunge +
    Math.sin(game.time * 2.7 + id) * 0.01;
  v.sprite.rotation.z =
    shake * 0.18 * (v.hitDirection.x >= 0 ? -1 : 1) -
    v.attackDirection.x * swing * 0.1;
  const squash = Math.max(0, shake) * 0.16;
  v.sprite.scale.set(
    v.size * (1 + squash + swing * 0.04),
    v.size * (1 - squash - swing * 0.05),
    1,
  );
  v.white.position.copy(v.sprite.position);
  v.white.position.z += 0.012;
  v.white.rotation.copy(v.sprite.rotation);
  v.white.scale.copy(v.sprite.scale);
  v.white.material.opacity =
    v.hitTimer > 0.22 ? 0.92 : Math.max(0, v.hitTimer / 0.22) * 0.25;
}
function onEvent(e) {
  const audioHandled = gameAudio.handleEvent(e);
  if (e.type === "shopPurchase" || e.type === "shopRefresh") tone(760, .12, "triangle", .03);
  if (e.type === "packOpened") tone(420, .28, "triangle", .025);
  if (e.type === "goldGranted") toast(`金币 +${e.amount}`);
  if (e.type === "heroDestroyed" || e.type === "followerRemoved") {
    inspectedUnitId = null;
    if (e.type === "heroDestroyed") burst(e.unit, "#e1c38b");
    const v = unitMeshes.get(e.unit.id);
    if (v) { v.weapon?.dispose(); v.healthBar.dispose(); scene.remove(v.group); v.group.children.forEach(m => m.material.dispose()); unitMeshes.delete(e.unit.id); }
  }
  if (e.type === "cardsGenerated") {
    const names = Object.entries(e.cards).slice(0, 3).map(([key, count]) => `${cards[key]?.name || key} ×${count}`).join(" · ");
    toast(`获得 ${names}${Object.keys(e.cards).length > 3 ? ` 等 ${e.count} 张牌` : ""}`);
  }
  if (e.type === "cardRefunded") toast(cards[e.card]?.category === "battle" ? `${cards[e.card].name} 冷却已重置` : `返还 ${cards[e.card]?.name || e.card} ×1`);
  if (e.type === "randomStatGained") {
    const label = { maxHp: "生命上限", atk: "攻击力", lifeSteal: "吸血", critChance: "暴击率", critDamage: "暴击伤害" }[e.stat];
    floating(e.unit, `${label} +${e.value}${["lifeSteal", "critChance", "critDamage"].includes(e.stat) ? "%" : ""}`, "#edcf78");
  }
  if ((e.type === "hit" || e.type === "death") && e.unit.type === "mine") {
    goldVisuals.hit(e.unit);
    if (e.type === "hit") floatingNumber(e);
    else burst(e.unit, "#ae9766");
    return;
  }
  if (e.type === "victory") { cardUI.cancel(); if (!audioHandled) tone(880, .3); }
  if (e.type === "gold") tone(700 + e.index * 90, .09, "triangle", .025);
  if (e.type === "reset") { inspectedUnitId = null; gameAudio.stop(); }
  if (e.type === "daySelected") {
    inspectedUnitId = null;
    combatVFX.reset();
  }
  if (e.type === "deploy" || e.type === "move") inspectedUnitId = null;
  if (e.type === "select") inspectedUnitId = game.selectedUnit()?.id ?? null;
  if (e.type === "toast") toast(e.text);
  if (e.type === "heroBattleStart") {
    burst(e.unit, e.extra ? "#c6b5df" : "#b6d893");
    if (e.extra) floating(e.unit, "回响", "#d6c5ed");
  }
  if (e.type === "heroPreparation" && e.extra) {
    burst(e.unit, "#b6d893");
    floating(e.unit, "整备", "#cce3aa");
  }
  if (e.type === "attack") {
    shoot(e);
    if (e.source.side === "hero" && !audioHandled)
      tone(e.kind === "orb" ? 660 : 330, 0.04, "triangle", 0.012);
  }
  if (e.type === "impact") combatVFX.land(e);
  if (["spawn", "deploy", "followerSpawn"].includes(e.type)) addVisual(e.unit);
  if (e.type === "deploy" && game.heroes.includes(e.unit)) combatVFX.dust(e.unit);
  if (e.type === "step" && game.heroes.includes(e.unit) && e.unit.hp > 0) combatVFX.dust(e.unit, true);
  if (e.type === "followerSpawn") burst(e.unit, "#b6d893");
  if (e.type === "land") burst(e.from, "#bce4d3");
  if (e.type === "revive" && e.fromEffect) {
    const v = unitMeshes.get(e.unit.id);
    if (v) { v.dying = 0; v.hitTimer = 0; v.attack = 0; v.sprite.material.opacity = 1; }
    floating(e.unit, "复活", "#eddda0");
    burst(e.unit, "#d8d9a4");
    toast(`${e.unit.name}已复活`);
  }
  if (e.type === "hit") {
    floatingNumber(e);
    const v =
      e.unit === BASE
        ? baseMotion
        : unitMeshes.get(e.unit.id) || addVisual(e.unit);
    v.hitTimer = 0.32;
    v.hitDirection
      .set(
        e.source ? e.unit.x - e.source.x : 0,
        e.source ? e.source.y - e.unit.y : 1,
      )
      .normalize();
    v.healthBar?.hit();
    combatVFX.hit(e.unit, e.source);
  }
  if (e.type === "death") {
    const v = unitMeshes.get(e.unit.id);
    if (v) {
      v.dying = 0.4;
      v.deathScale = v.size;
    }
    combatVFX.death(e.unit, e.source);
    if (e.unit.side !== "enemy") burst(e.unit, "#a5d8de");
    if (e.unit.side === "enemy") { if (!audioHandled) tone(170, 0.045, "triangle", 0.009); }
    else
      toast(
        `${e.unit.name || "咖啡炮台"}已倒下${game.heroes.includes(e.unit) ? "，下一天归队" : ""}`,
      );
  }
  if (e.type === "heroAwakened") { floating(e.unit,"苏醒","#e5d8a2"); combatVFX.shield(e.unit); }
  if (e.type === "blocked") { combatVFX.shield(e.unit); floating(e.unit, "抵挡", "#b9e2f5", null, "blocked"); }
  if (e.type === "knockback") floating(e.unit, "击退", "#ffda8b", null, "knockback");
  if (e.type === "rankUp") floating(e.unit, `升至 ${e.rank} 阶`, "#ffda72", null, "rankUp");
  if (e.type === "healingCast") {
    combatVFX.heal(e.source, e.target);
    const v = unitMeshes.get(e.source.id);
    if (v) {
      v.attackDuration = v.attack = .3;
      v.attackDirection.set(e.target.x - e.source.x, e.source.y - e.target.y).normalize();
      v.recoil = false;
      v.weapon?.aimAt(pos(e.target.x, e.target.y, 1.1), true);
    }
  }
  if (e.type === "heal" || e.type === "upgrade") {
    if (e.type === "heal")
      floatingNumber(e);
    else floating(e.unit, e.levels ? `等级 +${e.levels}` : "等级提升", "#ffda72");
    if (e.type === "upgrade") combatVFX.upgrade(e.unit);
    else if (!e.automatic && e.amount > 0) combatVFX.healTarget(e.unit);
    if (!audioHandled) tone(650, 0.2);
  }
  if (e.type === "equip") {
    floating(e.unit, cards[e.card].name, "#e7c0fa");
    burst(e.unit, "#c7ace8");
    combatVFX.shield(e.unit);
  }
  if (e.type === "lifeSteal") {
    floatingNumber(e);
    if (e.amount > 0) combatVFX.healTarget(e.unit);
  }
  if (e.type === "cardImpact") {
    combatVFX.castCard(e.visual, e.x, e.y, e.radius);
  }
  if (e.type === "wave") {
    banner(`第 ${e.day} 天 · 第 ${e.wave} 波`);
    if (e.wave !== 1 || !gameAudio.configured("battleStart")) tone(220, 0.25, "triangle");
  }
  if (e.type === "clear") {
    if (!gameAudio.configured("victory")) tone(880, 0.3);
  }
  if (e.type === "build") burst(e.unit, "#eddaa1");
  if (e.type === "end") {
    resultTimer = setTimeout(() => showResult(e.won), 500);
  }
  if (e.type === "select") tone(550, 0.05);
  uiTimer = 1;
}
game = new Game(onEvent);
$("base-avatar").src = artUrls.base;
const cardUI = new CardUI({
  game,
  canInteract: () => !paused && !$("route-dialog").open && !["shop", "victory", "reward", "won", "lost", "route"].includes(game.phase),
  onSelect: () => {
    rangeKey = "";
    uiTimer = 1;
  },
  onAim: previewCard,
  onDrop: (key, e, slot) => {
    const p = cellFromEvent(e);
    return game.playCard(key, p.x, p.y, slot);
  },
});
const cardRange = new THREE.Group();
scene.add(cardRange);
function previewCard(e) {
  clearGroup(cardRange);
  if (!e || !cardUI.activeKey) {
    hover.visible = false;
    return;
  }
  const { x, y } = cellFromEvent(e),
    c = game.cardDefinition(cardUI.activeKey, cardUI.activeSlot);
  const valid = game.cardTarget(cardUI.activeKey, x, y, cardUI.activeSlot).valid;
  hover.visible = inside(x, y);
  hover.position.copy(pos(x, y, 0.2));
  hover.material.color.set(valid ? "#94d58d" : "#d16b63");
  const radius = cardRadius(c);
  for (let yy = y - radius; yy <= y + radius; yy++)
    for (let xx = x - radius; xx <= x + radius; xx++)
      if (inside(xx, yy) && dist({ x, y }, { x: xx, y: yy }) <= radius) {
        const m = plane(0.92, 0.92, valid ? "#94d58d" : "#d16b63", 0.23);
        m.position.copy(pos(xx, yy, 0.22));
        cardRange.add(m);
      }
  return valid;
}
function inspectedUnit() {
  return [...game.heroes, ...game.followers, ...game.towers, ...game.enemies].find(
    (u) => u.id === inspectedUnitId && u.hp > 0,
  );
}
function updateInspector() {
  const unit = inspectedUnit();
  $("unit-inspector").hidden = !unit;
  if (!unit) return;
  $("unit-inspector").dataset.side = unit.side;
  $("unit-side").textContent = unit.side === "enemy" ? "敌方" : unit.isFollower ? "我方随从" : game.heroes.includes(unit) ? (game.isDormant(unit) ? "我方英雄 · 沉睡" : unit.mechanics?.immobile ? "我方英雄 · 固守" : "我方英雄") : "我方建筑";
  $("unit-name").textContent = unit.name || "咖啡炮台";
  const heroCard = game.heroes.includes(unit) ? game.config.cards[unit.cardId] : null;
  $("unit-inspector").dataset.hasProfile = String(!!heroCard);
  $("unit-profile").hidden = !heroCard;
  $("unit-role").textContent = heroCard ? `${heroRoles[heroCard.role] || heroRoles[inferHeroRole(heroCard)]} · ${unit.rank ?? 0} 阶 · Lv.${unit.level}` : "";
  $("unit-description").textContent = heroCard?.text || "暂无英雄描述";
  const src = iconURL(unit.useIcon || unit.type, true);
  if ($("unit-icon").getAttribute("src") !== src) $("unit-icon").src = src;
  const healing = unit.combatBehavior === "heal";
  $("unit-power-label").textContent = healing ? "治疗量" : "攻击力";
  $("unit-rate-label").textContent = healing ? "治疗速度" : "攻击速度";
  $("unit-range-label").textContent = healing ? "治疗距离" : "攻击距离";
  $("unit-crit-row").hidden = healing;
  $("unit-atk").textContent = healing ? `${unit.healing.value}${unit.healing.valueMode === "percent" ? "% 最大生命" : ""}` : Math.round(unit.atk);
  $("unit-hp").textContent = `${Math.ceil(unit.hp)} / ${Math.round(unit.maxHp)}`;
  $("unit-rate").textContent = unit.rate.toFixed(1);
  $("unit-range").textContent = Math.round(unit.range);
  $("unit-crit").textContent = `${Number((unit.critChance || 0).toFixed(1))}%`;
  $("unit-crit").title = `暴击伤害：${Number((unit.critDamage ?? 200).toFixed(1))}%`;
}
const routeMap = new RouteMap(game, () => {
  cardUI.cancel();
  rangeKey = moveKey = pathKey = "";
  updateUI();
});
let terrainKey = "";
const shopUI = new ShopUI(game, () => { cardUI.cancel(); updateUI(); });
function updateTerrain() {
  const key = [...game.obstacles].sort().join(";");
  if (key === terrainKey) return;
  terrainKey = key;
  mapTexture.image = mapArt(game.obstacles);
  mapTexture.needsUpdate = true;
  rangeKey = moveKey = pathKey = "";
}
function updateUI() {
  routeMap.update();
  shopUI.update();
  updateTerrain();
  updateInspector();
  updateGates();
  $("base-hp").textContent = Math.ceil(game.baseHp) + " / " + game.baseMaxHp;
  $("base-health").style.width = (game.baseHp / game.baseMaxHp) * 100 + "%";
  waveProgress.update(game);
  $("start").hidden = !["ready", "between"].includes(game.phase);
  $("start").disabled = !["ready", "between"].includes(game.phase) || paused;
  $("start-label").textContent =
    "⚑ 迎战";
  $("pause").textContent = paused ? "▶" : "Ⅱ";
  $("speed").textContent = speed + "×";
  const c = game.cardDefinition(cardUI.activeKey, cardUI.activeSlot);
  $("map-hint").textContent =
    paused && !$("dialog").open
      ? "Ⅱ 暂停"
      : c
        ? c.name +
          " · " +
          (c.category === "hero"
            ? (game.heroes.some(h => h.cardId === cardUI.activeKey && !h.destroyed) ? "对同名存活英雄使用 · 等级 +3" : "放置到空地 · 同名英雄限上场一名")
            : c.target === "hero"
            ? "选择我方英雄"
            : c.target === "any"
              ? "拖到战场"
              : c.target === "ground"
              ? "放置到空地"
              : "选择敌人") +
          " · Esc 取消"
        : game.phase === "shop" ? "" : !game.heroes.length
          ? "拖入英雄 · 守护美人鱼"
          : "";
  $("map-hint").classList.toggle("paused", paused && !$("dialog").open);
  cardUI.render();
}
const customUnitTextures = new Map();
function unitTexturePair(u) {
  const icon = u.useIcon || u.type;
  if (textures[icon] && !u.boatId)
    return { normal: textures[icon], white: whiteTextures[icon] };
  const key = u.boatId ? `crew:${icon}` : icon;
  if (!customUnitTextures.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const white = document.createElement("canvas");
    white.width = white.height = 128;
    const pair = {
      normal: new THREE.CanvasTexture(canvas),
      white: new THREE.CanvasTexture(white),
    };
    pair.normal.colorSpace = pair.white.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      canvas.getContext("2d").drawImage(img, 0, 0, 128, 128);
      const g = white.getContext("2d");
      g.drawImage(canvas, 0, 0, 128, 128);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#fff7dd";
      g.fillRect(0, 0, 128, 128);
      pair.normal.needsUpdate = pair.white.needsUpdate = true;
    };
    img.src = iconURL(icon, !!u.boatId);
    customUnitTextures.set(key, pair);
  }
  return customUnitTextures.get(key);
}
function syncAppearance(v, u) {
  const pair = unitTexturePair(u);
  if (v.sprite.material.map !== pair.normal) {
    v.sprite.material.map = pair.normal;
    v.sprite.material.needsUpdate = true;
    v.white.material.map = pair.white;
    v.white.material.needsUpdate = true;
  }
}
function addVisual(u) {
  if (unitMeshes.has(u.id)) return unitMeshes.get(u.id);
  const size = (["boss", "pirate_captain"].includes(u.type) ? 1.15 : ["tank", "pirate_heavy"].includes(u.type) ? 1.03 : 0.91) * (u.isFollower ? FOLLOWER_SCALE : 1);
  const group = new THREE.Group(),
    sprite = imagePlane(
      unitTexturePair(u).normal,
      size,
    );
  sprite.position.z = 0.03;
  group.add(sprite);
  const white = imagePlane(
    unitTexturePair(u).white,
    size,
  );
  white.position.z = 0.042;
  white.material.opacity = 0;
  group.add(white);
  const healthBar = new HealthBar(group, u, size);
  group.position.copy(pos(u.seaX ?? u.x, u.seaY ?? u.y, 1.1));
  group.scale.setScalar(u.boatId ? CREW_SPRITE_SIZE / size : 1);
  scene.add(group);
  const v = {
    group,
    healthBar,
    dying: 0,
    ...motionState(sprite, white, size),
  };
  syncWeapon(v, u);
  unitMeshes.set(u.id, v);
  return v;
}
function syncWeapon(visual, unit) {
  if (visual.weapon?.id === unit.weapon) return;
  visual.weapon?.dispose();
  visual.weapon = getWeaponSpec(unit)
    ? new WeaponRig(unit.weapon, visual.group)
    : null;
  if (visual.weapon && unit.isFollower) visual.weapon.root.scale.setScalar(FOLLOWER_SCALE);
}
function clearGroup(group) {
  while (group.children.length) {
    const m = group.children[0];
    group.remove(m);
    m.material.dispose();
  }
}
function updateRanges() {
  const h = inspectedUnit();
  if (!h || cardUI.activeKey) {
    selection.visible = selectionOutline.visible = false;
    clearGroup(rangeGroup);
    clearGroup(pathGroup);
    clearGroup(moveGroup);
    moveCells.clear();
    rangeKey = pathKey = moveKey = "";
    return;
  }
  const movable = game.canControl(h);
  const occupancy = [...game.heroes, ...game.followers, ...game.enemies, ...game.towers]
    .filter((u) => u.hp > 0).map((u) => `${u.x},${u.y}`).join("|");
  const nextMoveKey = `${h.id}:${h.x},${h.y}:${movable}:${occupancy}`;
  if (nextMoveKey !== moveKey) {
    moveKey = nextMoveKey;
    clearGroup(moveGroup);
    const cells = movable ? game.reachableCells(h) : [];
    moveCells = new Set(cells.map((p) => `${p.x},${p.y}`));
    for (const p of cells) {
      const m = plane(0.94, 0.94, "#a8dc86", 0.2);
      m.position.copy(pos(p.x, p.y, 0.11));
      moveGroup.add(m);
    }
  }
  const key = `${h.id},${h.x},${h.y},${h.range},${h.hp > 0}`;
  if (key !== rangeKey) {
    rangeKey = key;
    clearGroup(rangeGroup);
    if (h.hp > 0)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (gridDistance(h, { x, y }) <= h.range && !game.obstacles.has(`${x},${y}`)) {
            const m = plane(0.95, 0.95, h.side === "enemy" ? "#b46c61" : "#c0dba1", 0.07);
            m.position.copy(pos(x, y, 0.1));
            rangeGroup.add(m);
          }
  }
  const path = movable ? h.path : [];
  const pkey = path.map((p) => `${p.x},${p.y}`).join("|");
  if (pkey !== pathKey) {
    pathKey = pkey;
    clearGroup(pathGroup);
    path.forEach((p, i) => {
      const m = plane(
        i === path.length - 1 ? 0.22 : 0.09,
        i === path.length - 1 ? 0.22 : 0.09,
        "#e8f5b3",
        0.65,
      );
      m.position.copy(pos(p.x, p.y, 0.3));
      m.rotation.z = Math.PI / 4;
      pathGroup.add(m);
    });
  }
  const v = unitMeshes.get(h.id);
  selection.material.color.set(h.side === "enemy" ? "#cf8071" : "#d7efa2");
  selectionOutline.material.color.set(h.side === "enemy" ? "#e8a29a" : "#ffffff");
  selection.visible = h.hp > 0;
  selectionOutline.visible = h.hp > 0 && h.side === "enemy";
  if (v) {
    selection.position.set(v.group.position.x, v.group.position.y, 0.12);
    selectionOutline.position.set(v.group.position.x, v.group.position.y, 0.16);
  }
}
function cellFromEvent(e) {
  const v = worldFromScreen(e.clientX, e.clientY);
  return { x: Math.round(v.x + 7), y: Math.round(5 - v.y) };
}
function clickCell(x, y) {
  if (["shop", "victory", "won", "lost", "reward", "route"].includes(game.phase) || $("route-dialog").open) return;
  if (!inside(x, y)) return;
  if (cardUI.activeKey) {
    if (paused) return;
    if (game.playCard(cardUI.activeKey, x, y, cardUI.activeSlot)) cardUI.cancel();
  } else {
    const unit = [...game.heroes, ...game.followers, ...game.towers, ...game.enemies].find(
      (u) => u.hp > 0 && u.x === x && u.y === y,
    );
    if (unit) {
      if (inspectedUnitId === unit.id) { inspectedUnitId = null; game.clearSelection(); }
      else if (!paused && unit.side === "hero" && inspectedUnitId === game.selectedUnit()?.id) game.move(x, y);
      else if (game.heroes.includes(unit)) game.select(game.heroes.indexOf(unit));
      else if (unit.isFollower) game.selectFollower(unit.id);
      else { game.clearSelection(); inspectedUnitId = unit.id; }
    } else if (!paused && inspectedUnitId === game.selectedUnit()?.id) game.move(x, y);
  }
  updateUI();
}
const pointers = new Map();
let gesture = null;
const midpoint = (points) => ({
  x: (points[0].x + points[1].x) / 2,
  y: (points[0].y + points[1].y) / 2,
});
const separation = (points) =>
  Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if ($("dialog").open || $("reward-dialog").open || $("route-dialog").open) return;
    const delta =
      e.deltaY *
      (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? arena.clientHeight : 1);
    zoomAt(
      e.clientX,
      e.clientY,
      camera.zoom * Math.exp(-THREE.MathUtils.clamp(delta, -300, 300) * 0.0015),
    );
  },
  { passive: false },
);
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
renderer.domElement.addEventListener("pointermove", (e) => {
  if (pointers.has(e.pointerId)) {
    const previous = [...pointers.values()];
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const current = [...pointers.values()];
    if (current.length >= 2) {
      gesture.dragged = true;
      const from = midpoint(previous),
        to = midpoint(current);
      const anchor = worldFromScreen(from.x, from.y);
      const distance = separation(previous);
      if (distance > 1)
        zoomAt(from.x, from.y, (camera.zoom * separation(current)) / distance);
      const moved = worldFromScreen(to.x, to.y);
      camera.position.x += anchor.x - moved.x;
      camera.position.y += anchor.y - moved.y;
      constrainCamera();
    } else if (gesture) {
      if (
        Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 5
      )
        gesture.dragged = true;
      if (gesture.dragged) {
        const from = worldFromScreen(gesture.lastX, gesture.lastY),
          to = worldFromScreen(e.clientX, e.clientY);
        camera.position.x += from.x - to.x;
        camera.position.y += from.y - to.y;
        constrainCamera();
      }
    }
    gesture.lastX = e.clientX;
    gesture.lastY = e.clientY;
    if (gesture.dragged) {
      arena.classList.add("panning");
      hover.visible = false;
      return;
    }
  }
  if (cardUI.activeKey) {
    previewCard(e);
    return;
  }
  pointerCell = cellFromEvent(e);
  const { x, y } = pointerCell;
  hover.visible = inside(x, y);
  hover.position.copy(pos(x, y, 0.2));
  hover.material.color.set(
    moveCells.has(`${x},${y}`) ? "#94d58d" : game.blocked(x, y, null, true) ? "#c88779" : "#d6eeb7",
  );
});
renderer.domElement.addEventListener("pointerleave", () => {
  hover.visible = false;
  clearGroup(cardRange);
  pointerCell = null;
});
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button > 2 || $("dialog").open) return;
  e.preventDefault();
  renderer.domElement.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1)
    gesture = {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      dragged: false,
      button: e.button,
    };
  else gesture.dragged = true;
});
function releasePointer(e, cancelled = false) {
  if (!pointers.has(e.pointerId)) return;
  const tap =
    !cancelled &&
    pointers.size === 1 &&
    gesture &&
    !gesture.dragged &&
    gesture.button === 0;
  pointers.delete(e.pointerId);
  if (renderer.domElement.hasPointerCapture(e.pointerId))
    renderer.domElement.releasePointerCapture(e.pointerId);
  if (!pointers.size) {
    gesture = null;
    arena.classList.remove("panning");
  } else {
    const point = [...pointers.values()][0];
    gesture.lastX = point.x;
    gesture.lastY = point.y;
    gesture.dragged = true;
  }
  if (tap) {
    const { x, y } = cellFromEvent(e);
    clickCell(x, y);
  }
}
renderer.domElement.addEventListener("pointerup", (e) => releasePointer(e));
renderer.domElement.addEventListener("pointercancel", (e) =>
  releasePointer(e, true),
);
renderer.domElement.addEventListener("lostpointercapture", (e) =>
  releasePointer(e, true),
);
function togglePause() {
  if (["won", "lost"].includes(game.phase)) return;
  paused = !paused;
  updateUI();
}
$("start").onclick = () => {
  game.startDay();
  updateUI();
};
$("pause").onclick = togglePause;
$("speed").onclick = () => {
  speed = speed === 1 ? 2 : 1;
  updateUI();
};
$("sound").onclick = () => {
  sound = !sound;
  gameAudio.setEnabled(sound);
  $("sound").innerHTML = sound ? "♫" : '♫<span class="sound-slash">/</span>';
  $("sound").setAttribute("aria-label", sound ? "关闭声音" : "开启声音");
  $("sound").title = sound ? "关闭声音" : "开启声音";
  tone(600, 0.1);
};
document.addEventListener("keydown", (e) => {
  if ($("dialog").open || $("route-dialog").open || $("shop-dialog").open || $("reward-dialog").open) return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.code === "Space") togglePause();

  if (e.code === "Digit0" || e.code === "Home") overview();
  if (e.code === "Escape") {
    cardUI.cancel();
    updateUI();
  }
  if (/^Digit[1-9]$/.test(e.code)) {
    cardUI.cancel();
    game.select(Number(e.code.at(-1)) - 1);
  }
  const dirs = {
    KeyW: [0, -1],
    ArrowUp: [0, -1],
    KeyS: [0, 1],
    ArrowDown: [0, 1],
    KeyA: [-1, 0],
    ArrowLeft: [-1, 0],
    KeyD: [1, 0],
    ArrowRight: [1, 0],
  };
  if (dirs[e.code] && !paused && !["shop", "victory", "won", "lost", "route"].includes(game.phase) && !$("route-dialog").open) {
    const h = game.selectedUnit(),
      d = dirs[e.code];
    if (h && h.id === inspectedUnitId) game.move(h.x + d[0], h.y + d[1]);
  }
  updateUI();
});
let modalWasPaused = false;
function openDialog(content) {
  modalWasPaused = paused;
  paused = true;
  $("dialog-content").innerHTML = content;
  $("dialog").showModal();
  updateUI();
}
function closeDialog() {
  $("dialog").close();
  paused = modalWasPaused;
  updateUI();
}
$("close-dialog").onclick = closeDialog;
$("dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeDialog();
});
$("help").onclick = () =>
  openDialog(
    `<h2>操作</h2><div class="help-row"><b>1–9</b><span>选择英雄</span></div><div class="help-row"><b>点击地面 / WASD</b><span>移动 · 自动攻击</span></div><div class="help-row"><b>滚轮 / 双指</b><span>缩放</span></div><div class="help-row"><b>拖动 / 0</b><span>移动视野 / 全图</span></div><div class="help-row"><b>拖拽卡牌</b><span>英雄放空地 · 资源与装备给英雄</span></div><div class="help-row"><b>战斗牌 / Esc</b><span>攻击敌人 / 取消选牌</span></div><div class="help-row"><b>空格</b><span>暂停</span></div><button class="primary-button" id="understood">继续</button>`,
  );
$("dialog-content").addEventListener("click", (e) => {
  if (e.target.closest("#understood")) closeDialog();
  if (e.target.closest("#confirm-restart") || e.target.closest("#play-again")) {
    closeDialog();
    reset();
  }
});
$("restart").onclick = () =>
  openDialog(
    `<div class="result-icon">↻</div><h2>重新开局？</h2><button class="primary-button" id="confirm-restart">重开</button>`,
  );
function showResult(won) {
  best = Math.max(best, game.kills);
  try {
    localStorage.setItem("friday-defense-best", String(best));
  } catch {}
  openDialog(
    `<div class="result-icon">${won ? "✳" : "☂"}</div><h2>${won ? "成功守护美人鱼！" : "美人鱼失守…"}</h2><div class="result-stats"><div><b>${game.completedDays.length}</b><span>完成关卡</span></div><div><b>${game.kills}</b><span>击退</span></div><div><b>${best}</b><span>最佳</span></div></div><button id="play-again" class="primary-button">再来</button>`,
  );
}
function reset() {
  goldVisuals.reset();
  $("route-dialog").close();
  clearTimeout(resultTimer);
  for (const v of unitMeshes.values()) {
    v.weapon?.dispose();
    v.healthBar.dispose();
    scene.remove(v.group);
    v.group.children.forEach((m) => m.material.dispose());
  }
  unitMeshes.clear();
  boatVisuals.reset();
  for (const pair of customUnitTextures.values()) {
    pair.normal.dispose();
    pair.white.dispose();
  }
  customUnitTextures.clear();
  gateKey = "";
  for (const e of effects) {
    scene.remove(e.m);
    e.m.material.dispose();
    e.texture?.dispose();
  }
  effects.length = 0;
  combatVFX.reset();
  baseMotion.hitTimer = baseMotion.attack = 0;
  baseSprite.position.copy(pos(7, 5, 1));
  baseSprite.rotation.z = 0;
  baseSprite.scale.set(1.65, 1.65, 1);
  baseWhite.material.opacity = 0;
  paused = false;
  speed = 1;
  rangeKey = pathKey = "";
  game.reset();
  shopUI.reset();
  cardUI.reset();
  clearTimeout(bannerTimer);
  $("wave-banner").classList.remove("visible");
  clearGroup(pathGroup);
  updateUI();
  toast("重新出发");
}
function animate(now) {
  requestAnimationFrame(animate);
  const realDt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  wallTime += realDt;
  const dt = paused || ["shop", "reward", "route"].includes(game.phase) || $("route-dialog").open ? 0 : realDt * speed;
  if (!reducedOceanMotion.matches) oceanMotion.update(dt);
  if (dt) {
    let left = dt;
    while (left > 0) {
      const step = Math.min(left, 0.025);
      combatVFX.update(step);
      game.tick(step);
      left -= step;
    }
  }
  goldVisuals.update(game, dt);
  boatVisuals.update(game, dt);
  $("gold-total").textContent = game.gold;
  const alive = [...game.heroes, ...game.followers, ...game.enemies, ...game.towers].filter(
      (u) => u.hp > 0,
    ),
    ids = new Set(alive.map((u) => u.id));
  for (const [id, v] of unitMeshes)
    if (!ids.has(id)) {
      v.dying = Math.max(0, (v.dying || 0.4) - dt);
      const progress = 1 - v.dying / 0.4;
      v.sprite.rotation.z = v.hitDirection.x * 0.3 + progress * 0.75;
      v.sprite.position.y = -progress * 0.16;
      v.sprite.scale.setScalar(v.size * (1 + progress * 0.18));
      v.sprite.material.opacity = 1 - progress;
      v.white.material.opacity = (1 - progress) * 0.65;
      v.white.position.copy(v.sprite.position);
      v.white.position.z += 0.012;
      v.white.rotation.copy(v.sprite.rotation);
      v.white.scale.copy(v.sprite.scale);
      v.healthBar.update(0, v.healthBar.maxHp, dt);
      v.healthBar.mesh.material.opacity *= 1 - progress;
      v.weapon?.setOpacity(1 - progress);
      if (v.dying <= 0) {
        v.weapon?.dispose();
        v.healthBar.dispose();
        scene.remove(v.group);
        v.group.children.forEach((m) => m.material.dispose());
        unitMeshes.delete(id);
      }
    }
  for (const u of alive) {
    const v = unitMeshes.get(u.id) || addVisual(u),
      target = pos(u.seaX ?? u.x, u.seaY ?? u.y, 1.1);
    v.dying = 0;
    v.sprite.material.opacity = game.isDormant(u) ? .55 : 1;
    if (u.boatId) v.group.position.copy(target);
    else v.group.position.lerp(target, Math.min(1, dt * 15));
    v.group.position.z = u.boatId ? 1.2 + u.y * .005 + Math.floor(u.boatSeat / BOAT_SLOTS) * .02 : 1.1 + u.y * 0.005;
    v.group.scale.setScalar(u.boatId ? CREW_SPRITE_SIZE / v.size : 1);
    v.healthBar.update(u.hp, u.maxHp, dt, u.level || 0, u.equipment || []);
    applyMotion(v, dt, u.id);
    syncAppearance(v, u);
    syncWeapon(v, u);
    if (v.weapon) {
      const candidates =
        game.isDormant(u) ? [] : u.side === "enemy"
          ? [...game.heroes, ...game.followers, ...game.towers]
              .filter((h) => h.hp > 0)
              .concat(BASE)
          : u.combatBehavior === "heal"
            ? [...game.heroes, ...game.followers, ...game.towers].filter(t => t.hp > 0 && t.id === u.healingTargetId)
            : game.enemies.filter((e) => e.hp > 0);
      const targetUnit = candidates
        .filter((t) => gridDistance(u, t) <= u.range)
        .sort((a, b) => gridDistance(u, a) - gridDistance(u, b))[0];
      const targetPoint = targetUnit
        ? unitMeshes.get(targetUnit.id)?.group.position ||
          pos(targetUnit.x, targetUnit.y, 1.1)
        : null;
      v.weapon.setOpacity(game.isDormant(u) ? .45 : 1);
      v.weapon.update(
        dt,
        targetPoint,
        1 - Math.max(0, u.cooldown) * u.rate,
        v.sprite.position,
      );
    }
  }
  applyMotion(baseMotion, dt);
  updateRanges();
  selection.material.opacity = 0.11 + Math.sin(wallTime * 3) * 0.035;
  baseGlow.material.opacity = 0.05 + Math.sin(wallTime * 2) * 0.018;
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    e.m.position.y += (e.vy || 0) * dt;
    e.m.position.x += (e.vx || 0) * dt;
    e.m.material.transparent = true;
    const progress = 1 - e.life / e.max;
    e.m.material.opacity = e.number ? Math.max(0, Math.min(1, (1 - progress) / .4)) : Math.max(0, e.life / e.max);
    if (e.number) {
      const pop = progress < .12 ? .75 + progress / .12 * .4 : 1 + .15 * Math.max(0, 1 - (progress - .12) / .18);
      e.m.scale.copy(e.baseScale).multiplyScalar(pop);
    }
    if (e.life <= 0) {
      scene.remove(e.m);
      e.m.material.dispose();
      e.texture?.dispose();
      effects.splice(i, 1);
    }
  }
  for (const f of fireflies) {
    f.m.position.x = f.x + Math.sin(wallTime * 0.4 + f.phase) * 0.17;
    f.m.position.y = f.y + Math.cos(wallTime * 0.35 + f.phase) * 0.12;
    f.m.material.opacity = 0.45 + Math.sin(wallTime + f.phase) * 0.35;
  }
  uiTimer += realDt;
  if (uiTimer > 0.12) {
    uiTimer = 0;
    updateUI();
  }
  frame++;
  retroRenderer.render(scene, camera);
}
subscribeConfig((config, mode) => {
  cardUI.cancel();
  if (mode === "restart") {
    $("dialog").close();
    $("reward-dialog").close();
    game.config = config;
    reset();
  } else {
    game.applyConfig(config);
    if ($("reward-dialog").open) $("reward-dialog").close();
    cardUI.signature = "";
    rangeKey = "";
    updateUI();
    toast("配置已同步");
  }
});
if (configLoadError) toast(configLoadError);
updateUI();
resize();
requestAnimationFrame(animate);
if (import.meta.env.DEV)
  window.__game = {
    snapshot: () => ({
      ...game.snapshot(),
      audio: { enabled: sound, counts: { ...audioStats.counts }, last: audioStats.last, voices: gameAudio.voices.size },
      paused,
      speed,
      selectedCard: cardUI.activeKey,
      inspectedUnitId,
      movableCells: [...moveCells],
      frames: frame,
      camera: { zoom: camera.zoom, x: camera.position.x, y: camera.position.y },
      ocean: { time: oceanMotion.time.value, reducedMotion: reducedOceanMotion.matches },
      boatVisualCount: boatVisuals.items.size,
      boatVisuals: [...boatVisuals.items].map(([id,v]) => ({id,width:v.mesh.geometry.parameters.width,height:v.mesh.geometry.parameters.height})),
      combat: combatVFX.snapshot(),
      combatNumbers: effects.filter(e => e.number).map(e => ({ ...e.number, unitId: e.unitId, life: e.life, aspect: e.m.scale.x / e.m.scale.y, textureAspect: e.texture.image.width / e.texture.image.height })),
      combatStatuses: effects.filter(e => e.status).map(e => ({ type: e.status, text: e.text, unitId: e.unitId, life: e.life })),
      weapons: [...unitMeshes.entries()]
        .filter(([, v]) => v.weapon)
        .map(([id, v]) => ({ id, ...v.weapon.snapshot() })),
      unitVisuals: [...unitMeshes.entries()].map(([id, v]) => ({ id, size: v.size, displaySize: v.size * v.group.scale.x })),
      healthBars: [...unitMeshes.entries()].map(([id, v]) => ({
        id,
        ...v.healthBar.snapshot(),
      })),
      hitAnimations: [...unitMeshes.entries()]
        .filter(([, v]) => v.hitTimer > 0)
        .map(([id, v]) => ({
          id,
          time: v.hitTimer,
          x: v.sprite.position.x,
          y: v.sprite.position.y,
          flash: v.white.material.opacity,
        })),
    }),
    clickCell,
    advance: (seconds) => {
      for (let t = 0; t < seconds; t += 0.025) {
        combatVFX.update(0.025);
        game.tick(0.025);
      }
      updateUI();
    },
    cellToScreen: (x, y) => {
      const p = pos(x, y).project(camera),
        r = renderer.domElement.getBoundingClientRect();
      return {
        x: r.left + ((p.x + 1) * r.width) / 2,
        y: r.top + ((1 - p.y) * r.height) / 2,
      };
    },
  };
