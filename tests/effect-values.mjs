import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
import { assertConfig } from "../src/config/schema.js";
const fixture = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.initial.firstWaveDelay = 0;
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  return c;
};
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
{
  const c = fixture();
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), target: { kind: "allAllies", radius: -1, count: 1 }, effects: [
    { type: "stat", stat: "maxHp", mode: "percent", value: 20, duration: "day" },
    { type: "heal", valueMode: "percent", value: 10 },
    { type: "stat", stat: "atk", mode: "percent", value: 25, duration: "permanent" },
  ] }];
  const g = new Game(() => {}, assertConfig(c));
  g.playCard("hero_blue", 7,3); g.playCard("hero_green", 5,5);
  const before = g.heroes.map(h => ({ hp: h.maxHp, atk: h.atk }));
  for (const h of g.heroes) h.hp = 10;
  g.heroTriggers.start();
  for (let i=0; i<2; i++) {
    near(g.heroes[i].maxHp, before[i].hp * 1.2);
    near(g.heroes[i].hp, 10 + before[i].hp * 1.2 * .1);
    near(g.heroes[i].atk, before[i].atk * 1.25);
  }
  g.applyConfig(structuredClone(c));
  near(g.heroes[0].maxHp, before[0].hp * 1.2);
  near(g.heroes[0].atk, before[0].atk * 1.25);
  for (const h of g.heroes) { h.dayEffects = []; g.rebuildHero(h, false); }
  near(g.heroes[0].maxHp, before[0].hp);
  near(g.heroes[0].atk, before[0].atk * 1.25);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c);
}
{
  const c = fixture(); c.cards.coffee.effects = [{ type: "heal", valueMode: "percent", value: 25 }];
  c.initial.cards.coffee = 3;
  const g = new Game(() => {}, assertConfig(c)); g.playCard("hero_blue", 7,3);
  const h = g.heroes[0]; h.level = 3; g.rebuildHero(h); h.hp = 10;
  g.playCard("coffee", 7,3); near(h.hp, 10 + h.maxHp * .25);
  h.hp = h.maxHp - 1; g.playCard("coffee", 7,3); near(h.hp,h.maxHp);
  assert.equal(g.playCard("coffee", 7,3), false, "full health does not consume healing cards");
  const fixed = structuredClone(c); fixed.cards.coffee.effects[0] = { type: "heal", value: 120 };
  g.applyConfig(fixed); h.hp = 10; g.playCard("coffee", 7,3); near(h.hp,130);
}
{
  const c = fixture(); c.cards.fireball.effects = [{ type: "damage", valueMode: "percent", value: 10, radius: 2 }];
  const g = new Game(() => {}, assertConfig(c)); g.phase = "battle";
  g.enemies = [{ id: 100, side: "enemy", x: 5, y: 5, hp: 200, maxHp: 200 }, { id: 101, side: "enemy", x: 5, y: 6, hp: 1000, maxHp: 1000 }];
  assert.ok(g.playCard("fireball", 5,5));
  assert.deepEqual(g.enemies.map(e => e.hp), [180,900]);
}
for (const effect of [
  { type: "heal", valueMode: "percent", value: 101 },
  { type: "heal", valueMode: "percent", value: -1 },
  { type: "heal", valueMode: "unknown", value: 20 },
  { type: "level", valueMode: "percent", value: 2 },
]) {
  const c = fixture(); c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), effects: [effect] }];
  assert.throws(() => assertConfig(c));
}
console.log("PASS effect values: fixed/percent healing, per-target current max HP, caps, percent stats, duration, live rebuild, percent damage, legacy and portable config");
