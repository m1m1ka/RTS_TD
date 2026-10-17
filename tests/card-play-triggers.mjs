import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { cardPlayRules } from "../src/config/trigger-rules.js";
const clone = structuredClone;
function fixture(rules) {
  const c = clone(DEFAULT_CONFIG);
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  c.cards.hero_blue.triggerRules = clone(rules);
  c.initial.cards = { hero_blue: 3, hero_green: 1, coffee: 30, training: 20, fireball: 20, quiver: 1 };
  return assertConfig(c);
}
function setup(rules) {
  const c = fixture(rules), events = [], g = new Game(e => events.push(e), c);
  assert.ok(g.playCard("hero_blue", 5, 5));
  return { g, h: g.heroes[0], c, events };
}
function play(g, key = "coffee") {
  const h = g.heroes[0];
  if (key === "coffee") h.hp = Math.max(1, h.maxHp - 100);
  assert.ok(g.playCard(key, h.x, h.y));
}
function random(value, fn) { const old = Math.random; try { Math.random = () => value; return fn(); } finally { Math.random = old; } }
{
  const rule = clone(cardPlayRules.fiveCards);
  rule.effects[0] = { type: "generateCard", pool: "selected", category: "all", cards: ["training"], count: 1 };
  const { g, h, c, events } = setup([rule]);
  const initial = g.cards.training;
  assert.equal(h.cardPlayCounts, undefined, "the hero's own initial deployment does not count");
  assert.equal(g.playCard("coffee", 1, 1), false);
  g.generateCards({ pool: "selected", cards: ["training"], count: 1 });
  for (let i = 0; i < 4; i++) play(g);
  assert.equal(g.cards.training, initial + 1, "invalid plays and generated cards do not count");
  g.applyConfig(clone(c));
  play(g, "hero_blue");
  assert.equal(h.level, 4);
  assert.equal(g.cards.training, initial + 2, "duplicate hero upgrade counts as the fifth play; hot save retains progress");
  for (let i = 0; i < 5; i++) play(g);
  assert.equal(g.cards.training, initial + 3, "repeats every five cards without self-triggering");
  play(g);
  h.hp = 0;
  assert.ok(g.playCard("hero_green", 6, 5));
  h.hp = h.maxHp;
  g.phase = "route";
  assert.ok(g.chooseDay(g.nextDays()[0]));
  for (let i = 0; i < 4; i++) play(g);
  assert.equal(g.cards.training, initial + 4, "progress persists through death and next day, with no counting while dead");
  assert.equal(events.filter(e => e.type === "heroCardPlayed").length, 3);
}
{
  const { g, h } = setup([cardPlayRules.cardGrowth]);
  random(.3, () => play(g));
  h.triggerPermanentEffects.push({ type: "stat", stat: "atk", mode: "multiply", value: 2, duration: "permanent" });
  g.rebuildHero(h);
  const before = h.atk;
  random(.3, () => play(g));
  assert.equal(h.atk, before + 2, "new flat growth keeps its order relative to earlier multipliers");
}
for (const [i, stat] of ["maxHp", "atk", "lifeSteal", "critChance", "critDamage"].entries()) {
  const { g, h, c } = setup([cardPlayRules.cardGrowth]);
  const before = Object.fromEntries(["maxHp", "atk", "lifeSteal", "critChance", "critDamage"].map(k => [k, h[k]]));
  random((i + .5) / 5, () => play(g));
  for (const key of Object.keys(before)) assert.equal(h[key], before[key] + (key === stat ? cardPlayRules.cardGrowth.effects[0][stat] / (stat === "lifeSteal" ? 100 : 1) : 0), "only chosen stat changes: " + stat);
  g.applyConfig(clone(c));
  assert.equal(h[stat], before[stat] + cardPlayRules.cardGrowth.effects[0][stat] / (stat === "lifeSteal" ? 100 : 1), "growth survives rebuild: " + stat);
  g.phase = "route"; g.chooseDay(g.nextDays()[0]);
  assert.equal(h[stat], before[stat] + cardPlayRules.cardGrowth.effects[0][stat] / (stat === "lifeSteal" ? 100 : 1), "growth survives next day: " + stat);
  if (stat === "critDamage") {
    h.critChance = 100;
    const target = { side: "enemy", x: 5, y: 4, hp: 10000, maxHp: 10000, id: 1000 };
    g.attack(h, target);
    const expected = h.atk * 2.05;
    assert.equal(g.attacks.at(-1).damage, expected);
    h.critDamage = 500;
    g.resolveAttacks(10);
    assert.equal(target.hp, 10000 - Math.round(expected), "critical damage snapshots when attack is launched");
  }
}
{
  const refund = clone(cardPlayRules.cardRefund); refund.effects[0].chance = 100;
  const { g, c, h, events } = setup([refund, refund, cardPlayRules.cardGrowth]);
  let count = g.cards.coffee;
  random(.5, () => play(g));
  assert.equal(g.cards.coffee, count, "refund restores original card, at most once per play across rules");
  assert.equal(h.triggerPermanentEffects.length, 1, "refund does not recursively trigger growth");
  assert.equal(events.filter(e => e.type === "cardRefunded").length, 1);
  play(g, "hero_blue"); assert.equal(g.cards.hero_blue, 1, "hero cards cannot be refunded");
  play(g, "quiver"); assert.equal(g.cards.quiver, undefined, "equipment cannot be refunded");
  g.phase = "battle";
  g.enemies = [{ id: 999, side: "enemy", x: 2, y: 2, hp: 10000, maxHp: 10000 }];
  count = g.cards.fireball;
  assert.ok(g.playCard("fireball", 2, 2));
  assert.equal(g.cards.fireball, count, "battle cards refunded after their effect");
  assert.equal(g.enemies[0].hp, 10000 - c.cards.fireball.effects[0].value, "damage occurs only once");
  c.cards.hero_blue.triggerRules = [clone(cardPlayRules.cardRefund)];
  g.applyConfig(c);
  count = g.cards.coffee;
  random(.1999, () => play(g)); assert.equal(g.cards.coffee, count, "below 20% probability succeeds");
  const afterSuccess = g.cards.coffee;
  random(.2, () => play(g)); assert.equal(g.cards.coffee, afterSuccess - 1, "20% probability boundary");
  c.cards.hero_blue.triggerRules[0].effects[0].chance = 0; g.applyConfig(c);
  random(0, () => play(g)); assert.equal(g.cards.coffee, afterSuccess - 2, "zero chance never refunds");
}
{
  const rule = clone(cardPlayRules.fiveCards);
  rule.trigger.category = "resourceBattle";
  rule.trigger.every = 2;
  rule.effects = [{ type: "generateCard", pool: "selected", category: "all", cards: ["training"], count: 1 }];
  const c = fixture([rule]);
  c.cards.hero_green.triggerRules = [clone(rule)];
  const g = new Game(() => {}, c);
  g.playCard("hero_blue", 5, 5); g.playCard("hero_green", 6, 5);
  play(g, "hero_blue"); play(g, "quiver");
  const count = g.cards.training;
  play(g); assert.equal(g.cards.training, count, "hero/equipment cards excluded by resource/battle filter");
  play(g); assert.equal(g.cards.training, count + 2, "each hero independently counts and generates");
  c.cards.hero_blue.triggerRules[0].enabled = false; g.applyConfig(c);
  play(g); play(g);
  assert.equal(g.cards.training, count + 3, "disabled rules do not trigger");
  const h = g.heroes[1];
  h.destroyed = true;
  play(g); play(g);
  assert.equal(g.cards.training, count + 3, "destroyed hero cannot trigger");
}
{
  const c = fixture(Object.values(cardPlayRules));
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c, "portable configuration");
  for (const mutate of [
    r => r[0].trigger.every = 0,
    r => r[0].trigger.every = 1.5,
    r => r[0].trigger.category = "unknown",
    r => r[1].effects[0].critDamage = -1,
    r => r[1].effects[0].lifeSteal = 101,
    r => r[2].effects[0].chance = 101,
    r => r[2].trigger.event = "battleStart",
  ]) {
    const invalid = clone(c); mutate(invalid.cards.hero_blue.triggerRules);
    assert.throws(() => assertConfig(invalid));
  }
}
console.log("PASS card-play triggers: count/repeat, invalid and generated exclusions, duplicate upgrade, death/day persistence, five random stats, critical snapshots, refund boundaries and portable validation");
