import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const config = (defaults = false) => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.initial.firstWaveDelay = 0;
  if (!defaults) for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  return c;
};
const deploy = (c, events = []) => {
  const g = new Game(e => events.push(e), c);
  for (const [key, x, y] of [["hero_blue", 7, 3], ["hero_green", 5, 5], ["hero_purple", 9, 5]])
    assert.ok(g.playCard(key, x, y));
  return g;
};
const clearWave = (g) => {
  for (const q of g.spawnQueues) q.spawned = q.types.length;
  g.enemies = [];
  g.tick(0.025);
};
{
  const c = config(true), events = [], g = deploy(c, events), [a, b, mage] = g.heroes;
  const baseSpeed = a.speed, baseRate = b.rate;
  g.startDay();
  assert.equal(a.level, 3, "normal start and mage echo each level the nearest hero once");
  near(a.speed, baseSpeed + 2);
  near(b.rate, baseRate + 0.2);
  near(a.rate, c.cards.hero_blue.unit.rate + 0.2);
  assert.deepEqual(events.filter(e => e.type === "heroBattleStart").map(e => e.unit.id), [a.id, b.id, mage.id, a.id]);
  g.startDay();
  assert.equal(a.level, 3, "repeated start while already in the day does nothing");
  const appliedSpeed = a.speed, appliedRate = a.rate;
  g.applyConfig(structuredClone(c));
  g.applyConfig(structuredClone(c));
  near(a.speed, appliedSpeed);
  near(a.rate, appliedRate);
  const revised = structuredClone(c);
  revised.cards.hero_blue.triggerRules[0].effects[0].value = 2;
  g.applyConfig(revised);
  assert.equal(a.level, 3, "saving changes does not retroactively replay start effects");
  clearWave(g);
  assert.equal(g.phase, "waiting");
  assert.equal(a.level, 3, "automatic next wave does not trigger battle start");
  near(a.speed, appliedSpeed);
  g.beginWave();
  clearWave(g);
  if (g.phase === "victory") g.tick(6);
  assert.equal(g.phase, "reward");
  near(a.speed, appliedSpeed);
  near(b.rate, baseRate + .2);
  assert.equal(a.level, 3, "victory keeps current-day buffs and levels");
  g.chooseReward([0]);
  g.chooseDay(g.nextDays()[0]);
  near(a.speed, baseSpeed);
  near(b.rate, baseRate);
  g.startDay();
  assert.equal(a.level, 7, "next click uses the edited rules, including echo");
  near(a.speed, baseSpeed + 2, "daily movement gain starts afresh");
}
{
  const c = config();
  c.cards.hero_green.triggerRules = [{ ...newTriggerRule(),
    target: { kind: "selfAndNearest", radius: 1, count: 1 },
    effects: [{ type: "stat", stat: "rate", mode: "multiply", value: 1.5, duration: "day" }],
  }];
  const g = deploy(c), [a, b, mage] = g.heroes;
  Object.assign(a, { x: 5, y: 4 });
  Object.assign(mage, { x: 6, y: 5 });
  const aRate = a.rate, bRate = b.rate, mageRate = mage.rate;
  g.startDay();
  near(a.rate, aRate * 1.5);
  near(b.rate, bRate * 1.5);
  near(mage.rate, mageRate); // Same distance, earlier deployed hero wins the tie.
}
{
  const c = config();
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(),
    trigger: { event: "heroBattleStart", scope: "others", radius: 1 },
    target: { kind: "eventHero", radius: 1, count: 1 },
    effects: [{ type: "stat", stat: "speed", mode: "add", value: 0.5, duration: "day" }],
  }];
  c.cards.hero_green.triggerRules = [newTriggerRule()];
  c.cards.hero_purple.triggerRules = [newTriggerRule()];
  const g = deploy(c), [a, b, mage] = g.heroes;
  Object.assign(a, { x: 5, y: 4 });
  const base = b.speed;
  g.startDay();
  near(b.speed, base + 0.5);
  near(a.speed, base);
  near(mage.speed, base);
  assert.equal(b.level, 2);
}
{
  const c = config(), rule = newTriggerRule();
  rule.target = { kind: "allAllies", radius: -1, count: 1 };
  rule.effects = [{ type: "triggerBattleStart" }];
  for (const key of ["hero_blue", "hero_green", "hero_purple"]) c.cards[key].triggerRules = [rule];
  const events = [], g = deploy(c, events);
  g.startDay();
  assert.equal(events.filter(e => e.type === "heroBattleStart").length, 9, "branching and cyclic echoes terminate, once per hero per root cascade");
  assert.equal(g.phase, "battle");
}
{
  const c = config(true), g = deploy(c);
  g.heroes[0].hp = 0;
  g.heroes[1].hp = 0;
  g.startDay();
  assert.equal(g.heroes[0].level, 3, "heroes revive before receiving start effects and echoes");
  g.cards.hero_catgirl = 1;
  assert.ok(g.playCard("hero_catgirl", 6, 4));
  assert.equal(g.heroes.at(-1).level, 1, "late deployment waits for the next start click");
}
{
  const c = config();
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), effects: [
    { type: "level", value: 1 }, { type: "heal", value: 20 },
    { type: "stat", stat: "atk", mode: "add", value: 7, duration: "permanent" },
  ] }];
  const g = deploy(c), a = g.heroes[0];
  a.hp -= 150;
  g.startDay();
  assert.equal(a.level, 2);
  near(a.hp, a.maxHp);
  near(a.atk, 36 + 12 + 7);
  g.wave = g.dayPlan.waves.length - 1;
  g.beginWave(); clearWave(g);
  near(a.atk, 36 + 12 + 7);
}
{
  const c = config(true);
  delete c.cards.hero_blue.triggerRules;
  c.cards.hero_green.triggerRules = [];
  const migrated = assertConfig(c);
  assert.equal(migrated.cards.hero_blue.triggerRules.length, 2);
  assert.deepEqual(migrated.cards.hero_green.triggerRules, [], "explicitly disabled rules survive migration");
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))), migrated);
}
{
  const c = config(), events = [];
  const rule = { ...newTriggerRule(), target: { kind: "randomAllies", radius: -1, count: 2 },
    effects: [{ type: "level", value: 1 }, { type: "stat", stat: "atk", mode: "add", value: 7, duration: "day" }] };
  c.cards.hero_blue.triggerRules = [rule];
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c, "random targets survive portable config");
  const g = deploy(c, events), [a, b, mage] = g.heroes, order = g.heroes.map(h => h.id);
  const random = Math.random;
  try {
    Math.random = () => .9999;
    const chosen = g.heroTriggers.targets(a, a, rule.target);
    assert.deepEqual(chosen, [mage, a], "whole-field selection includes self and distant heroes");
    assert.equal(new Set(chosen).size, 2);
    Math.random = () => 0;
    assert.deepEqual(g.heroTriggers.targets(a, a, rule.target), [a, b], "each trigger can select a new group");
    assert.deepEqual(g.heroTriggers.targets(a, a, { ...rule.target, radius: 0 }), [a]);
    mage.hp = 0;
    g.towers.push({ id: 100, x: a.x, y: a.y + 1, hp: 100 });
    assert.deepEqual(g.heroTriggers.targets(a, a, { ...rule.target, count: 20 }), [a, b], "only living heroes; shortages use all eligible heroes");
    b.hp = 0; a.hp = 0;
    assert.deepEqual(g.heroTriggers.targets(a, a, rule.target), []);
    for (const h of g.heroes) h.hp = h.maxHp;
    g.towers = [];
    const before = g.heroes.map(h => h.atk);
    g.startDay();
    assert.deepEqual(g.heroes.map(h => h.level), [2, 2, 1]);
    const affected = events.filter(e => e.type === "triggerEffect");
    assert.deepEqual(affected.filter(e => e.effect.type === "level").map(e => e.unit.id), affected.filter(e => e.effect.type === "stat").map(e => e.unit.id), "all payloads share one draw");
    near(mage.atk, before[2]);
    assert.deepEqual(g.heroes.map(h => h.id), order, "sampling must not reorder heroes");
  } finally { Math.random = random; }
}
for (const duration of ["day", "permanent"]) {
  const c = config();
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), effects: [
    { type: "stat", stat: "lifeSteal", mode: "add", value: .1, duration },
  ] }];
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c);
  const g = deploy(c), a = g.heroes[0];
  g.cards.vampire = 1; assert.ok(g.playCard("vampire", a.x, a.y));
  near(a.lifeSteal, .15);
  g.startDay(); near(a.lifeSteal, .25);
  g.applyConfig(structuredClone(c)); near(a.lifeSteal, .25, "saving must not stack absorption");
  a.hp = 100;
  g.hit({ id: 999, side: "enemy", hp: 20, maxHp: 20 }, 200, a);
  near(a.hp, 105, "lifesteal uses actual damage rather than overkill");
  g.wave = g.dayPlan.waves.length - 1; g.beginWave(); clearWave(g);
  const retained = duration === "day" ? .15 : .25;
  near(a.lifeSteal, .25, "victory retains today's lifesteal bonus until the next day");
  g.tick(6); g.chooseReward([0]); g.chooseDay(g.nextDays()[0]);
  assert.equal(g.heroes[0], a); near(a.lifeSteal, retained);
  g.applyUnitEffect(a, { type: "stat", stat: "lifeSteal", mode: "multiply", value: 2 });
  near(a.lifeSteal, retained * 2);
  g.applyUnitEffect(a, { type: "stat", stat: "lifeSteal", mode: "add", value: .95 });
  near(a.lifeSteal, .95, "combined lifesteal keeps the existing cap");
}
for (const mutate of [
  r => r.trigger.event = "unknown", r => r.trigger.scope = "enemy",
  r => r.trigger.radius = -2, r => r.target.radius = 0.5,
  r => r.target.count = 0, r => r.target.kind = "unknown",
  r => r.enabled = "yes", r => r.effects = [],
  r => r.effects = [{ type: "stat", stat: "speed", mode: "add", value: 0.5, duration: "unknown" }],
  r => r.effects = [{ type: "stat", stat: "lifeSteal", mode: "add", value: 10, duration: "day" }],
]) {
  const c = config(); c.cards.hero_blue.triggerRules = [newTriggerRule()];
  mutate(c.cards.hero_blue.triggerRules[0]);
  assert.ok(validateConfig(c).length);
  assert.throws(() => assertConfig(c));
}
console.log("PASS triggers: start click, levels, target range/ties, rate buffs, event listeners, echo recursion, day expiration, persistence, hot edits, migration, validation");
