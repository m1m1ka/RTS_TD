import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { waveCount } from "../src/config/migrate.js";
const point = (x, y, delay, type = "grunt", count = 1) => ({ x, y, delay, interval: 0.5, enemies: [{ type, count }] });
function fixture() {
  const c = structuredClone(DEFAULT_CONFIG);
  c.initial.firstWaveDelay = 2;
  c.days = [c.days[0]];
  c.days[0].waves = [
    { id: "one", name: "第一波", startDelay: 0, hpScale: 1, atkScale: 1, spawns: [point(7, 0, 0), point(14, 5, 3, "runner")] },
    { id: "two", name: "第二波", startDelay: 4, hpScale: 2, atkScale: 1, spawns: [point(0, 5, 1, "tank")] },
  ];
  return c;
}
const step = (g, seconds) => {
  for (let left = seconds; left > 1e-8; left -= 0.025) g.tick(Math.min(0.025, left));
};
const kill = (g) => { for (const e of g.enemies) g.hit(e, 1000000, g.heroes[0]); };
{
  const c = fixture(), events = [], g = new Game((e) => events.push(e), assertConfig(c));
  g.playCard("hero_blue", 5, 5);
  g.startDay();
  assert.equal(g.cardTarget("training", 5, 5).valid, true, "resources remain usable during countdown");
  assert.equal(g.cardTarget("hero_green", 9, 5).valid, true, "heroes can deploy during countdown");
  step(g, 1.975);
  assert.equal(g.phase, "waiting");
  assert.equal(g.spawned, 0);
  step(g, 0.025);
  assert.equal(g.phase, "battle");
  assert.equal(g.spawned, 1);
  assert.equal(g.enemies[0].enemyId, "grunt");
  kill(g);
  step(g, 2.975);
  assert.equal(g.phase, "battle", "empty field with pending late point must not end a wave");
  assert.equal(g.wave, 0);
  step(g, 0.025);
  assert.equal(g.spawned, 2);
  assert.equal(g.enemies[0].enemyId, "runner");
  assert.equal(g.enemies[0].x, 13, "right gate spawn takes its first step from that gate");
  kill(g);
  // Unresolved projectiles must not delay the last-kill completion event.
  g.attacks.push({ remaining: 50 });
  step(g, 0.025);
  assert.equal(g.phase, "waiting");
  assert.equal(g.wave, 1);
  assert.equal(g.waveWait, 4);
  assert.equal(g.rewardOptions.length, 0, "rewards belong to day completion");
  const wait = g.waveWait;
  g.tick(0);
  assert.equal(g.waveWait, wait, "pause freezes the wave clock");
  step(g, 3.975);
  assert.equal(g.phase, "waiting");
  step(g, 0.025);
  assert.equal(g.phase, "battle");
  assert.equal(g.spawned, 0, "point delay is relative to new wave start");
  step(g, 1);
  assert.equal(g.enemies[0].enemyId, "tank");
  assert.equal(g.enemies[0].maxHp, c.enemies.tank.maxHp * 2);
  kill(g);
  step(g, 0.025);
  assert.equal(g.phase, "reward");
  assert.equal(events.filter((e) => e.type === "wave").length, 2);
  assert.equal(events.filter((e) => e.type === "waveClear").length, 2);
  g.chooseReward(0);
  assert.equal(g.phase, "won");
}
{
  const c = fixture();
  c.initial.firstWaveDelay = 0;
  c.days[0].waves[0].spawns = [point(5, 5, 0, "grunt", 2), point(14, 5, 0, "runner")];
  const g = new Game(() => {}, c);
  g.playCard("hero_blue", 5, 5);
  g.heroes[0].atk = 0;
  g.heroes[0].x = 4;
  assert.equal(g.cardTarget("tower", 5, 5).valid, false, "stationary towers cannot permanently block spawn points");
  g.heroes[0].x = 5;
  g.startDay();
  step(g, 0.025);
  assert.equal(g.spawned, 1, "unblocked gate runs independently");
  assert.equal(g.spawnQueues[0].spawned, 0, "blocked point retains its own queue");
  assert.equal(g.enemies[0].enemyId, "runner");
  g.heroes[0].x = 4;
  step(g, 0.025);
  assert.equal(g.spawnQueues[0].spawned, 1);
  assert.equal(g.enemies.find((e) => e.enemyId === "grunt").y, 5);
  kill(g);
  step(g, 0.45);
  assert.equal(g.spawnQueues[0].spawned, 1);
  step(g, 0.05);
  assert.equal(g.spawnQueues[0].spawned, 2, "per-point spacing is respected");
}
{
  const c = fixture();
  const g = new Game(() => {}, c);
  g.playCard("hero_blue", 5, 5);
  g.startDay();
  step(g, 1);
  const next = structuredClone(c);
  next.initial.firstWaveDelay = 3;
  next.days[0].waves[1].startDelay = 7;
  g.applyConfig(next);
  assert.equal(g.waveWait, 2, "live waiting edit preserves time already spent");
  step(g, 2);
  const edit = structuredClone(next);
  edit.days[0].waves[0].spawns[0].enemies[0].count = 20;
  g.applyConfig(edit);
  assert.equal(g.spawnQueues[0].types.length, 1, "active schedule is not replayed by live edits");
  assert.equal(g.dayPlan.waves[1].startDelay, 7);
}
{
  const legacy = structuredClone(DEFAULT_CONFIG);
  legacy.version = 1;
  delete legacy.days;
  delete legacy.initial.firstWaveDelay;
  legacy.waves = [{ id: "old", name: "旧关卡", count: 5, interval: 1, hpScale: 1, atkScale: 1,
    types: ["grunt", "runner"], finalEnemy: "boss", spawns: [{ x: 7, y: 0 }, { x: 0, y: 5 }], rewards: DEFAULT_CONFIG.days[0].rewards }];
  const migrated = assertConfig(legacy);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.days.length, 1);
  assert.equal(waveCount(migrated.days[0].waves[0]), 5);
  assert.equal(migrated.days[0].waves[0].spawns[0].enemies.at(-1).type, "boss");
  assert.deepEqual(migrated.cards, legacy.cards);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))), migrated);
}
for (const mutate of [
  c => c.initial.firstWaveDelay = -1,
  c => c.days[0].waves[1].startDelay = NaN,
  c => c.days[0].waves[0].spawns[0].delay = -1,
  c => c.days[0].waves[0].spawns[0].enemies[0].count = 0.5,
  c => c.days[0].waves[0].spawns[0].enemies[0].type = "missing",
  c => c.days[0].waves[0].spawns[0].enemies = [],
  c => c.days[0].waves[0].spawns.push(structuredClone(c.days[0].waves[0].spawns[0])),
  c => c.days[0].waves = [],
]) {
  const c = fixture(); mutate(c);
  assert.ok(validateConfig(c).length, "invalid nested wave config must be rejected");
}
console.log("PASS waves: first-wave clock, independent gates, delayed spawns, final kill, inter-wave delay, pause, occupancy, spacing, live edits, day reward, v1 migration, validation");
