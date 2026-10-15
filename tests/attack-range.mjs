import assert from "node:assert/strict";
import { Game, BASE } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

function setup() {
  const c = structuredClone(DEFAULT_CONFIG);
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  c.cards.hero_blue.unit.range = 1;
  c.cards.hero_blue.unit.critChance = 0;
  const g = new Game(() => {}, c);
  assert.ok(g.playCard("hero_blue", 3, 3));
  g.phase = "battle";
  g.spawnQueues = [];
  return g;
}
function enemy(g, x, y, active = false) {
  const e = { id: ++g.id, side: "enemy", type: "grunt", x, y, hp: 1000, maxHp: 1000,
    atk: 10, range: 1, rate: 1, speed: 1, critChance: 0, cooldown: active ? 0 : 999, moveCooldown: 999 };
  g.enemies.push(e);
  return e;
}
for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
  if (!dx && !dy) continue;
  const g = setup(), h = g.heroes[0], e = enemy(g, h.x + dx, h.y + dy);
  g.tick(0);
  assert.equal(g.attacks.find(a => a.source === h)?.target, e, `range 1 includes neighbor ${dx},${dy}`);
  g.resolveAttacks(1);
  assert.equal(e.hp, e.maxHp - h.atk, "adjacent attacks actually resolve damage");
}
for (const [range, dx, dy, canHit] of [[1, 2, 1, false], [1, 2, 2, false], [2, 2, 2, true], [2, 3, 1, false], [0, 1, 1, false]]) {
  const g = setup(), h = g.heroes[0]; h.range = range;
  enemy(g, h.x + dx, h.y + dy); g.tick(0);
  assert.equal(g.attacks.some(a => a.source === h), canHit, `range ${range} at ${dx},${dy}`);
}
{
  const g = setup(), h = g.heroes[0]; h.cooldown = 999;
  const tower = { ...h, id: ++g.id, x: 5, y: 3, cooldown: 0 };
  g.towers.push(tower); const e = enemy(g, 6, 4); g.tick(0);
  assert.equal(g.attacks.find(a => a.source === tower)?.target, e, "towers use the same diagonal range");
}
{
  const g = setup(), h = g.heroes[0]; h.cooldown = 999;
  const [f] = g.summonFollowers(h, { count: 1, hpPercent: 50, atkPercent: 50 });
  f.followOffset = { x: 1, y: 0 }; // Without a diagonal target, auto-follow would move it.
  const before = { x: f.x, y: f.y }, e = enemy(g, f.x + 1, f.y - 1);
  g.tick(.025);
  assert.deepEqual({ x: f.x, y: f.y }, before, "follower holds position to fight a diagonal enemy");
  assert.equal(g.attacks.find(a => a.source === f)?.target, e);
}
for (const kind of ["hero", "follower", "tower", "mine", "base"]) {
  const g = setup(), h = g.heroes[0]; h.cooldown = 999;
  let target = h;
  if (kind === "follower") {
    [target] = g.summonFollowers(h, { count: 1, hpPercent: 50, atkPercent: 50 });
    target.moveCooldown = target.cooldown = 999;
  } else if (kind === "tower") {
    target = { ...h, id: ++g.id, x: 10, y: 3 }; g.towers.push(target);
  } else if (kind === "mine") {
    target = { id: ++g.id, x: 10, y: 3, hp: 100, maxHp: 100, type: "mine", side: "neutral" }; g.mines.push(target);
  } else if (kind === "base") target = BASE;
  const e = enemy(g, target.x + 1, target.y - 1, true);
  const hp = kind === "base" ? g.baseHp : target.hp;
  g.tick(0);
  assert.equal(g.attacks.find(a => a.source === e)?.target, target, `enemy can attack diagonal ${kind}`);
  g.resolveAttacks(1);
  assert.equal(kind === "base" ? g.baseHp : target.hp, hp - e.atk);
}
console.log("PASS attack range: all eight neighbors, diagonal damage, range boundaries, towers, follower combat hold, enemy attacks against heroes/followers/towers/mines/core");
