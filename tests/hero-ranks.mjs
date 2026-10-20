import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
import { heroRank, rankedHeroCard } from "../src/hero-ranks.js";
import { changeLevel } from "../src/resource-effects.js";
import { selectAttackModule } from "../src/attack-modules.js";

const values = (key, ...numbers) => Object.fromEntries(numbers.map((v, i) => [i + 1, { [key]: v }]));
const generate = { type: "generateCard", pool: "selected", category: "all", cards: ["training"], count: 1, rankValues: values("count", 2, 3, 4) };
function config() {
  const c = structuredClone(DEFAULT_CONFIG);
  // A consumable resource isolates rank-trigger counting from skill cooldowns.
  c.cards.coffee.category = "resource"; delete c.cards.coffee.cooldown; delete c.cards.coffee.skillTiers;
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  c.initial.firstWaveDelay = 100;
  c.initial.cards.hero_blue = 5;
  c.days.forEach(d => { d.obstacles = []; d.mines = []; });
  c.cards.hero_blue.rankLevels = [3, 5, 8];
  return c;
}
function setup(c = config()) {
  const events = [], g = new Game(e => events.push(e), assertConfig(c));
  assert.ok(g.playCard("hero_blue", 3, 3));
  return { g, h: g.heroes[0], events };
}
{
  const c = config(), card = c.cards.hero_blue;
  card.effects = [{ type: "stat", stat: "atk", mode: "add", value: 1, rankValues: values("value", 5, 10, 20) }];
  card.unit.mechanics = { knockback: { distance: 1, rankValues: values("distance", 2, 3, 4) } };
  const { g, h, events } = setup(c);
  assert.equal(h.rank, 0);
  for (const [level, rank, bonus] of [[2, 0, 1], [3, 1, 5], [4, 1, 5], [5, 2, 10], [8, 3, 20], [100, 3, 20]]) {
    changeLevel(g, h, level);
    assert.equal(h.rank, rank);
    assert.equal(h.atk, card.unit.atk + card.unit.levelGrowth.atk * (level - 1) + bonus);
    assert.equal(h.mechanics.knockback.distance, rank + 1);
  }
  assert.deepEqual(events.filter(e => e.type === "rankUp").map(e => e.rank), [1, 2, 3]);
  changeLevel(g, h, 1); assert.equal(h.rank, 0, "level loss recalculates rank and passive effects");
  assert.ok(g.playCard("hero_blue", h.x, h.y)); assert.equal(h.level, 4); assert.equal(h.rank, 1);
  changeLevel(g, h, 2); changeLevel(g, h, 9);
  assert.equal(events.filter(e => e.type === "rankUp").at(-1).rank, 3, "large gains can skip ranks");
  assert.equal(g.snapshot().heroes[0].rank, 3);
}
{
  const c = config();
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), trigger: { event: "preparation", scope: "any", radius: -1 }, effects: [structuredClone(generate)] }];
  const { g, h } = setup(c), initial = c.initial.cards.training;
  assert.equal(g.cards.training, initial + 1);
  changeLevel(g, h, 5); assert.equal(g.cards.training, initial + 1, "promotion does not replay preparation");
  g.heroTriggers.resolve(h, "preparation"); assert.equal(g.cards.training, initial + 4);
  assert.equal(c.cards.hero_blue.triggerRules[0].effects[0].count, 1, "runtime resolution does not mutate base configuration");
}
{
  const c = config();
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), effects: [{ type: "stat", stat: "atk", mode: "add", duration: "permanent", value: 5, rankValues: values("value", 10, 20, 30) }] }];
  const { g, h } = setup(c);
  g.heroTriggers.start(); changeLevel(g, h, 3); g.heroTriggers.start();
  assert.deepEqual(h.triggerPermanentEffects.map(e => e.value), [5, 10], "old triggered gains retain their original values; new gains use current rank");
  assert.ok(h.triggerPermanentEffects.every(e => !e.rankValues), "stored bonuses are resolved snapshots");
  const hot = structuredClone(g.config); hot.cards.hero_blue.rankLevels = [4, 6, 9];
  g.applyConfig(hot); assert.equal(h.rank, 0);
  assert.deepEqual(h.triggerPermanentEffects.map(e => e.value), [5, 10], "saving does not replay or rescale historic bonuses");
}
{
  const c = config();
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), trigger: { event: "interval", scope: "any", radius: -1, interval: 2, rankValues: values("interval", 1, .5, .25) }, effects: [structuredClone(generate)] }];
  const { g, h } = setup(c), initial = g.cards.training;
  g.startDay(); g.tick(.75); changeLevel(g, h, 3); g.tick(.25);
  assert.equal(g.cards.training, initial + 2, "promotion preserves elapsed production time and uses upgraded quantity/interval");
  g.tick(.5); changeLevel(g, h, 5); g.tick(.025); assert.equal(g.cards.training, initial + 5);
}
{
  const c = config();
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), trigger: { event: "cardPlayed", scope: "any", radius: -1, category: "all", every: 5, rankValues: values("every", 3, 2, 1) }, effects: [structuredClone(generate)] }];
  const { g, h } = setup(c), initial = g.cards.training;
  const play = () => { g.cards.coffee = 1; h.hp = 1; assert.ok(g.playCard("coffee", h.x, h.y)); };
  play(); play(); changeLevel(g, h, 3); play();
  assert.equal(g.cards.training, initial + 2, "promotion retains card-count progress");
}
{
  const c = config(); selectAttackModule(c.cards.hero_blue.unit, "heal");
  c.cards.hero_blue.unit.healing.value = 10;
  c.cards.hero_blue.unit.healing.rankValues = values("value", 20, 30, 40);
  const { g, h } = setup(c); changeLevel(g, h, 8); assert.equal(h.healing.value, 40);
  const hot = structuredClone(g.config); hot.cards.hero_blue.unit.healing.rankValues[3].value = 60;
  g.applyConfig(hot); assert.equal(h.healing.value, 60, "current-rank healing updates live");
}
{
  const c = config(); delete c.cards.hero_blue.rankLevels;
  const migrated = assertConfig(c); assert.deepEqual(migrated.cards.hero_blue.rankLevels, [5, 10, 15]);
  assert.equal(heroRank(migrated.cards.hero_blue, 1), 0); assert.equal(heroRank(migrated.cards.hero_blue, 9999), 3);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))), migrated);
  assert.equal(rankedHeroCard(migrated.cards.hero_blue, 15).unit.atk, migrated.cards.hero_blue.unit.atk, "legacy numeric balance is preserved");
}
for (const levels of [[1, 5, 8], [3, 3, 8], [3, 8, 5], [3, 5], [3, 5, 8, 9], [3, 5, NaN], [3.5, 5, 8]]) {
  const c = config(); c.cards.hero_blue.rankLevels = levels; assert.throws(() => assertConfig(c));
}
for (const mutate of [
  c => c.cards.hero_blue.triggerRules[0].effects[0].rankValues[2].count = 0,
  c => c.cards.hero_blue.triggerRules[0].effects[0].rankValues[2].count = 1.5,
  c => c.cards.hero_blue.triggerRules[0].effects[0].rankValues[2].count = 100,
  c => c.cards.hero_blue.triggerRules[0].effects[0].rankValues[4] = { count: 2 },
  c => c.cards.hero_blue.triggerRules[0].effects[0].rankValues[2] = { category: 2 },
  c => c.cards.hero_blue.unit.rankValues = { 1: { atk: 999 } },
  c => c.cards.coffee.effects[0].rankValues = { 1: { value: 50 } },
]) {
  const c = config(); c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), effects: [structuredClone(generate)] }];
  mutate(c); assert.throws(() => assertConfig(c), "all rank variants use the normal numeric limits");
}
console.log("PASS hero ranks: 0–3 thresholds, skipped ranks/level loss/duplicate upgrades, passive/mechanic/healing effects, instant/trigger snapshots, preserved timers/card counts, hot edits, migration and per-rank validation");
