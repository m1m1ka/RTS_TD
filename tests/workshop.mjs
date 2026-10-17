import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { workshopRules } from "../src/config/workshop-content.js";
const clone = structuredClone;
function fixture() {
  const c = clone(DEFAULT_CONFIG);
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  c.initial.firstWaveDelay = 100;
  c.cards.hero_blue.triggerRules = [clone(workshopRules.parts), clone(workshopRules.engineering)];
  c.cards.hero_blue.triggerRules[0].trigger.interval = 2;
  c.initial.cards.parts = 2;
  return c;
}
{
  const c = fixture(), g = new Game(() => {}, assertConfig(c));
  g.playCard("hero_blue", 5, 5);
  g.tick(20); assert.equal(g.cards.parts, 2, "preparation does not produce cards");
  g.startDay(); g.tick(1); assert.equal(g.cards.parts, 2);
  g.applyConfig(clone(c)); g.tick(1); assert.equal(g.cards.parts, 3, "saving does not restart existing timer");
  g.tick(5); assert.equal(g.cards.parts, 5, "large time steps retain remainder and all elapsed intervals");
  g.waitForWave(100); g.tick(1); assert.equal(g.cards.parts, 6, "wave changes preserve progress");
  const h = g.heroes[0];
  g.tick(1); g.hit(h, h.maxHp * 100, { side: "enemy", x: 4, y: 5 });
  g.tick(10); assert.equal(g.cards.parts, 6, "dead heroes stop production");
  g.reviveHero(h, {maxRevives: 2, hpPercent: 100}, h);
  g.tick(1); assert.equal(g.cards.parts, 6, "revival starts a fresh interval");
  g.tick(1); assert.equal(g.cards.parts, 7);
  for (const phase of ["reward", "route", "shop", "lost", "ready"]) {
    g.phase = phase; g.tick(10); assert.equal(g.cards.parts, 7, phase + " does not produce cards");
  }
  g.phase = "route"; const ordinary = g.cards.training;
  g.chooseDay(g.nextDays()[0]); assert.equal(g.cards.parts, undefined); assert.equal(g.cards.training, ordinary);
  g.startDay(); g.tick(1); assert.equal(g.cards.parts, undefined, "next day starts fresh");
  g.tick(1); assert.equal(g.cards.parts, 1);
}
{
  const c = fixture(); c.cards.hero_green.triggerRules = [clone(workshopRules.engineering)];
  const events = [], g = new Game(e => events.push(e), assertConfig(c));
  g.playCard("hero_blue", 5, 5); g.playCard("hero_green", 6, 4);
  g.heroes[0].level = 10; g.heroes[1].level = 7;
  const before = g.cards.parts;
  assert.equal(g.playCard("parts", 5, 5), false);
  assert.equal(g.cards.parts, before); assert.equal(events.filter(e => e.type === "heroTowerBuilt").length, 0);
  assert.ok(g.playCard("parts", 5, 4));
  const tower = g.towers[0];
  assert.equal(tower.level, 9, "1 base + floor(10*.5) + floor(7*.5)");
  assert.equal(tower.atk, c.cards.parts.unit.atk + 8 * 6);
  assert.equal(tower.maxHp, c.cards.parts.unit.maxHp + 8 * 40);
  assert.equal(tower.hp, tower.maxHp); assert.equal(tower.rate, c.cards.parts.unit.rate);
  assert.equal(g.cards.parts, before - 1);
  g.applyConfig(clone(c)); assert.equal(tower.level, 9, "hot save does not repeat build bonuses");
  c.cards.hero_green.triggerRules[0].trigger.radius = 0;
  g.applyConfig(clone(c));
  assert.ok(g.playCard("tower", 4, 4)); assert.equal(g.towers[1].level, 6, "ordinary turret cards also trigger; range excludes far listener");
  g.heroes[0].hp = 0; g.cards.parts = 1;
  g.playCard("parts", 4, 6); assert.equal(g.towers[2].level, 1, "dead/out-of-range heroes do not improve towers");
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c);
}
{
  // Victory effects that create temporary cards are cleaned up before rewards.
  const c = fixture();
  c.cards.hero_blue.triggerRules.push({ ...clone(workshopRules.parts), trigger: { event: "victory", scope: "any", radius: -1 } });
  const g = new Game(() => {}, assertConfig(c));
  g.playCard("hero_blue", 5, 5); g.startDay();
  g.phase = "battle"; g.wave = g.dayPlan.waves.length - 1; g.spawnQueues = []; g.enemies = [];
  g.tick(.01); assert.equal(g.phase, "victory"); assert.equal(g.cards.parts, undefined);
  const lost = new Game(() => {}, assertConfig(c)); lost.playCard("hero_blue",5,5); lost.startDay();
  lost.beginWave(); lost.baseHp = 0; lost.tick(.01);
  assert.equal(lost.phase, "lost"); assert.equal(lost.cards.parts, undefined);
}
{
  // Timer is independent per hero and per rule; payload remains composable.
  const c = fixture();
  c.cards.hero_blue.triggerRules = [clone(workshopRules.parts), clone(workshopRules.parts)];
  c.cards.hero_blue.triggerRules[0].trigger.interval = 2;
  c.cards.hero_blue.triggerRules[1].trigger.interval = 3;
  c.cards.hero_blue.triggerRules[1].effects[0].cards = ["training"];
  c.cards.hero_blue.triggerRules[1].effects[0].count = 2;
  c.cards.hero_green.triggerRules = clone(c.cards.hero_blue.triggerRules);
  c.initial.cards.hero_green = 1;
  const g = new Game(() => {}, assertConfig(c)), before = g.cards.training;
  g.playCard("hero_blue", 5, 5); g.startDay(); g.tick(1);
  assert.ok(g.playCard("hero_green", 6, 4)); g.tick(1);
  assert.equal(g.cards.parts, 3);
  g.tick(1); assert.equal(g.cards.parts, 4); assert.equal(g.cards.training, before + 2);
}
{
  const c = fixture(); delete c.workshopContentVersion; delete c.cards.parts;
  const migrated = assertConfig(c);
  assert.equal(migrated.cards.parts.temporary, true);
  assert.equal(migrated.cards.parts.useIcon, c.cards.tower.useIcon);
  assert.deepEqual(migrated.cards.tower, c.cards.tower, "migration preserves existing turret config");
  delete migrated.cards.parts; delete migrated.initial.cards.parts;
  migrated.cards.hero_blue.triggerRules = [];
  assert.equal(assertConfig(migrated).cards.parts, undefined, "intentional deletion is respected");
}
for (const mutate of [
  c => c.cards.parts.temporary = "yes",
  c => c.cards.hero_blue.triggerRules[0].trigger.interval = 0,
  c => c.cards.hero_blue.triggerRules[0].trigger.interval = undefined,
  c => c.cards.hero_blue.triggerRules[1].effects[0].percent = -1,
  c => c.cards.hero_blue.triggerRules[1].trigger.event = "preparation",
]) { const c = fixture(); mutate(c); assert.throws(() => assertConfig(c)); }
console.log("PASS workshop: temporary inventory lifecycle, independent timers, revival/waves/days, configurable production, construction bonuses/ranges/stacking, tower growth, portable migration and validation");
