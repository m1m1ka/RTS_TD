import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const stat = (stat, value, extra = {}) => ({ type: "stat", stat, value, mode: "add", duration: "day", whileSourceAlive: true, ...extra });
const config = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.initial.firstWaveDelay = 0;
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  return c;
};
const rule = effects => ({ ...newTriggerRule(), target: { kind: "allAllies", radius: -1, count: 1 }, effects });
const deploy = c => {
  const g = new Game(() => {}, c);
  for (const [key, x, y] of [["hero_blue", 7, 3], ["hero_green", 5, 5], ["hero_purple", 9, 5]]) assert.ok(g.playCard(key, x, y));
  return g;
};
{
  const c = config(), r = rule([stat("atk", 10)]);
  r.target.kind = "alliesWithFollowers"; c.cards.hero_blue.triggerRules = [r];
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c);
  const g = deploy(c), [a, b, d] = g.heroes;
  const select = radius => g.heroTriggers.targets(a, a, { ...r.target, radius });
  assert.deepEqual(select(-1), []);
  g.summonFollowers(a, { hpPercent: 50, atkPercent: 50, count: 2 });
  g.summonFollowers(b, { hpPercent: 50, atkPercent: 50, count: 1 });
  assert.deepEqual(select(-1), [a, b], "includes self, once even with multiple followers");
  assert.deepEqual(select(0), [a]); assert.deepEqual(select(3), [a]); assert.deepEqual(select(4), [a, b]);
  g.followers.filter(f => f.ownerId === b.id).forEach(f => f.hp = 0);
  assert.deepEqual(select(-1), [a], "dead followers do not qualify before cleanup");
  const before = g.heroes.map(h => h.atk); g.startDay();
  near(a.atk, before[0] + 10); near(b.atk, before[1]); near(d.atk, before[2]);
  g.removeFollowers(a.id); g.tick(0);
  near(a.atk, before[0] + 10, "selection is made on activation, not a continuous follower aura");
  a.hp = 0; assert.deepEqual(select(-1), []);
}
{
  const c = config();
  c.cards.hero_blue.triggerRules = [rule([stat("atk", 10), stat("maxHp", 100), stat("lifeSteal", .9)])];
  c.cards.hero_green.triggerRules = [rule([stat("atk", 50, { mode: "percent" }), stat("atk", 3, { whileSourceAlive: false })])];
  const g = deploy(c), [a, b, d] = g.heroes, base = d.atk, max = d.maxHp;
  g.cards.vampire = 1; assert.ok(g.playCard("vampire", d.x, d.y));
  g.startDay(); near(d.atk, (base + 10) * 1.5 + 3); near(d.lifeSteal, .95);
  near(d.maxHp, max + 100); d.hp = d.maxHp;
  g.hit(a, 100000, { side: "enemy" });
  near(d.atk, base * 1.5 + 3); near(d.lifeSteal, .15); near(d.maxHp, max); near(d.hp, max);
  assert.equal(a.hp, 0, "removing self max-health buffs cannot revive the source");
  g.applyConfig(structuredClone(c)); near(d.atk, base * 1.5 + 3);
  const count = d.dayEffects.length;
  a.hp = 1; g.tick(0); near(d.atk, (base + 10) * 1.5 + 3);
  near(d.hp, max, "reactivation does not grant a free heal"); assert.equal(d.dayEffects.length, count);
  g.hit(b, 100000, { side: "enemy" }); near(d.atk, base + 10 + 3);
  g.hit(a, 100000, { side: "enemy" }); near(d.atk, base + 3);
  // Both sources revive before wave healing; daily effects survive intermediate waves.
  g.spawnQueues.forEach(q => q.spawned = q.types.length); g.enemies = []; g.tick(0);
  assert.equal(g.phase, "waiting"); near(d.atk, (base + 10) * 1.5 + 3);
  near(a.hp, a.maxHp * c.initial.reviveHp);
  g.wave = g.dayPlan.waves.length - 1; g.beginWave();
  g.spawnQueues.forEach(q => q.spawned = q.types.length); g.enemies = []; g.tick(0);
  assert.equal(g.phase, "victory"); near(d.atk, base); near(d.lifeSteal, .15);
}
{
  const c = config();
  c.cards.hero_blue.triggerRules = [rule([stat("rate", 2, { mode: "multiply", duration: "permanent" })])];
  c.cards.hero_catgirl.triggerRules = structuredClone(c.cards.hero_blue.triggerRules);
  const g = deploy(c), [a, , d] = g.heroes, base = d.rate;
  g.cards.hero_catgirl = 1; assert.ok(g.playCard("hero_catgirl", 6, 4));
  const second = g.heroes.at(-1); g.startDay(); near(d.rate, base * 4);
  g.hit(a, 100000, { side: "enemy" }); near(d.rate, base * 2, "independent heroes retain independent source effects");
  g.cards.legacy = 1; assert.ok(g.playCard("legacy", second.x, second.y));
  near(d.rate, base, "sacrificing a source revokes its effects immediately");
  a.hp = 1; g.tick(0); near(d.rate, base * 2);
  g.heroes = g.heroes.filter(h => h !== a); g.heroReserve.push(a); g.tick(0);
  near(d.rate, base, "off-field heroes do not provide bonuses");
  g.heroes.push(g.heroReserve.pop()); g.tick(0); near(d.rate, base * 2);
  for (const h of g.heroes) h.dayEffects = [];
  g.applyConfig(structuredClone(c)); near(d.rate, base * 2, "permanent source-bound effects survive rebuilds");
}
for (const invalid of ["yes", 1, null]) {
  const c = config(); c.cards.hero_blue.triggerRules = [rule([stat("atk", 10, { whileSourceAlive: invalid })])];
  assert.ok(validateConfig(c).length);
}
{
  const c = config(); c.cards.hero_blue.triggerRules = [rule([{ type: "heal", value: 10, whileSourceAlive: true }])];
  assert.ok(validateConfig(c).length, "instant effects cannot pretend to be reversible");
}
console.log("PASS source buffs: live follower targets, ranges, source death/revival/removal, independent copies, capped and percentage stacks, gear, max HP, expiry, hot reload and portable validation");
