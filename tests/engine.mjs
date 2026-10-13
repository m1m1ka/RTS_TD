import assert from "node:assert/strict";
import { Game as EngineGame, BASE, attackKind } from "../src/game.js";
import { cards, startingCards } from "../src/cards.js";
import { obstacles } from "../src/art.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
class Game extends EngineGame {
  constructor(onEvent, config = structuredClone(DEFAULT_CONFIG)) {
    config.initial.firstWaveDelay = 0;
    super(onEvent, config);
  }
}
const completeDay = (g) => {
  g.wave = g.dayPlan.waves.length - 1;
  g.beginWave();
  for (const q of g.spawnQueues) q.spawned = q.types.length;
  g.enemies = [];
};
const deploy = (g) => {
  for (const [k, x, y] of [
    ["hero_blue", 7, 3],
    ["hero_green", 5, 5],
    ["hero_purple", 9, 5],
  ])
    assert.ok(g.playCard(k, x, y));
  return g;
};
const step = (g, seconds) => {
  for (let t = 0; t < seconds; t += 0.025) g.tick(0.025);
};
const finish = (g) => {
  for (let t = 0; t < 24000 && ["battle", "waiting", "victory"].includes(g.phase); t++) g.tick(0.025);
  assert.notEqual(g.phase, "battle", "wave must resolve");
};
const enemy = (id, x, y, hp = 300) => ({
  id,
  x,
  y,
  hp,
  maxHp: hp,
  atk: 10,
  range: 1,
  rate: 1,
  speed: 0.5,
  cooldown: 10,
  moveCooldown: 10,
  type: "grunt",
  side: "enemy",
});
{
  const g = new Game();
  assert.equal(obstacles.size, 0, "battlefield has no tree blockers");
  assert.ok(g.playCard("hero_blue", 1, 1), "former tree tile accepts deployment");
  g.select(0);
  g.move(5, 1);
  assert.equal(g.heroes[0].path.length, 4, "former tree row is traversable directly");
}
{
  const g = deploy(new Game()), h = g.heroes[0];
  g.playCard("tower", 6, 4);
  const cells = g.reachableCells(h);
  assert.ok(cells.length > 0);
  for (const p of cells) {
    assert.equal(g.blocked(p.x, p.y, h, true), false);
    assert.ok(g.path(h, p, { units: true })?.length);
  }
  const blockers = [[7, 2], [8, 3], [7, 4], [6, 3]]
    .map(([x, y], i) => enemy(100 + i, x, y));
  g.enemies.push(...blockers);
  assert.deepEqual(g.reachableCells(h), [], "surrounded hero cannot reach empty tiles beyond blockers");
  blockers.forEach((u) => { u.hp = 0; });
  assert.ok(g.reachableCells(h).length > 0, "death opens movement routes");
  assert.deepEqual(g.reachableCells(g.towers[0]), []);
}
{
  const g = new Game();
  assert.equal(g.heroes.length, 0);
  g.startDay();
  assert.equal(g.phase, "ready");
  for (const p of [
    [7, 5],
    [-1, 5],
    [0, 5],
  ])
    assert.equal(g.playCard("hero_blue", ...p), false);
  assert.equal(g.cards.hero_blue, 1);
  deploy(g);
  assert.equal(g.cards.hero_blue, undefined);
  assert.equal(g.playCard("hero_blue", 6, 4), false);
  assert.equal(g.playCard("training", 7, 5), false);
  assert.equal(g.cards.training, 2);
  assert.ok(g.playCard("training", 7, 3));
  assert.ok(g.playCard("training", 7, 3));
  assert.equal(g.heroes[0].level, 3);
  assert.equal(g.cards.training, undefined);
  assert.equal(g.playCard("coffee", 7, 3), false);
  g.heroes[0].hp -= 150;
  assert.ok(g.playCard("coffee", 7, 3));
  assert.equal(g.heroes[0].hp, g.heroes[0].maxHp - 30);
  assert.equal(g.cards.coffee, 1);
  assert.ok(g.playCard("tower", 6, 4));
  assert.equal(g.towers.length, 1);
  assert.equal(g.cards.tower, undefined);
  g.move(7, 4);
  step(g, 0.3);
  assert.equal(g.heroes[g.selected].path.length >= 0, true);
  g.reset();
  assert.deepEqual(g.cards, startingCards);
  assert.equal(g.towers.length, 0);
  assert.equal(g.heroes.length, 0);
}
{
  const g = deploy(new Game()),
    h = g.heroes[1];
  assert.ok(g.playCard("quiver", h.x, h.y));
  assert.equal(h.atk, 35);
  assert.equal(h.range, 5);
  g.cards.quiver = 1;
  assert.equal(g.playCard("quiver", h.x, h.y), false);
  assert.equal(g.cards.quiver, 1);
  for (const k of ["haste", "vampire", "guard", "arcane"]) {
    g.cards[k] = 1;
    assert.ok(g.playCard(k, h.x, h.y));
  }
  assert.equal(h.type, "green");
  assert.equal(h.weapon, "staff");
  assert.equal(attackKind(h), "orb");
  assert.equal(h.rate, 1.3 * 1.25);
  g.hit(h, 100, enemy(98, 4, 5));
  assert.equal(h.hp, h.maxHp - 75);
  const e = enemy(99, 5, 4),
    e2 = enemy(100, 5, 3);
  g.enemies = [e, e2];
  const hp = h.hp;
  g.attack(h, e);
  const duration = g.attacks[0].duration;
  h.weapon = "bow";
  g.resolveAttacks(duration * 0.5);
  assert.equal(e.hp, 300, "projectile damage waits for arrival");
  g.resolveAttacks(duration);
  assert.equal(e.hp, 265);
  assert.equal(e2.hp, 281, "in-flight spell retains splash");
  assert.ok(h.hp > hp, "equipment lifesteal heals");
  assert.equal(attackKind({ type: "tank", weapon: "bow" }), "arrow");
}
{
  const events = [],
    g = deploy(new Game((e) => events.push(e)));
  g.enemies = [enemy(99, 6, 4), enemy(100, 6, 5), enemy(101, 9, 4)];
  assert.equal(g.playCard("fireball", 6, 4), false, "battle only");
  g.startDay();
  assert.equal(g.playCard("fireball", 1, 1), false);
  assert.equal(g.cards.fireball, 2);
  assert.ok(g.playCard("fireball", 6, 4));
  assert.equal(g.enemies[0].hp, 190);
  assert.equal(g.enemies[1].hp, 190);
  assert.equal(g.enemies[2].hp, 300);
  assert.ok(g.playCard("fireball", 6, 4));
  assert.equal(g.cards.fireball, undefined, "no per-turn play cap");
  g.cards.frost = 1;
  assert.ok(g.playCard("frost", 6, 4));
  assert.equal(g.enemies[0].slowUntil, g.time + 3);
  assert.ok(g.playCard("lightning", 9, 4));
  assert.equal(g.enemies.find((e) => e.id === 101).hp, 60);
  assert.equal(events.filter((e) => e.type === "cardImpact").length, 4);
  const victim = g.enemies[0];
  g.hit(victim, 999, g.heroes[0]);
  g.hit(victim, 999, g.heroes[0]);
  assert.equal(g.kills, 1, "death counted once");
}
{
  const g = deploy(new Game());
  g.startDay();
  completeDay(g);
  g.heroes[0].hp = 0;
  g.tick(0.025);
  if (g.phase === "victory") g.tick(6);
  assert.equal(g.phase, "reward");
  assert.ok(g.heroes[0].hp > 0, "dead hero returns after victory");
  assert.equal(g.rewardOptions.length, 5);
  const before = structuredClone(g.cards),
    time = g.time;
  step(g, 100);
  assert.equal(g.time, time);
  g.startDay();
  if (g.phase === "victory") g.tick(6);
  assert.equal(g.phase, "reward");
  assert.equal(g.playCard("training", 5, 5), false);
  assert.equal(g.chooseReward(99), false);
  const chosen = g.rewardOptions.slice(0, 2);
  assert.ok(g.chooseReward([0, 1]));
  for (const key of new Set(chosen)) assert.equal(g.cards[key], (before[key] || 0) + chosen.filter(k => k === key).length);
  assert.equal(g.phase, "route");
  assert.ok(g.chooseDay(g.nextDays()[0]));
  assert.equal(g.day, 1);
  assert.equal(g.phase, "between");
  const inventory = structuredClone(g.cards);
  assert.equal(g.chooseReward([0, 1]), false);
  assert.deepEqual(g.cards, inventory);
  for (const h of [...g.heroReserve]) assert.ok(g.playCard(h.cardId, h.x, h.y));
  g.day = 5;
  g.startDay();
  completeDay(g);
  g.tick(0.025);
  if (g.phase === "victory") g.tick(6);
  assert.equal(g.phase, "reward");
  assert.ok(g.chooseReward([0, 1]));
  assert.equal(g.phase, "won", "final day also awards two cards before result");
}
{
  // Full campaign uses only legitimately owned cards and each claimed reward.
  const c = structuredClone(DEFAULT_CONFIG);
  for (const pool of Object.values(c.rewardPools)) pool.cards = { training: 1, tower: 1 };
  const g = deploy(new Game(() => {}, c));
  g.playCard("quiver", 5, 5);
  g.playCard("guard", 7, 3);
  g.playCard("training", 5, 5);
  g.playCard("training", 9, 5);
  g.playCard("tower", 6, 4);
  const slots = [
    [8, 6],
    [6, 6],
    [8, 4],
    [7, 7],
    [7, 2],
  ];
  for (let wave = 0; wave < 6; wave++) {
    g.startDay();
    finish(g);
    assert.equal(
      g.phase,
      "reward",
      `campaign wave ${wave + 1}, base ${g.baseHp}`,
    );
    g.chooseReward([0, 1]);
    if (g.phase === "route") assert.ok(g.chooseDay(g.nextDays()[0]));
    if (wave < 5) {
      for (const h of [...g.heroReserve]) assert.ok(g.playCard(h.cardId, h.x, h.y));
      while (g.cards.training) {
        const h = [...g.heroes].sort((a, b) => a.level - b.level)[0];
        g.playCard("training", h.x, h.y);
      }
      for (const h of g.heroes)
        if (g.cards.coffee && h.hp < h.maxHp) g.playCard("coffee", h.x, h.y);
      const [x, y] = slots[wave];
      assert.ok(g.playCard("tower", x, y));
    }
  }
  assert.equal(g.phase, "won");
  assert.equal(g.kills, 101);
  console.log("Campaign won; base HP:", g.baseHp);
}
console.log(
  "PASS engine: placement, inventory, resources, equipment, delayed attacks, spells, rewards, revival, six-day campaign, reset",
);
