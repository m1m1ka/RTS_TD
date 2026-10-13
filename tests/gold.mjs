import assert from "node:assert/strict";
import { Game, BASE } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
const fixture = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.initial.firstWaveDelay = 0;
  c.days[0].waves = [c.days[0].waves[0]];
  c.days[0].mines = [{ x: 5, y: 3, maxHp: 180 }, { x: 9, y: 3, maxHp: 120 }];
  return assertConfig(c);
};
const victory = (g) => {
  g.playCard("hero_blue", 7, 3); g.startDay();
  g.wave = g.dayPlan.waves.length - 1; g.beginWave();
  for (const q of g.spawnQueues) q.spawned = q.types.length;
  g.enemies = []; g.tick(.025);
  assert.equal(g.phase, "victory");
};
{
  const events = [], g = new Game(e => events.push(e), fixture());
  assert.equal(g.cardTarget("hero_blue", 5, 3).valid, false);
  g.hit(g.mines[1], 1000, { side: "enemy" });
  assert.equal(g.cardTarget("hero_blue", 9, 3).valid, true, "ruins no longer block deployment");
  victory(g);
  assert.equal(g.settlement.total, 6);
  assert.equal(g.gold, 0);
  assert.equal(g.chooseReward([0, 1]), false);
  assert.equal(g.playCard("hero_green", 4, 4), false);
  g.tick(2.29); assert.equal(g.gold, 0);
  g.tick(.02); assert.equal(g.gold, 1);
  g.tick(.85); assert.equal(g.gold, 4, "core issues exactly four coins first");
  g.tick(.6); assert.equal(g.gold, 5);
  assert.equal(events.filter(e => e.type === "gold").at(-1).x, 5);
  g.tick(2); assert.equal(g.phase, "reward"); assert.equal(g.gold, 6);
  g.tick(100); assert.equal(g.gold, 6, "no duplicate reward");
  g.chooseReward([0, 1]); g.chooseDay(g.nextDays()[0]);
  assert.equal(g.gold, 6, "coins persist between days");
  assert.equal(g.mines.length, 0, "mines belong to their day");
  victory(g); g.tick(6); assert.equal(g.gold, 10);
  g.reset(); assert.equal(g.gold, 0); assert.equal(g.mines[1].hp, 120);
}
{
  const g = new Game(() => {}, fixture());
  victory(g); g.tick(6);
  assert.equal(g.gold, 8, "each survivor provides two coins");
}
{
  const c = fixture(), g = new Game(() => {}, c);
  g.playCard("hero_blue", 2, 8); g.startDay();
  for (const q of g.spawnQueues) q.spawned = q.types.length;
  const mine = g.mines[0];
  const e = { ...c.enemies.grunt, id: ++g.id, side: "enemy", enemyId: "grunt", x: 5, y: 2, hp: 100, maxHp: 100, atk: 25, range: 1, rate: 1, speed: 2, cooldown: 0, moveCooldown: 0 };
  g.enemies = [e]; g.tick(.025);
  assert.equal(g.attacks[0].target, mine, "enemy attacks a nearby mine");
  g.tick(.5); assert.ok(mine.hp < mine.maxHp);
  e.x = 5; e.y = 0; e.cooldown = 10; e.moveCooldown = 0;
  g.tick(.025); assert.equal(e.x, 5); assert.equal(e.y, 1, "enemy approaches nearest accessible objective");
  g.hit(mine, 1000, e); g.applyConfig(structuredClone(c));
  assert.equal(g.mines[0].hp, 0, "live save cannot revive a destroyed mine");
  g.hit(BASE, 999999, e); g.tick(.025);
  assert.equal(g.phase, "lost"); g.tick(10); assert.equal(g.gold, 0);
}
for (const mines of [[{ x: 7, y: 5 }], [{ x: 7, y: 0 }], [{ x: 2, y: 2, maxHp: 0 }], [{ x: 2, y: 2 }, { x: 2, y: 2 }], [null]]) {
  const c = fixture(); c.days[0].mines = mines; assert.throws(() => assertConfig(c));
}
console.log("PASS gold: timed ordered payout, surviving/destroyed mines, blocking, enemy targeting, defeat, hot edits, day carry, reset and validation");
