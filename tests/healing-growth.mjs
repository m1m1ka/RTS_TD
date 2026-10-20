import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { selectAttackModule } from "../src/attack-modules.js";
import { levelStats } from "../src/level-stats.js";
import { healingRoute } from "../src/healing-behavior.js";
import { withinFollowerArea } from "../src/followers.js";
import { rankedHeroCard } from "../src/hero-ranks.js";

const fixture = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.initial.cards = { hero_blue: 1, hero_green: 1 };
  c.initial.firstWaveDelay = 0;
  for (const card of Object.values(c.cards)) if (card.category === "hero") { card.triggerRules = []; card.effects = []; }
  const card = c.cards.hero_blue;
  selectAttackModule(card.unit, "heal");
  Object.assign(card.unit, { atk: 30, range: 1, rate: 1, levelGrowth: { maxHp: 10, atk: 2 }, healing: { targets: "heroes", valueMode: "fixed", value: 15 } });
  c.days[0].obstacles = []; c.days[0].mines = [];
  c.days[0].waves = [{ id: "healing", name: "治疗", startDelay: 0, hpScale: 1, atkScale: 1, spawns: [{ x: 14, y: 5, delay: 1000, interval: 1, enemies: [{ type: "grunt", count: 1, level: 1 }] }] }];
  const events = [], g = new Game(e => events.push(e), c);
  g.chooseInitialHand(["hero_blue", "hero_green"].map(key => g.initialHandOptions.indexOf(key)));
  assert.ok(g.playCard("hero_blue", 5, 4));
  assert.ok(g.playCard("hero_green", 10, 8));
  return { g, c, events, owner: g.heroes[0], ally: g.heroes[1] };
};
{
  const { g, c, owner } = fixture();
  owner.level = 5; g.rebuildHero(owner);
  assert.equal(owner.healing.value, 23);
  assert.equal(owner.atk, 30, "healing growth replaces attack growth");
  assert.equal(owner.rate, 1);
  g.rebuildHero(owner); assert.equal(owner.healing.value, 23, "rebuilding does not stack growth");
  const edited = structuredClone(c); edited.cards.hero_blue.unit.levelGrowth.atk = 3;
  g.applyConfig(edited); assert.equal(owner.healing.value, 27, "live growth edits rebuild treatment");
  selectAttackModule(edited.cards.hero_blue.unit, "slash");
  g.applyConfig(structuredClone(edited));
  assert.equal(owner.atk, 42); assert.equal(owner.healing, undefined, "damage mode restores its own growth");
}
{
  const { c } = fixture(), card = c.cards.hero_blue;
  card.rankLevels = [3, 10, 20];
  card.unit.healing.rankValues = { 1: { value: 30 } };
  assert.equal(levelStats(rankedHeroCard(card, 3).unit, 3).healing.value, 34, "rank base and level growth compose");
  card.unit.healing = { targets: "allies", valueMode: "percent", value: 10 };
  assert.equal(levelStats(card.unit, 5).healing.value, 18);
  assert.equal(levelStats(card.unit, 100).healing.value, 100);
  assert.equal(card.unit.healing.value, 10, "calculation never mutates the config");
}
for (const mode of ["fixed", "percent"]) {
  const { g, c, owner, ally, events } = fixture();
  c.cards.hero_blue.unit.healing.valueMode = mode;
  c.cards.hero_blue.unit.healing.value = mode === "percent" ? 10 : 30;
  owner.level = 3; g.rebuildHero(owner);
  const follower = g.summonFollowers(owner, { count: 1, hpPercent: 50, atkPercent: 50 })[0];
  assert.equal(follower.attackModule, "heal");
  assert.equal(follower.combatBehavior, "heal");
  assert.equal(follower.healing.value, owner.healing.value / 2);
  assert.notEqual(follower.healing, owner.healing);
  g.startDay(); g.tick(.025);
  owner.hp -= 150;
  const before = owner.hp, expected = mode === "percent" ? owner.maxHp * follower.healing.value / 100 : follower.healing.value;
  const enemy = { id: 900, side: "enemy", x: follower.x + 1, y: follower.y, hp: 1000, maxHp: 1000, atk: 1, range: 1, rate: 1, speed: 1, cooldown: 999, moveCooldown: 999 };
  g.enemies.push(enemy);
  g.tick(.025);
  assert.equal(owner.hp, before + expected);
  assert.ok(events.some(e => e.type === "healingCast" && e.source === follower && e.target === owner));
  assert.ok(!events.some(e => e.type === "attack" && (e.source === owner || e.source === follower)));
  assert.equal(enemy.hp, 1000);
  follower.cooldown = 0; owner.hp = owner.maxHp - .5; g.tick(.025);
  assert.equal(owner.hp, owner.maxHp, "medical follower cannot overheal");
  assert.ok(healingRoute(g, follower, { x: 7, y: 4 })?.every(p => withinFollowerArea(p, owner)));
  assert.equal(healingRoute(g, follower, { x: 12, y: 8 }), null);
  owner.mechanics.immobile = true; owner.cooldown = 999; ally.hp = 1;
  for (let i = 0; i < 120; i++) { g.tick(.025); assert.ok(withinFollowerArea(follower, owner)); }
  g.selectFollower(follower.id);
  assert.ok(!g.move(12, 8));
  owner.hp = owner.maxHp;
  follower.healing.targets = "towers";
  g.phase = "ready"; g.cards.tower = 1;
  assert.ok(g.playCard("tower", 4, 3));
  const tower = g.towers[0]; tower.hp = 1;
  g.phase = "battle"; follower.cooldown = 0; g.tick(.025);
  assert.ok(tower.hp > 1, "inherited target rules support towers");
}
console.log("PASS healer growth/followers: fixed/percent growth, ranks, live mode changes, inherited treatment, friendly targets, no enemy attacks, overheal cap and nine-cell movement");
