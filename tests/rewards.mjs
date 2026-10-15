import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { Game } from "../src/game.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { drawRewards } from "../src/rewards.js";
import { RESOURCE_CARDS, changeLevel } from "../src/resource-effects.js";
const config = () => structuredClone(DEFAULT_CONFIG);
const random = (value, action) => { const old = Math.random; Math.random = () => value; try { return action(); } finally { Math.random = old; } };
{
  const c = config(), pool = c.rewardPools[c.days[0].rewardPool];
  pool.cards = { training: 1, coffee: 3, tower: 2, guard: 1, coin_purse: 4, legacy: 0 };
  for (let i = 0; i < 20; i++) {
    const offers = drawRewards(c, c.days[0]);
    assert.equal(offers.length, 5); assert.equal(new Set(offers).size, 5); assert.ok(!offers.includes("legacy"));
  }
  assert.equal(random(0, () => drawRewards(c, c.days[0]))[0], "training");
  assert.equal(random(.1, () => drawRewards(c, c.days[0]))[0], "coffee", "weights determine the draw boundary");
  pool.cards = { coin_purse: 1 };
  assert.deepEqual(drawRewards(c, c.days[0]), Array(5).fill("coin_purse"));
  const g = new Game(() => {}, c); g.phase = "reward"; g.rewardOptions = drawRewards(c, c.days[0]);
  const before = structuredClone(g.cards);
  for (const invalid of [0, [], [0], [0,0], [0,1,2], [-1,1], [0,5], [0,1.5], ["0",1]]) {
    assert.equal(g.chooseReward(invalid), false); assert.deepEqual(g.cards, before);
  }
  assert.ok(g.chooseReward([0,1])); assert.equal(g.cards.coin_purse, 2); assert.equal(g.phase, "route");
  assert.equal(g.chooseReward([0,1]), false); assert.equal(g.cards.coin_purse, 2);
  g.chooseDay(g.nextDays()[0]);
  assert.equal(g.cards.coin_purse, 2);
}
{
  const old = config(); delete old.rewardPools; delete old.resourceContentVersion;
  for (const key of Object.keys(RESOURCE_CARDS)) delete old.cards[key];
  for (const day of old.days) { delete day.rewardPool; day.rewards = [{ cards: { training: 2 } }, { cards: { training: 1, coffee: 1 } }]; }
  const c = assertConfig(old);
  assert.equal(c.rewardPools[c.days[0].rewardPool].cards.training, 3);
  assert.ok(c.cards.siphon); assert.ok(!("rewards" in c.days[0]));
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c, "portable migration is idempotent");
  delete c.cards.siphon;
  for (const pool of Object.values(c.rewardPools)) delete pool.cards.siphon;
  assert.ok(!assertConfig(c).cards.siphon, "deleted presets stay deleted");
}
const fixture = () => {
  const c = config(); Object.assign(c.initial.cards, Object.fromEntries(Object.keys(RESOURCE_CARDS).map(k => [k, 4])));
  const events = [], g = new Game(e => events.push(e), assertConfig(c));
  g.playCard("hero_blue", 7, 3); g.playCard("hero_green", 6, 3); g.playCard("hero_purple", 10, 3);
  return { c, g, events, heroes: g.heroes };
};
{
  const { g, events, heroes: [a,b,c] } = fixture();
  assert.ok(g.playCard("coin_purse", 1, 1)); assert.equal(g.gold, 3); assert.equal(g.cards.coin_purse, 3);
  const level = a.level, speed = a.speed, phase = g.phase;
  assert.ok(g.playCard("war_drum", a.x, a.y));
  assert.equal(a.level, level + 1); assert.equal(a.speed, speed + .5); assert.equal(g.phase, phase);
  assert.equal(events.filter(e => e.type === "heroBattleStart").length, 1);
  const rate = a.rate;
  changeLevel(g, a, 3); changeLevel(g, b, 7); changeLevel(g, c, 9);
  a.hp = a.maxHp / 2;
  assert.ok(g.playCard("level_swap", a.x, a.y));
  assert.deepEqual([a.level,b.level,c.level], [7,3,9]); assert.equal(a.hp / a.maxHp, .5); assert.equal(a.rate, rate);
  assert.ok(g.playCard("siphon", a.x, a.y));
  assert.deepEqual([a.level,b.level,c.level], [8,2,9], "only nearby heroes contribute");
  g.config.cards.siphon.effects[0] = { type: "drainLevels", radius: -1, limit: 3, perHero: 2 };
  assert.ok(g.playCard("siphon", a.x, a.y));
  assert.deepEqual([a.level,b.level,c.level], [11,1,7], "respect total limit, donor cap, and level floor");
  g.config.cards.siphon.effects[0].radius = 2;
  const count = g.cards.siphon;
  assert.equal(g.playCard("siphon", a.x, a.y), false); assert.equal(g.cards.siphon, count);
  g.playCard("guard", a.x, a.y);
  g.attacks = [{source:a,target:b},{source:b,target:a}];
  random(0, () => assert.ok(g.playCard("legacy", a.x, a.y)));
  assert.deepEqual(g.heroes.map(h => h.level), [12,7]); assert.equal(g.heroes.includes(a), false); assert.equal(g.attacks.length, 0);
  assert.equal(g.kills, 0, "sacrifice is not an enemy kill");
  g.phase = "reward"; g.rewardOptions = ["training","coffee","guard","tower","fireball"];
  g.chooseReward([0,1]); g.chooseDay(g.nextDays()[0]);
  assert.equal(g.heroes.length, 2); assert.ok(!g.heroes.some(h => h.id === a.id));
  assert.equal(g.cards.hero_blue, undefined, "destroyed hero never returns to the hand");
  assert.equal(g.gold, 3);
}
{
  const { g } = fixture(); g.heroes = g.heroes.slice(0,1);
  for (const key of ["level_swap","legacy","siphon"]) {
    assert.equal(g.playCard(key,7,3), false); assert.equal(g.cards[key], 4);
  }
}
for (const mutate of [
  c => c.rewardPools[c.days[0].rewardPool].cards = {},
  c => c.rewardPools[c.days[0].rewardPool].cards = { training: -1 },
  c => c.rewardPools[c.days[0].rewardPool].cards = { training: 1.5 },
  c => c.days[0].rewardPool = "missing",
  c => c.cards.coin_purse.effects[0].value = -1,
  c => c.cards.siphon.effects[0].limit = 0,
  c => c.cards.siphon.effects[0].perHero = 1.5,
  c => c.cards.siphon.effects[0].radius = -2,
  c => c.cards.level_swap.target = "any",
  c => c.cards.coin_purse.effects.push({type:"heal",value:20}),
]) { const c = config(); mutate(c); assert.ok(validateConfig(c).length); assert.throws(() => assertConfig(c)); }
console.log("PASS rewards/resources: weighted 5-of-2, duplicates, atomic claims, migration, portability, gold, one start event, swaps, capped drains, sacrifice persistence and validation");
