import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { clone, validateConfig, assertConfig } from "../src/config/schema.js";
import { Game } from "../src/game.js";
const config = () => clone(DEFAULT_CONFIG);
assert.deepEqual(validateConfig(config()), []);
for (const mutate of [
  (c) => (c.cards.hero_blue.unit.speed = 0),
  (c) => (c.cards.fireball.effects[0].value = NaN),
  (c) => (c.days[0].waves[0].spawns = [{ x: 7, y: 5 }]),
  (c) => (c.days[0].waves[0].spawns = [{ x: -1, y: 0 }]),
  (c) => (c.days[0].waves[0].spawns[0].enemies[0].type = "missing"),
  (c) => (c.initial.cards = { coffee: 1 }),
  (c) => (c.cards.hero_blue.icon = "javascript:alert(1)"),
  (c) => (c.cards.training.effects = [{ type: "unsupported" }]),
  (c) => (c.days = []),
  (c) => (c.cards.guard.effects = [{ type: "damage", value: 10, radius: 1 }]),
  (c) => (c.days[0].rewards[0].cards = { missing: 2 }),
  (c) => (c.version = 99),
]) {
  const c = config();
  mutate(c);
  assert.ok(validateConfig(c).length);
  assert.throws(() => assertConfig(c));
}
{
  const c = config();
  c.cards.hero_blue.effects = [
    { type: "stat", stat: "atk", mode: "add", value: 10 },
    { type: "level", value: 2 },
  ];
  c.cards.hero_blue.unit.maxHp = 500;
  c.cards.hero_blue.unit.speed = 2;
  c.cards.quiver.effects = [
    { type: "stat", stat: "atk", mode: "add", value: 30 },
    { type: "lifesteal", value: 0.2 },
    { type: "weapon", weapon: "staff", range: 5 },
  ];
  const g = new Game(() => {}, c);
  g.playCard("hero_blue", 7, 3);
  const h = g.heroes[0];
  assert.equal(h.level, 3);
  assert.equal(
    h.atk,
    70,
    "passives must be applied once even with combined leveling",
  );
  g.playCard("quiver", 7, 3);
  assert.equal(h.atk, 100);
  assert.equal(h.lifeSteal, 0.2);
  assert.equal(h.weapon, "staff");
  h.hp = h.maxHp / 2;
  const before = h.hp / h.maxHp;
  const next = clone(c);
  next.cards.hero_blue.unit.maxHp = 800;
  next.cards.quiver.effects[0].value = 50;
  g.applyConfig(next);
  assert.equal(h.hp / h.maxHp, before);
  assert.equal(h.atk, 120);
  g.applyConfig(next);
  assert.equal(h.atk, 120, "live sync must never stack equipment twice");
  g.select(0);
  g.move(7, 4);
  g.tick(0.01);
  assert.equal(
    h.moveCooldown,
    0.5,
    "movement speed is configured in cells/sec",
  );
}
{
  const c = config();
  c.days = c.days.slice(0, 1);
  c.initial.firstWaveDelay = 0;
  c.days[0].waves = c.days[0].waves.slice(0, 1);
  c.days[0].waves[0].spawns = [{ x: 0, y: 5, delay: 0, interval: 1, enemies: [{ type: "tank", count: 2 }, { type: "runner", count: 1 }] }];
  c.days[0].waves[0].hpScale = 2;
  c.enemies.tank.maxHp = 350;
  const g = new Game(() => {}, assertConfig(c));
  g.playCard("hero_blue", 7, 3);
  g.startDay();
  const queue = g.spawnQueues[0];
  g.spawn(queue);
  assert.equal(g.enemies[0].enemyId, "tank");
  assert.equal(g.enemies[0].maxHp, 700);
  assert.deepEqual([g.enemies[0].x, g.enemies[0].y], [0, 5]);
  g.enemies = [];
  g.spawn(queue);
  g.enemies = [];
  g.spawn(queue);
  assert.equal(g.enemies[0].enemyId, "runner");
  g.enemies = [];
  g.tick(0.025);
  assert.equal(g.phase, "reward");
  g.chooseReward(0);
  assert.equal(g.phase, "won", "any configured day count can finish");
}
{
  const c = config();
  c.initial.firstWaveDelay = 0;
  c.cards.combo = clone(c.cards.fireball);
  c.cards.combo.effects = [
    { type: "damage", value: 25, radius: 1 },
    { type: "slow", value: 0.8, duration: 7, radius: 2 },
  ];
  c.initial.cards.combo = 2;
  const g = new Game(() => {}, assertConfig(c));
  g.playCard("hero_blue", 7, 3);
  g.startDay();
  g.enemies = [
    { id: 99, x: 6, y: 4, hp: 100, maxHp: 100, side: "enemy" },
    { id: 100, x: 6, y: 6, hp: 100, maxHp: 100, side: "enemy" },
  ];
  g.playCard("combo", 6, 4);
  assert.equal(g.enemies[0].hp, 75);
  assert.equal(g.enemies[1].hp, 100);
  assert.equal(g.enemies[1].slowAmount, 0.8);
  assert.equal(g.enemies[1].slowUntil, 7);
  assert.equal(g.cards.combo, 1);
  const file = JSON.stringify(c);
  assert.deepEqual(
    assertConfig(JSON.parse(file)),
    c,
    "portable JSON roundtrip",
  );
}
console.log(
  "PASS config: validation, effect composition, live stat rebuild, movement, custom spawning, wave count, portable roundtrip",
);
