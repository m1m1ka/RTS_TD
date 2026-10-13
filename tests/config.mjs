import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { clone, validateConfig, assertConfig } from "../src/config/schema.js";
import { Game, attackKind } from "../src/game.js";
const config = () => clone(DEFAULT_CONFIG);
assert.deepEqual(validateConfig(config()), []);
{
  const c = config();
  c.cards.hero_blue.unit.levelGrowth = { maxHp: 40, atk: 2.5 };
  c.cards.hero_green.unit.levelGrowth = { maxHp: 0, atk: 9 };
  c.initial.levelGrowth.rate = 10; // Old saved values must have no gameplay effect.
  const g = new Game(() => {}, c);
  g.playCard("hero_blue", 7, 3);
  g.playCard("hero_green", 5, 5);
  g.playCard("training", 7, 3);
  g.playCard("training", 5, 5);
  assert.equal(g.heroes[0].maxHp, 400);
  assert.equal(g.heroes[0].atk, 38.5);
  assert.equal(g.heroes[1].maxHp, 220);
  assert.equal(g.heroes[1].atk, 36);
  assert.equal(g.heroes[0].rate, c.cards.hero_blue.unit.rate, "leveling does not increase attack speed");
  assert.equal(g.heroes[1].rate, c.cards.hero_green.unit.rate);
  g.playCard("quiver", 7, 3);
  assert.equal(g.heroes[0].atk, 46.5, "equipment is applied after the level formula");
  g.heroes[0].hp = 200;
  const hot = clone(c);
  hot.cards.hero_blue.unit.levelGrowth = { maxHp: 80, atk: 5 };
  g.applyConfig(hot);
  assert.equal(g.heroes[0].maxHp, 440);
  assert.equal(g.heroes[0].hp, 220, "live formula edits preserve health ratio");
  assert.equal(g.heroes[0].atk, 49);
  g.applyConfig(hot);
  assert.equal(g.heroes[0].atk, 49, "rebuild does not stack level growth");
  assert.equal(g.heroes[0].rate, c.cards.hero_blue.unit.rate, "live rebuild ignores legacy speed growth");
  const old = config();
  for (const card of Object.values(old.cards)) if (card.unit) delete card.unit.levelGrowth;
  for (const enemy of Object.values(old.enemies)) delete enemy.levelGrowth;
  old.initial.levelGrowth.maxHp = 91;
  old.initial.levelGrowth.atk = 7;
  old.initial.levelGrowth.rate = 0.1;
  const upgraded = assertConfig(old);
  assert.equal(upgraded.initial.levelGrowth.rate, undefined, "migration removes obsolete rate growth");
  assert.deepEqual(upgraded.cards.hero_blue.unit.levelGrowth, { maxHp: 91, atk: 7 });
  assert.deepEqual(upgraded.enemies.grunt.levelGrowth, { maxHp: 0, atk: 0 });
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(upgraded))), upgraded);
}
{
  const c = config();
  c.initial.firstWaveDelay = 0;
  c.enemies.grunt.maxHp = 100;
  c.enemies.grunt.atk = 10;
  c.enemies.grunt.levelGrowth = { maxHp: 20, atk: 3 };
  c.days[0].waves[0].hpScale = 1.5;
  c.days[0].waves[0].atkScale = 2;
  c.days[0].waves[0].spawns = [{ x: 7, y: 0, delay: 0, interval: 1,
    enemies: [{ type: "grunt", count: 1, level: 2 }, { type: "grunt", count: 1, level: 5 }] }];
  const g = new Game(() => {}, assertConfig(c));
  g.playCard("hero_blue", 5, 5);
  g.startDay();
  g.spawn(g.spawnQueues[0]);
  const first = g.enemies[0];
  assert.equal(first.level, 2);
  assert.equal(first.maxHp, 180);
  assert.equal(first.atk, 26);
  first.y = 1;
  first.hp = first.maxHp / 2;
  const hot = clone(c);
  hot.enemies.grunt.levelGrowth = { maxHp: 30, atk: 4 };
  hot.days[0].waves[0].spawns[0].enemies[1].level = 9;
  g.applyConfig(hot);
  assert.equal(first.level, 2);
  assert.equal(first.maxHp, 195);
  assert.equal(first.hp, 97.5);
  assert.equal(first.atk, 28);
  g.spawn(g.spawnQueues[0]);
  const second = g.enemies[1];
  assert.equal(second.level, 5, "issued spawn levels stay fixed during an active wave");
  assert.equal(second.maxHp, 330, "pending enemy uses current growth formula before wave scale");
  assert.equal(second.atk, 52);
}
{
  const old = config();
  delete old.heroContentVersion;
  delete old.cards.hero_catgirl;
  delete old.initial.cards.hero_catgirl;
  old.cards.hero_blue.unit.atk = 77;
  const migrated = assertConfig(old);
  assert.equal(migrated.cards.hero_blue.unit.atk, 77);
  assert.equal(migrated.initial.cards.hero_catgirl, 1);
  assert.equal(migrated.cards.hero_catgirl.useIcon, "catgirl");
  assert.deepEqual(assertConfig(migrated), migrated, "content migration is idempotent");
  delete migrated.cards.hero_catgirl;
  delete migrated.initial.cards.hero_catgirl;
  assert.equal(assertConfig(migrated).cards.hero_catgirl, undefined, "user deletions stay deleted");
  const customized = config();
  delete customized.heroContentVersion;
  customized.cards.hero_catgirl.name = "自定义猫女";
  customized.initial.cards.hero_catgirl = 0;
  assert.equal(assertConfig(customized).cards.hero_catgirl.name, "自定义猫女");
  assert.equal(assertConfig(customized).initial.cards.hero_catgirl, 0);
  const g = new Game(() => {}, config());
  assert.equal(g.playCard("hero_catgirl", 7, 3), true);
  const h = g.heroes[0];
  assert.equal(h.name, "米娅");
  assert.equal(h.type, "catgirl");
  assert.equal(h.rate, 1.8);
  assert.equal(attackKind(h), "claw");
  assert.equal(g.playCard("training", 7, 3), true);
  assert.equal(h.level, 2);
  assert.equal(g.playCard("guard", 7, 3), true);
  assert.ok(h.equipment.includes("guard"));
  const hot = config();
  hot.cards.hero_catgirl.unit.atk = 40;
  g.applyConfig(hot);
  assert.equal(h.atk, 52, "catgirl supports live stats and level growth");
}
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
  (c) => (c.rewardPools[c.days[0].rewardPool].cards = { missing: 2 }),
  (c) => (c.version = 99),
  (c) => (c.cards.hero_blue.unit.levelGrowth.atk = NaN),
  (c) => (c.enemies.grunt.levelGrowth.maxHp = -1),
  (c) => (c.enemies.grunt.levelGrowth = { atk: 1 }),
  (c) => (c.days[0].waves[0].spawns[0].enemies[0].level = 0),
  (c) => (c.days[0].waves[0].spawns[0].enemies[0].level = 1.5),
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
  if (g.phase === "victory") g.tick(6);
  assert.equal(g.phase, "reward");
  g.chooseReward([0, 1]);
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
