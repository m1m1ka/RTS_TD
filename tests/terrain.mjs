import { redeployHeroes } from "./helpers/redeploy.mjs";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
const config = () => structuredClone(DEFAULT_CONFIG);
{
  const c = config();
  c.days[1].mines = [{ x: 6, y: 3, maxHp: 180 }];
  c.days[1].waves[0].spawns[0].x = 7;
  c.days[1].waves[0].spawns[0].y = 3;
  const g = new Game(() => {}, assertConfig(c));
  g.playCard("hero_blue",7,3);g.playCard("hero_green",6,3);
  const ids = g.heroes.map(h => h.id), owned = structuredClone(g.cards);
  g.phase = "route";g.chooseDay(g.nextDays()[0]);
  assert.equal(g.heroes.length,0);
  assert.deepEqual(g.heroReserve.map(h => h.id), ids);
  redeployHeroes(g);
  assert.deepEqual(g.cards, owned);
  const cells = g.heroes.map(h => `${h.x},${h.y}`);
  assert.equal(new Set(cells).size, 2);
  assert.ok(cells.every(cell => cell !== "6,3"), "manual redeployment obeys the new map's mines without overlap");
}
{
  const c = config();
  c.days[0].obstacles = [{ x: 6, y: 3 }, { x: 6, y: 4 }];
  c.days[1].obstacles = [{ x: 7, y: 3 }];
  const g = new Game(() => {}, assertConfig(c));
  assert.equal(g.cardTarget("hero_blue", 6, 3).valid, false);
  assert.equal(g.cardTarget("tower", 6, 3).valid, false);
  assert.ok(g.playCard("hero_blue", 7, 3));
  const hero = g.heroes[0];
  assert.ok(!g.reachableCells(hero).some((p) => p.x === 6 && p.y === 3));
  const path = g.path(hero, { x: 5, y: 3 });
  assert.ok(path.length > 2 && !path.some((p) => g.obstacles.has(`${p.x},${p.y}`)));
  g.move(5, 3);
  const hot = config();
  hot.days[0].obstacles = [...c.days[0].obstacles, { ...hero.path[0] }];
  g.applyConfig(assertConfig(hot));
  assert.ok(!hero.path.some((p) => g.obstacles.has(`${p.x},${p.y}`)), "routes update after painting across them");
  hot.days[0].obstacles.push({ x: hero.x, y: hero.y });
  g.applyConfig(assertConfig(hot));
  assert.ok(!g.obstacles.has(`${hero.x},${hero.y}`), "new trees relocate covered units to a free cell");
  const second = config();
  second.days[0].obstacles = hot.days[0].obstacles;
  second.days[1].obstacles = [{ x: hero.x, y: hero.y }];
  g.applyConfig(assertConfig(second));
  g.phase = "reward";
  g.rewardOptions = ["training", "coffee", "tower", "guard", "fireball"];
  g.chooseReward([0]);
  g.chooseDay(g.nextDays()[0]);
  assert.equal(g.day, 1);
  assert.equal(g.obstacles.size, 1);
  assert.equal(g.heroes.length, 0);
  redeployHeroes(g);
  assert.equal(g.heroes.length, 1);
  assert.equal(g.heroes[0], hero);
  assert.ok(!g.obstacles.has(`${hero.x},${hero.y}`), "kept hero moves off the new tree");
  assert.equal(hero.hp, hero.maxHp);
  assert.equal(g.heroReserve.length, 0);
  assert.ok(!g.obstacles.has("6,3"), "each day uses its own terrain");
  g.reset();
  assert.ok(g.obstacles.has("6,3"));
  const independent = new Game(() => {}, config());
  assert.equal(independent.obstacles.size, 0, "terrain is not shared between games");
}
{
  const old = config();
  for (const day of old.days) delete day.obstacles;
  const migrated = assertConfig(old);
  assert.deepEqual(migrated.days[0].obstacles, []);
  migrated.days[0].obstacles = [{ x: 2, y: 2 }];
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))), migrated);
}
{
  const c = config(), g = new Game(() => {}, c);
  g.playCard("tower", 6, 4);
  const tower = g.towers[0];
  const next = config();
  next.days[1].waves[0].spawns[0].x = 6;
  next.days[1].waves[0].spawns[0].y = 4;
  g.applyConfig(assertConfig(next));
  g.phase = "reward"; g.rewardOptions = ["training", "coffee", "tower", "guard", "fireball"];
  g.chooseReward([0]); g.chooseDay(g.nextDays()[0]);
  assert.ok(tower.x !== 6 || tower.y !== 4, "carried towers move off a new branch's spawn point");
  assert.ok(g.path({ x: 6, y: 4 }, { x: 7, y: 5 }, { adjacent: true }));
}
for (const cells of [
  [{ x: 7, y: 5 }], [{ x: 7, y: 0 }], [{ x: -1, y: 2 }], [{ x: 1.5, y: 2 }],
  [{ x: 2, y: 2 }, { x: 2, y: 2 }], [null],
  Array.from({ length: 15 }, (_, x) => ({ x, y: 4 })),
]) {
  const c = config();
  c.days[0].obstacles = cells;
  assert.ok(validateConfig(c).length, "reject invalid terrain and cut-off spawn routes");
  assert.throws(() => assertConfig(c));
}
{
  const c = config();
  c.days[1].obstacles = Array.from({ length: 15 }, (_, x) => ({ x, y: 4 }));
  assert.ok(validateConfig(c).some((e) => e.includes("第 2 天")), "validate each day's own map");
}
console.log("PASS terrain: per-day maps, placement, movement, live rerouting/relocation, day transitions, migration, protected cells and connectivity");
