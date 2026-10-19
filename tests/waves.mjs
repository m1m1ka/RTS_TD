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
  assert.ok(g.enemies[0].x > 14 && g.enemies[0].boatId, "right gate starts aboard a ship east of the island");
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
  if (g.phase === "victory") g.tick(6);
  assert.equal(g.phase, "reward");
  assert.equal(events.filter((e) => e.type === "wave").length, 2);
  assert.equal(events.filter((e) => e.type === "waveClear").length, 2);
  g.chooseReward([0]);
  assert.equal(g.phase, "won");
}
{
  const c = fixture();
  c.initial.firstWaveDelay = 0;
  c.days[0].waves[0].spawns = [point(0, 5, 0, "grunt", 2), point(14, 5, 0, "runner")];
  c.enemies.grunt.atk = c.enemies.runner.atk = 0;
  const g = new Game(() => {}, c);
  g.playCard("hero_blue", 1, 5);
  g.heroes[0].atk = 0;
  assert.equal(g.cardTarget("tower", 0, 5).valid, false, "stationary towers cannot permanently block spawn points");
  g.heroes[0].x = 0;
  g.startDay();
  g.heroes[0].atk = 0; // Opening level-up rules rebuild stats before this timing-only scenario.
  step(g, 0.025);
  assert.equal(g.spawned, 3, "ships launch independently even when a hero occupies the shore");
  assert.equal(g.boats.length, 2);
  step(g, 2.975);
  assert.equal(g.heroes[0].x, 2, "landing pushes the hero at the bow before considering side cells");
  const first = g.enemies.find(e => e.enemyId === "grunt" && !e.boatId);
  assert.equal(first.y, 5);
  first.x = 1; first.y = 4; // Clear the gangway without advancing its timer.
  step(g, 0.45);
  assert.equal(g.enemies.filter(e => e.enemyId === "grunt" && !e.boatId).length, 1);
  step(g, 0.05);
  assert.equal(g.enemies.filter(e => e.enemyId === "grunt" && !e.boatId).length, 2, "per-point spacing controls disembarkation");
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
for (const nextKind of ["battle", "shop"]) {
  const c = fixture();c.initial.firstWaveDelay=0;
  c.days.push(structuredClone(DEFAULT_CONFIG.days[1]));
  for(const card of Object.values(c.cards))if(card.category==="hero")card.triggerRules=[];
  c.days[0].next=[c.days[1].id];c.days[1].kind=nextKind;
  const events=[],g=new Game(e=>events.push(e),c);
  g.playCard("hero_blue",5,5);g.playCard("hero_green",9,5);g.startDay();
  const [alive,dead]=g.heroes;
  alive.dayEffects.push({type:"stat",stat:"atk",mode:"add",value:17});g.rebuildHero(alive,false);
  alive.hp=123;alive.cooldown=3;alive.moveCooldown=2;
  g.hit(dead,100000,{side:"enemy"});
  const before={hp:alive.hp,atk:alive.atk,dayEffects:structuredClone(alive.dayEffects),equipment:[...alive.equipment],level:alive.level,cooldown:alive.cooldown,moveCooldown:alive.moveCooldown};
  const clear=()=>{g.spawnQueues.forEach(q=>q.spawned=q.types.length);g.enemies=[];g.tick(0);};
  const unchanged=()=>{
    assert.equal(dead.hp,0,"fallen hero stays dead until the next day");
    for(const key of Object.keys(before))assert.deepEqual(alive[key],before[key],`${key} is not reset by clearing a wave`);
    assert.equal(events.filter(e=>e.type==="revive").length,0);
  };
  clear();assert.equal(g.phase,"waiting");unchanged();
  g.beginWave();clear();assert.equal(g.phase,"victory");unchanged();
  g.tick(6);assert.equal(g.phase,"reward");assert.equal(g.rewardOptions.length,3);unchanged();
  const cards=structuredClone(g.cards);assert.equal(g.chooseReward([0,1]),false);assert.deepEqual(g.cards,cards);
  assert.ok(g.chooseReward([0]));unchanged();
  assert.ok(g.chooseDay(c.days[1].id));
  for(const hero of g.heroes){assert.equal(hero.hp,hero.maxHp);assert.deepEqual(hero.dayEffects,[]);assert.equal(hero.cooldown,0);}
  assert.equal(alive.level,before.level);assert.deepEqual(alive.equipment,before.equipment);
  assert.equal(events.filter(e=>e.type==="revive"&&e.unit.id===dead.id).length,1);
  assert.equal(g.phase,nextKind==="shop"?"shop":"between");
}
console.log("PASS waves: clocks, gates, spacing, live edits, no wave recovery, next-day revival/healing/reset, battle and shop transitions, three-of-one reward and validation");
