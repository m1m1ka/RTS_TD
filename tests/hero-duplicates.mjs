import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { Game } from "../src/game.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";

const c = structuredClone(DEFAULT_CONFIG);
c.initial.cards = { hero_blue: 5, hero_green: 1, guard: 1 };
for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
c.cards.hero_blue.effects = [{ type: "level", value: 1 }, { type: "generateCard", pool: "selected", category: "resource", cards: ["training"], count: 2 }];
c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), trigger: { event: "preparation", scope: "self", radius: -1 }, effects: [{ type: "summonFollower", count: 1, hpPercent: 50, atkPercent: 50 }] }];
const events = [], g = new Game(e => events.push(e), c);
assert.ok(g.playCard("hero_blue", 7, 3));
assert.ok(g.playCard("hero_green", 5, 5));
const hero = g.heroes[0], other = g.heroes[1], follower = g.followers[0];
assert.equal(hero.level, 2);
assert.equal(g.cards.training, 2);
assert.ok(g.playCard("guard", hero.x, hero.y));
hero.hp = hero.maxHp / 2;
const equipment = [...hero.equipment], before = g.cards.hero_blue;
for (const [x, y] of [[8, 6], [other.x, other.y], [follower.x, follower.y], [-1, 4]]) {
  assert.equal(g.cardTarget("hero_blue", x, y).valid, false);
  assert.equal(g.playCard("hero_blue", x, y), false);
  assert.equal(g.cards.hero_blue, before);
}
for (const phase of ["ready", "waiting", "battle", "between"]) {
  g.phase = phase;
  const level = hero.level, count = g.cards.hero_blue;
  assert.equal(g.cardTarget("hero_blue", hero.x, hero.y).upgradeHero, true);
  assert.ok(g.playCard("hero_blue", hero.x, hero.y));
  assert.equal(hero.level, level + 3);
  assert.equal(g.cards.hero_blue || 0, count - 1);
  assert.equal(g.heroes.length, 2);
  assert.deepEqual(hero.equipment, equipment);
  assert.equal(hero.hp, hero.maxHp / 2, "upgrading preserves health ratio");
  assert.equal(g.cards.training, 2, "duplicate cards do not replay on-deploy generation");
  assert.equal(g.followers.length, 1, "no extra preparation summons");
}
assert.equal(g.cards.hero_blue, undefined);
assert.equal(g.playCard("hero_blue", hero.x, hero.y), false);
assert.equal(events.filter(e => e.type === "deploy").length, 2);
assert.equal(events.filter(e => e.type === "upgrade" && e.levels === 3).length, 4);
g.cards.hero_blue = 1;
for (const phase of ["shop", "reward", "route", "won", "lost"]) {
  g.phase = phase;
  assert.equal(g.playCard("hero_blue", hero.x, hero.y), false);
  assert.equal(g.cards.hero_blue, 1);
}
g.phase = "ready";
hero.hp = 0;
assert.equal(g.playCard("hero_blue", 8, 6), false, "dead heroes still occupy their deployment slot");
assert.equal(g.playCard("hero_blue", hero.x, hero.y), false, "duplicates cannot revive");
assert.equal(g.cards.hero_blue, 1);
hero.destroyed = true;
g.heroes = g.heroes.filter(h => h !== hero);
g.removeFollowers(hero.id);
assert.ok(g.playCard("hero_blue", 8, 6), "permanent destruction frees the hero slot");
assert.equal(g.heroes.at(-1).level, 2, "replacement is a fresh hero with initial effects");
console.log("PASS duplicate heroes: unique deployment, matching targets, +3 levels, exact consumption, invalid phases, death/destruction, health/equipment and no repeated deployment effects");
