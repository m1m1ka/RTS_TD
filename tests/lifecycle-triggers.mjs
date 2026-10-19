import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
import { assertConfig } from "../src/config/schema.js";
const level = { type: "level", value: 1 };
const card = { type: "generateCard", pool: "selected", category: "resource", cards: ["training"], count: 1 };
const rule = (event, effects, target = { kind: "self", radius: -1, count: 1 }) => ({ ...newTriggerRule(), trigger: { event, scope: "any", radius: -1 }, target, effects });
const config = () => {
  const c = structuredClone(DEFAULT_CONFIG); c.initial.firstWaveDelay = 0;
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  return c;
};
const deploy = c => {
  const events = [], g = new Game(e => events.push(e), assertConfig(c));
  assert.ok(g.playCard("hero_blue", 4, 4)); assert.ok(g.playCard("hero_green", 5, 4));
  return { g, events, a: g.heroes[0], b: g.heroes[1] };
};
const clear = g => { g.spawnQueues.forEach(q => q.spawned = q.types.length); g.enemies = []; g.tick(0); };
const kill = (g, h) => g.hit(h, 100000, { side: "enemy" });
{
  const c = config();
  c.cards.hero_blue.triggerRules = [rule("sacrifice", [card, level, { type: "heal", value: 100 }]),
    rule("sacrifice", [level, { type: "triggerPreparation" }], { kind: "nearest", radius: 1, count: 1 }),
    { ...rule("sacrifice", [{ type: "level", value: 90 }]), enabled: false }];
  c.cards.hero_green.triggerRules = [rule("preparation", [level])];
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c);
  const { g, a, b, events } = deploy(c), initialCards = g.cards.training, bLevel = b.level;
  g.startDay(); g.hit(a, 1, { side: "enemy" }); assert.equal(a.level, 1);
  kill(g, a);
  assert.equal(a.hp, 0, "self healing and upgrade healing cannot cancel death");
  assert.equal(a.level, 2); assert.equal(b.level, bLevel + 2, "death can target a living neighbor and echo preparation");
  assert.equal(g.cards.training, initialCards + 1);
  assert.equal(events.filter(e => e.type === "heroSacrifice").length, 1);
  assert.equal(events.filter(e => e.type === "heroBattleStart").length, 0, "death must not masquerade as battle start");
  kill(g, a); g.applyConfig(structuredClone(c)); assert.equal(g.cards.training, initialCards + 1);
  clear(g); assert.equal(a.hp, 0); assert.equal(g.phase, "waiting");
  assert.ok(g.reviveHero(a,{maxRevives:1,hpPercent:50},b), "explicit revival skills still work between waves");
  kill(g, a); assert.equal(a.level, 3); assert.equal(g.cards.training, initialCards + 2, "a new death after revival triggers again");
}
{
  const c = config(); c.cards.hero_blue.triggerRules = [rule("sacrifice", [card])];
  const { g, a, events } = deploy(c), before = g.cards.training;
  const [f] = g.summonFollowers(a, { count: 1, hpPercent: 50, atkPercent: 50 });
  kill(g, f); assert.equal(g.cards.training, before, "follower death does not trigger owner sacrifice");
  g.cards.legacy = 1; assert.ok(g.playCard("legacy", a.x, a.y));
  assert.equal(g.cards.training, before + 1); assert.ok(!g.heroes.includes(a));
  assert.equal(events.filter(e => e.type === "heroSacrifice").length, 1, "resource destruction triggers once before removal");
}
{
  const c = config();
  for (const key of ["hero_blue", "hero_green"]) c.cards[key].triggerRules = [rule("victory", [level, card,
    { type: "stat", stat: "rate", mode: "add", value: .3, duration: "permanent" },
    { type: "stat", stat: "speed", mode: "add", value: 2, duration: "day" }])];
  const { g, a, b, events } = deploy(c), before = g.cards.training, rate = a.rate, speed = a.speed;
  g.startDay(); kill(g, a); clear(g);
  assert.equal(a.level, 1); assert.equal(g.cards.training, before, "intermediate waves do not count as victory");
  assert.equal(a.hp, 0, "no automatic revival between waves");
  assert.ok(g.reviveHero(a,{maxRevives:1,hpPercent:50},b), "explicit revival restores victory eligibility");
  g.wave = g.dayPlan.waves.length - 1; g.beginWave(); kill(g, b); clear(g);
  assert.equal(g.phase, "victory"); assert.equal(a.level, 2); assert.equal(b.level, 1);
  assert.equal(b.hp, 0, "fallen heroes remain dead through victory");
  assert.equal(g.cards.training, before + 1); assert.equal(a.rate, rate + .3); assert.equal(a.speed, speed + 2);
  assert.deepEqual(events.filter(e => e.type === "heroVictory").map(e => e.unit.id), [a.id]);
  assert.equal(events.filter(e => e.type === "heroBattleStart").length, 0);
  g.tick(6); g.tick(6); g.applyConfig(structuredClone(c)); assert.equal(a.level, 2);
  assert.equal(events.filter(e => e.type === "heroVictory").length, 1, "settlement, rewards and hot reload cannot replay victory");
}
{
  const c = config(); c.cards.hero_blue.triggerRules = [rule("victory", [card])];
  const { g, a, b, events } = deploy(c), before = g.cards.training;
  g.startDay(); g.wave = g.dayPlan.waves.length - 1; g.beginWave(); kill(g, a); kill(g, b); clear(g);
  assert.equal(g.phase, "victory"); assert.equal(g.cards.training, before);
  assert.equal(events.filter(e => e.type === "heroVictory").length, 0);
}
for (const phase of ["lost", "shop"]) {
  const c = config(); c.cards.hero_blue.triggerRules = [rule("victory", [card])];
  const { g, events } = deploy(c), before = g.cards.training;
  if (phase === "lost") { g.startDay(); g.baseHp = 0; clear(g); }
  else { g.phase = "shop"; g.tick(1); }
  assert.equal(g.phase, phase); assert.equal(g.cards.training, before);
  assert.equal(events.filter(e => e.type === "heroVictory").length, 0);
}
console.log("PASS lifecycle triggers: death once per life, destruction, dead-self safety, nearest/echo composition, follower exclusion, final-day survivors before revival, daily/permanent effects, repeat guards, defeat/shop exclusion, portable config");
