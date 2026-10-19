import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { enterShop } from "../src/shop.js";
import { fusionOptions } from "../src/skill-cards.js";
import { cardPlayRules } from "../src/config/trigger-rules.js";
const fixture = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.initial.cards = { hero_blue: 1, fireball: 9, frost: 1 };
  c.days[0].obstacles = []; c.days[0].mines = [];
  c.cards.fireball.cooldown = 4;
  c.cards.fireball.skillTiers = [
    { cooldown: 3, effects: [{ type: "damage", value: 700, radius: 2 }] },
    { cooldown: 2, effects: [{ type: "damage", valueMode: "percent", value: 50, radius: 3 }] },
  ];
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  return assertConfig(c);
};
const target = (x = 5) => ({ id: 999 + x, side: "enemy", x, y: 3, hp: 10000, maxHp: 10000 });
{
  const g = new Game(() => {}, fixture()), copies = g.skillCards.filter(c => c.cardId === "fireball");
  g.phase = "battle"; const enemy = target(); g.enemies = [enemy];
  const damage = g.config.cards.fireball.effects[0].value;
  assert.equal(g.playCard("fireball", 1, 1, copies[0].id), false);
  assert.equal(copies[0].readyAt, 0, "invalid target does not start cooldown");
  assert.ok(g.playCard("fireball", 5, 3, copies[0].id));
  assert.equal(g.cards.fireball, 9); assert.equal(enemy.hp, 10000 - damage);
  assert.equal(g.playCard("fireball", 5, 3, copies[0].id), false, "cannot fall back to a different copy");
  assert.equal(g.playCard("fireball", 5, 3, "skill-missing"), false);
  assert.ok(g.playCard("fireball", 5, 3, copies[1].id));
  assert.equal(copies[2].readyAt, 0);
  g.phase = "between"; g.tick(3.9); g.phase = "battle";
  assert.equal(g.playCard("fireball", 5, 3, copies[0].id), false);
  g.phase = "between"; g.tick(.1); g.phase = "battle";
  assert.ok(g.playCard("fireball", 5, 3, copies[0].id));
  const readyAt = copies[0].readyAt;
  const hot = structuredClone(g.config); hot.cards.fireball.cooldown = 8; g.applyConfig(hot);
  assert.equal(copies[0].readyAt, readyAt, "hot save preserves running cooldown");
  for (const phase of ["shop", "reward", "route"]) { g.phase = phase; const time = g.time; g.tick(100); assert.equal(g.time, time); }
  g.phase = "route"; g.chooseDay(g.nextDays()[0]);
  assert.equal(copies[0].readyAt, readyAt, "wave/day transitions never recreate skill copies");
  g.generateCards({ pool: "selected", cards: ["fireball"], count: 1 });
  const after = g.syncSkillCards().filter(c => c.cardId === "fireball");
  assert.equal(after.length, 10); assert.equal(after[0], copies[0]); assert.equal(after.at(-1).readyAt, 0);
}
{
  const g = new Game(() => {}, fixture());
  const first = g.skillCards[0]; first.readyAt = 20;
  assert.equal(g.fuseSkillCards("fireball", 1), false, "shop only");
  enterShop(g); const gold = g.gold;
  g.shop.opening = {}; assert.equal(g.fuseSkillCards("fireball", 1), false); g.shop.opening = null;
  assert.equal(g.fuseSkillCards("fireball", 1.5), false);
  assert.ok(g.fuseSkillCards("fireball", 1));
  let upgraded = g.skillCards.find(c => c.tier === 2);
  assert.equal(upgraded.readyAt, 20, "fusion preserves longest material cooldown");
  assert.equal(g.cards.fireball, 7); assert.equal(g.gold, gold);
  assert.equal(g.fuseSkillCards("fireball", 2), false, "mixed tiers cannot fuse");
  assert.equal(g.fuseSkillCards("frost", 1), false, "different names cannot fuse");
  assert.ok(g.fuseSkillCards("fireball", 1)); assert.ok(g.fuseSkillCards("fireball", 1));
  assert.equal(g.fuseSkillCards("fireball", 1), false, "stale/double click cannot overspend");
  g.phase = "between"; g.tick(20); g.phase = "battle";
  const enemy = target(7); g.enemies = [enemy];
  assert.ok(g.playCard("fireball", 5, 3, upgraded.id), "upgraded radius is used for targeting");
  assert.equal(enemy.hp, 9300); assert.equal(upgraded.readyAt, 23);
  enterShop(g); assert.ok(g.fuseSkillCards("fireball", 2));
  assert.equal(g.cards.fireball, 1); upgraded = g.skillCards.find(c => c.tier === 3);
  assert.equal(g.fuseSkillCards("fireball", 3), false); assert.ok(fusionOptions(g).find(c => c.cardId === "fireball").maxed);
  g.phase = "between"; g.tick(3); g.phase = "battle"; enemy.hp = 10000;
  assert.ok(g.playCard("fireball", 4, 3, upgraded.id)); assert.equal(enemy.hp, 5000, "tier percent damage applies");
  const hot = structuredClone(g.config); hot.cards.fireball.skillTiers.pop(); g.applyConfig(hot);
  assert.equal(upgraded.tier, 2); assert.equal(upgraded.readyAt, 25);
  hot.cards.fireball.temporary = true; g.applyConfig(hot); g.clearTemporaryCards();
  assert.equal(g.skillCards.some(c => c.cardId === "fireball"), false);
  g.reset(); assert.ok(g.skillCards.every(c => c.tier === 1 && c.readyAt === 0));
}
{
  const c = fixture(), rule = structuredClone(cardPlayRules.cardRefund); rule.effects[0].chance = 100;
  c.cards.hero_blue.triggerRules = [rule, structuredClone(rule)];
  const g = new Game(() => {}, c); g.playCard("hero_blue", 4, 3); enterShop(g); g.fuseSkillCards("fireball", 1);
  const copy = g.skillCards.find(c => c.tier === 2); g.phase = "battle"; g.enemies = [target()];
  assert.ok(g.playCard("fireball", 5, 3, copy.id));
  assert.equal(copy.readyAt, g.time); assert.equal(copy.tier, 2); assert.equal(g.cards.fireball, 7);
  assert.ok(g.playCard("fireball", 5, 3, copy.id), "refund allows immediate reuse of exactly this copy");
}
{
  const c = fixture(); delete c.cards.fireball.cooldown; delete c.cards.fireball.skillTiers;
  const migrated = assertConfig(c); assert.equal(migrated.cards.fireball.cooldown, 12);
  assert.equal(migrated.cards.fireball.skillTiers[0].effects[0].value, c.cards.fireball.effects[0].value * 3);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))), migrated);
  for (const mutate of [
    c => c.cards.fireball.cooldown = 0,
    c => c.cards.fireball.skillTiers = {},
    c => c.cards.fireball.skillTiers[0].cooldown = -1,
    c => c.cards.fireball.skillTiers[0].effects = [],
    c => c.cards.fireball.skillTiers[0].effects[0].value = NaN,
    c => c.cards.fireball.skillTiers[0].effects[0].type = "heal",
  ]) { const invalid = fixture(); mutate(invalid); assert.throws(() => assertConfig(invalid)); }
}
console.log("PASS reusable skill cards: independent cooldown, invalid targets, timing, acquisition, hot edits, day persistence, atomic fusion, tiers/radius/damage, refund, temporary cleanup and configuration validation");
