import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { materializeRoutes, nextDayIds, campaignLayout } from "../src/campaign.js";
const fixture = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.days = c.days.slice(0, 4);
  materializeRoutes(c);
  const [a, b, d, end] = c.days;
  a.next = [b.id, d.id]; b.next = [end.id]; d.next = [end.id]; end.next = [];
  b.obstacles = [{ x: 1, y: 1 }]; d.obstacles = [{ x: 2, y: 2 }];
  return c;
};
const claim = (g) => { g.phase = "reward"; g.rewardOptions = ["training", "coffee", "tower", "guard", "fireball"]; return g.chooseReward([0]); };
{
  const c = assertConfig(fixture()), g = new Game(() => {}, c), [a, b, d, end] = c.days;
  const layout = campaignLayout(c);
  assert.equal(layout.nodes[1].x, layout.nodes[2].x);
  assert.notEqual(layout.nodes[1].y, layout.nodes[2].y);
  assert.equal(layout.nodes[3].depth, 2);
  g.playCard("hero_catgirl", 7, 3);
  assert.equal(g.chooseDay(d.id), false, "cannot skip before clearing the current day");
  assert.ok(claim(g));
  assert.equal(g.phase, "route");
  assert.deepEqual(g.nextDays(), [b.id, d.id]);
  assert.equal(g.chooseDay(end.id), false, "cannot skip past a branch");
  const time = g.time;
  g.tick(10);
  assert.equal(g.time, time);
  assert.equal(g.playCard("training", 7, 3), false);
  const cards = structuredClone(g.cards);
  assert.equal(g.chooseReward([0]), false, "reward cannot be claimed twice");
  assert.ok(g.chooseDay(d.id));
  assert.equal(g.day, 2);
  assert.equal(g.snapshot().day, 2, "branch nodes share a day column");
  assert.equal(g.heroes.length, 1);
  assert.equal(g.heroes[0].name, "米娅");
  assert.deepEqual([g.heroes[0].x, g.heroes[0].y], [7, 3]);
  assert.deepEqual(g.cards, cards);
  assert.ok(g.obstacles.has("2,2"));
  assert.equal(g.chooseDay(b.id), false, "choice is committed");
  claim(g);
  assert.deepEqual(g.nextDays(), [end.id]);
  g.chooseDay(end.id);
  claim(g);
  assert.equal(g.phase, "won");
  assert.deepEqual(g.routeHistory, [a.id, d.id, end.id]);
  assert.deepEqual(g.completedDays, [a.id, d.id, end.id]);
  g.reset();
  assert.deepEqual(g.heroReserve, []);
  assert.deepEqual(g.completedDays, []);
  assert.deepEqual(g.routeHistory, [a.id]);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))), c);
}
{
  const c = fixture(), [a, b, d, end] = c.days;
  // A terminal node does not have to be the last entry in the config array.
  b.next = []; a.next = [b.id, d.id]; d.next = [end.id];
  const g = new Game(() => {}, assertConfig(c));
  claim(g); g.chooseDay(b.id); claim(g);
  assert.equal(g.phase, "won");
}
{
  const old = structuredClone(DEFAULT_CONFIG), c = assertConfig(old);
  assert.deepEqual(nextDayIds(c, c.days[0].id), [c.days[1].id]);
  assert.deepEqual(nextDayIds(c, c.days.at(-1).id), []);
  const reordered = fixture();
  const root = reordered.days.shift(); reordered.days.push(root);
  const g = new Game(() => {}, assertConfig(reordered));
  assert.equal(g.config.days[g.day].id, root.id, "entry is independent of array order");
}
{
  const c = fixture();
  c.initial.cards.hero_blue = 2;
  c.initial.cards.hero_green = 1;
  c.cards.hero_blue.effects.push({ type: "level", value: 1 });
  c.cards.hero_green.effects.push({ type: "level", value: 1 });
  const g = new Game(() => {}, c);
  assert.ok(g.playCard("hero_blue", 4, 4));
  assert.ok(g.playCard("hero_green", 5, 4));
  const [low, high] = g.heroes;
  high.level = 8; g.rebuildHero(high);
  assert.ok(g.playCard("guard", high.x, high.y));
  const equipment = [...high.equipment], attack = high.atk;
  high.dayEffects.push({ type: "stat", stat: "rate", mode: "add", value: 2 });
  g.rebuildHero(high);
  claim(g);
  assert.equal(g.heroes.length, 2, "route overview does not recall heroes yet");
  assert.ok(g.chooseDay(g.nextDays()[0]));
  assert.deepEqual(g.heroes, [low, high]);
  assert.equal(g.cards.hero_blue, 1, "deployed heroes never return to inventory");
  assert.deepEqual(g.heroes.map(h => [h.x,h.y]), [[4,4],[5,4]]);
  assert.deepEqual(g.heroReserve, []);
  assert.equal(high.level, 8, "transition does not repeat initial level effects");
  assert.deepEqual(high.equipment, equipment);
  assert.deepEqual(high.dayEffects, []);
  assert.equal(high.atk, attack, "equipment is applied once");
  assert.ok(g.heroes.every(h => h.hp === h.maxHp));
  high.hp = 1; low.hp = 0;
  c.initial.levelGrowth.heal = 0;
  g.startDay();
  assert.ok(g.heroes.every(h => h.hp === h.maxHp), "heal and revive before start triggers; refill increased maximum afterward");
  const level = high.level;
  high.hp = 5; g.startDay();
  assert.equal(high.hp, 5, "repeated start clicks cannot heal during combat");
  assert.equal(high.level, level);
  claim(g); g.chooseDay(g.nextDays()[0]);
  assert.equal(g.heroes.length, 2);
  assert.equal(g.cards.hero_blue, 1);
  const previousLevel = low.level;
  assert.equal(g.playCard("hero_blue", 6, 3), false);
  assert.ok(g.playCard("hero_blue", low.x, low.y));
  assert.equal(low.level, previousLevel + 3, "duplicates upgrade the retained hero without replaying initial effects");
  assert.equal(g.cards.hero_blue, undefined);
  g.reset();
  assert.equal(g.heroReserve.length, 0);
  assert.equal(g.cards.hero_blue, 2);
}
for (const change of [
  c => c.days[0].next.push("missing"),
  c => c.days[0].next.push(c.days[0].id),
  c => c.days[0].next.push(c.days[1].id),
  c => c.days[3].next.push(c.days[0].id),
  c => c.days[0].next = [c.days[1].id],
  c => c.startDayId = "missing",
  c => c.days[0].next = "invalid",
]) {
  const c = fixture(); change(c); assert.throws(() => assertConfig(c));
}
console.log("PASS routes: legacy chain, branching/merging, day depth, selection gating, state persistence, terminal nodes, reset, portable configs and invalid graphs");
