import assert from "node:assert/strict";
import { Game, inside } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { selectAttackModule } from "../src/attack-modules.js";
import { gridDistance } from "../src/grid-distance.js";

const point = u => ({ x: u.x, y: u.y });
const advance = (g, seconds) => { for (let t = 0; t < seconds - 1e-9; t += .025) g.tick(.025); };
function setup() {
  const c = structuredClone(DEFAULT_CONFIG), events = [];
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  c.days[0].obstacles = []; c.days[0].mines = [];
  selectAttackModule(c.cards.hero_blue.unit, "slash");
  Object.assign(c.cards.hero_blue.unit, { range: 1, speed: 4, rate: 2, critChance: 0 });
  c.initial.firstWaveDelay = 0;
  c.days[0].waves = [{ id: "retaliation", name: "反击测试", startDelay: 0, hpScale: 1, atkScale: 1,
    spawns: [{ x: 14, y: 5, delay: 1000, interval: 1, enemies: [{ type: "grunt", count: 1, level: 1 }] }] }];
  const g = new Game(e => events.push(e), assertConfig(c));
  g.playCard("hero_blue", 3, 3); g.startDay();
  return { g, hero: g.heroes[0], events };
}
function enemy(g, x = 9, y = 3) {
  const e = { id: ++g.id, side: "enemy", enemyId: "grunt", x, y, hp: 10000, maxHp: 10000,
    atk: 1, range: 8, rate: 1, speed: 1, critChance: 0, cooldown: 999, moveCooldown: 999, attackModule: "bow" };
  g.enemies.push(e); return e;
}
{
  const { g, hero, events } = setup(), e = enemy(g);
  advance(g, .5); assert.deepEqual(point(hero), { x: 3, y: 3 }, "no unsolicited chase before being attacked");
  g.attack(e, hero); advance(g, .1);
  assert.deepEqual(point(hero), { x: 3, y: 3 }, "reacts at impact rather than projectile launch");
  advance(g, 2);
  assert.equal(gridDistance(hero, e), 1, "stops at the edge of its own attack range");
  assert.ok(e.hp < e.maxHp, "actually counterattacks after closing the gap");
  assert.ok(events.some(v => v.type === "attack" && v.source === hero && v.target === e));
  assert.deepEqual(hero.path, [], "automatic chase never becomes a player route");
  const held = point(hero); advance(g, 1); assert.deepEqual(point(hero), held);
}
for (const [range, x, y] of [[1, 4, 4], [3, 6, 6]]) {
  const { g, hero } = setup(), e = enemy(g, x, y); hero.range = range;
  g.hit(hero, 1, e); advance(g, .5);
  assert.deepEqual(point(hero), { x: 3, y: 3 }, "already-in-range hits do not cause movement, including diagonals");
  assert.ok(e.hp < e.maxHp);
}
{
  const { g, hero } = setup(), e = enemy(g);
  g.hit(hero, 1, e); advance(g, .025); assert.equal(hero.x, 4);
  g.select(0); g.move(1, 8);
  assert.equal(hero.retaliationTargetId, null, "new manual command cancels existing pursuit");
  const destination = { x: 1, y: 8 };
  let ticks = 0;
  while (hero.path.length && ticks++ < 200) {
    const expected = structuredClone(hero.path);
    g.hit(hero, 1, e); g.tick(.025);
    if (hero.path.length) {
      assert.deepEqual(hero.path.at(-1), destination, "repeated incoming fire cannot change the manual destination");
      assert.ok(hero.path.length === expected.length || hero.path.length === expected.length - 1);
    }
  }
  assert.deepEqual(point(hero), destination, "fully completes player order under fire");
  assert.ok(hero.moveCooldown > 0, "cannot move twice in the tick that reaches the destination");
  advance(g, 3); assert.equal(gridDistance(hero, e), 1, "deferred attacks can be answered after the manual route ends");
}
{
  const { g, hero } = setup(), e = enemy(g);
  g.hit(hero, 1, e); advance(g, .025);
  g.select(0); g.move(1, 8); advance(g, 5);
  assert.deepEqual(point(hero), { x: 1, y: 8 }, "old pursuit does not resume after player repositioning without new incoming fire");
  g.hit(hero, 1, e); g.move(hero.x, hero.y); advance(g, 1);
  assert.deepEqual(point(hero), { x: 1, y: 8 }, "moving to current cell also cancels pursuit");
}
{
  const { g, hero } = setup(), e = enemy(g);
  g.select(0); g.move(1, 8);
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) if (x !== 3 || y !== 3) g.obstacles.add(`${x},${y}`);
  g.hit(hero, 1, e); advance(g, 1);
  assert.deepEqual(point(hero), { x: 3, y: 3 });
  assert.deepEqual(hero.path.at(-1), { x: 1, y: 8 }, "temporarily blocked manual orders retain priority");
  g.obstacles.clear();
  for (let i = 0; hero.path.length && i < 200; i++) g.tick(.025);
  assert.deepEqual(point(hero), { x: 1, y: 8 });
}
{
  const { g, hero, events } = setup(), e = enemy(g, 8, 3);
  g.playCard("hero_green", 4, 3); const ally = g.heroes[1];
  Object.assign(ally, { cooldown: 999, range: 0 });
  for (let y = 1; y <= 4; y++) g.obstacles.add(`5,${y}`);
  g.hit(hero, 1, e); advance(g, 3);
  assert.equal(gridDistance(hero, e), 1, "routes around obstacles and friendly units");
  assert.deepEqual(point(ally), { x: 4, y: 3 });
  assert.ok(!events.some(v => v.yielding), "automatic pursuit cannot displace allies");
  assert.ok(events.filter(v => v.type === "step" && v.unit === hero).length > 0);
  // A moving attacker requires a fresh route, not the position of its first hit.
  Object.assign(e, { x: 11, y: 8 }); advance(g, 3);
  assert.equal(gridDistance(hero, e), 1);
}
{
  const { g, hero } = setup(), e = enemy(g, 8, 3);
  for (let y = 0; y < 11; y++) g.obstacles.add(`5,${y}`);
  g.hit(hero, 1, e); advance(g, .5);
  assert.deepEqual(point(hero), { x: 3, y: 3 }, "no path means no teleport or walking into obstacles");
  g.obstacles.clear(); advance(g, 2); assert.equal(gridDistance(hero, e), 1, "retries when a path becomes available");
}
for (const removal of ["death", "removed"]) {
  const { g, hero } = setup(), e = enemy(g);
  g.hit(hero, 1, e); advance(g, .025); const held = point(hero);
  if (removal === "death") e.hp = 0; else g.enemies = [];
  advance(g, 1); assert.deepEqual(point(hero), held); assert.equal(hero.retaliationTargetId, null);
}
{
  const { g, hero } = setup(), e = enemy(g);
  g.hit(hero, hero.maxHp, e); assert.equal(hero.retaliationTargetId, null);
  advance(g, 1); assert.deepEqual(point(hero), { x: 3, y: 3 }, "dead heroes cannot pursue");
  assert.ok(g.reviveHero(hero, { maxRevives: 1, hpPercent: 50 }, hero));
  advance(g, 1); assert.deepEqual(point(hero), { x: 3, y: 3 }, "revival clears stale pursuit");
}
for (const mode of ["immobile", "dormant", "heal", "follower", "tower"]) {
  const { g, hero } = setup(), e = enemy(g);
  if (mode === "heal") selectAttackModule(hero, "heal");
  else if (mode === "immobile" || mode === "dormant") {
    hero.mechanics = { [mode]: true };
    if (mode === "dormant") g.playCard("hero_green", 11, 8);
  } else { g.heroes = []; g[mode === "follower" ? "followers" : "towers"].push(hero); }
  g.hit(hero, 1, e);
  assert.ok(!hero.retaliationTargetId, `${mode} is excluded from offensive pursuit`);
  if (mode !== "follower") { advance(g, 1); assert.deepEqual(point(hero), { x: 3, y: 3 }); }
}
{
  const { g, hero } = setup(), e = enemy(g);
  hero.mechanics = { arrowReduction: { mode: "percent", value: 100 } };
  g.hit(hero, 10, e, false, "arrow");
  assert.equal(hero.hp, hero.maxHp); advance(g, .025); assert.equal(hero.x, 4, "fully blocked ranged hits still provoke a response");
}
for (const [start, far, near] of [
  [[3,3],[-3,3],[-1,3]], [[11,3],[17,3],[15,3]],
  [[3,3],[3,-3],[3,-1]], [[3,7],[3,13],[3,11]],
]) {
  const { g, hero } = setup(); Object.assign(hero, { x: start[0], y: start[1] });
  const e = enemy(g, ...far); g.hit(hero, 1, e); advance(g, .5);
  assert.deepEqual(point(hero), { x: start[0], y: start[1] }, "unreachable sea target waits for the boat to approach");
  Object.assign(e, { x: near[0], y: near[1] }); advance(g, 2);
  assert.ok(inside(hero.x, hero.y), "never walks into the sea");
  assert.equal(gridDistance(hero, e), 1); assert.ok(e.hp < e.maxHp, "can counterattack boat passengers from shore");
}
{
  const { g, hero } = setup(), e = enemy(g);
  g.hit(hero, 1, e);
  for (const phase of ["ready", "waiting", "between"]) {
    g.phase = phase; g.waveWait = 100; advance(g, .5);
    assert.deepEqual(point(hero), { x: 3, y: 3 }, phase + " does not chase");
  }
}
console.log("PASS retaliation: impact-triggered chase, own range, manual interruption/deferred response/blocked orders, collisions, moving/dead/unreachable targets, death/revival, exclusions, full blocks, four shores and battle-only movement");
