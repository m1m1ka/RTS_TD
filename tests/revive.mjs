import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
const revive = { type: "revive", maxRevives: 2, hpPercent: 40 };
const rule = (effects, target = { kind: "self", radius: -1, count: 1 }, event = "sacrifice") => ({ ...newTriggerRule(), trigger: { event, scope: "any", radius: -1 }, target, effects });
function setup(effects = [revive]) {
  const c = structuredClone(DEFAULT_CONFIG); c.initial.firstWaveDelay = 0;
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  c.cards.hero_blue.triggerRules = [rule(effects)];
  const events = [], g = new Game(e => events.push(e), assertConfig(c));
  g.playCard("hero_blue", 4, 4); g.playCard("hero_green", 5, 4);
  return { c, g, events, a: g.heroes[0], b: g.heroes[1] };
}
const kill = (g,h) => g.hit(h, 100000, { side: "enemy" });
const clear = g => { g.spawnQueues.forEach(q => q.spawned = q.types.length); g.enemies = []; g.tick(0); };
{
  const { c, g, a, events } = setup(); g.startDay();
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c);
  a.path = [{ x: 6, y: 4 }]; kill(g,a);
  assert.equal(a.hp, Math.ceil(a.maxHp * .4)); assert.equal(a.reviveUsage.used, 1); assert.deepEqual(a.path, []);
  assert.deepEqual(events.filter(e => ["death", "revive", "heroSacrifice"].includes(e.type)).map(e => e.type), ["death", "revive", "heroSacrifice"]);
  g.applyConfig(structuredClone(c)); kill(g,a);
  assert.equal(a.reviveUsage.used, 2); assert.ok(a.hp > 0);
  kill(g,a); assert.equal(a.hp, 0); assert.equal(a.reviveUsage.used, 2);
  kill(g,a); assert.equal(events.filter(e => e.type === "heroSacrifice").length, 3);
  clear(g); assert.equal(a.hp, 0, "waves do not revive fallen heroes");
  assert.equal(a.reviveUsage.used, 2); kill(g,a); assert.equal(a.hp, 0, "wave changes do not replenish effect charges");
  g.wave = g.dayPlan.waves.length - 1; g.beginWave(); clear(g); g.tick(6);
  g.chooseReward([0]); assert.ok(g.chooseDay(g.nextDays()[0]));
  kill(g,a); assert.ok(a.hp > 0); assert.equal(a.reviveUsage.used, 1, "new day starts a fresh allowance");
}
{
  const { g, a, events } = setup([revive, revive]);
  kill(g,a); assert.equal(a.reviveUsage.used, 1, "duplicate effects cannot spend multiple charges on one death");
  kill(g,a); kill(g,a); assert.equal(a.hp, 0, "all effects share the target hero's allowance");
  assert.equal(events.filter(e => e.type === "revive").length, 2);
}
{
  const { g, a, b } = setup();
  g.config.cards.hero_catgirl.triggerRules = structuredClone(g.config.cards.hero_blue.triggerRules);
  g.cards.hero_catgirl = 1; assert.ok(g.playCard("hero_catgirl", 6, 4)); const twin = g.heroes.at(-1);
  kill(g,a); kill(g,a); kill(g,a); kill(g,twin);
  assert.equal(a.hp, 0); assert.equal(twin.reviveUsage.used, 1, "different heroes with the same revival rules have independent allowances");
  g.cards.legacy = 1; g.playCard("legacy", twin.x, twin.y);
  assert.ok(!g.heroes.includes(twin)); assert.equal(twin.hp, 0);
  assert.equal(twin.reviveUsage.used, 1, "permanent destruction does not spend a revival charge");
  assert.ok(b.hp > 0);
}
{
  const { c, g, a, b } = setup();
  c.cards.hero_blue.triggerRules = [rule([{ type: "stat", stat: "maxHp", mode: "add", value: 100, duration: "day", whileSourceAlive: true }], undefined, "battleStart"), rule([revive])];
  g.applyConfig(c); g.startDay(); const max = a.maxHp;
  kill(g,a); assert.equal(a.maxHp, max); assert.equal(a.hp, Math.ceil(max * .4), "revival percent uses restored source-bound health");
  assert.equal(b.maxHp, c.cards.hero_green.unit.maxHp);
}
{
  const { c, g, a, b } = setup();
  c.cards.hero_blue.triggerRules = [rule([revive], { kind: "nearest", radius: 1, count: 1 }, "battleStart")];
  g.applyConfig(c); b.hp = 0; Object.assign(a, { x: b.x, y: b.y });
  g.heroTriggers.resolve(a, "battleStart");
  assert.equal(b.hp, Math.ceil(b.maxHp * .4)); assert.equal(b.reviveUsage.used, 1);
  assert.notDeepEqual({ x: a.x, y: a.y }, { x: b.x, y: b.y }, "occupied revival cell relocates safely");
  g.heroTriggers.resolve(a, "battleStart"); assert.equal(b.reviveUsage.used, 1, "living targets do not consume charges");
}
{
  const { c, g, a } = setup();
  c.cards.hero_blue.triggerRules.push(rule([{ type: "level", value: 1 }], undefined, "victory"));
  g.applyConfig(c); g.startDay(); kill(g,a);
  g.wave = g.dayPlan.waves.length - 1; g.beginWave(); clear(g);
  assert.equal(a.level, 2, "effect revival before victory restores eligibility");
}
for (const patch of [{ maxRevives: 0 }, { maxRevives: 1.5 }, { maxRevives: 100 }, { hpPercent: 0 }, { hpPercent: 101 }]) {
  const { c } = setup(); c.cards.hero_blue.triggerRules[0].effects = [{ ...revive, ...patch }];
  assert.throws(() => assertConfig(c));
}
console.log("PASS revival: daily charges, no wave/hot-save refill, one spend per death, independent heroes, permanent destruction, max-health buffs, occupied cells, ally revival, victory eligibility and validation");
