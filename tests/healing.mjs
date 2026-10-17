import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { healingDefaults, injuredAllies, healingRoute } from "../src/healing-behavior.js";
import { selectAttackModule } from "../src/attack-modules.js";
const clone = structuredClone;
function fixture() {
  const c = clone(DEFAULT_CONFIG);
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  Object.assign(c.cards.hero_blue.unit, { combatBehavior: "heal", healing: clone(healingDefaults), range: 1, rate: 2, speed: 4 });
  c.initial.firstWaveDelay = 0;
  c.days[0].waves = [{id:"heal_test",name:"治疗测试",startDelay:0,hpScale:1,atkScale:1,spawns:[{x:14,y:5,delay:1000,interval:1,enemies:[{type:"grunt",count:1,level:1}]}]}];
  return assertConfig(c);
}
function setup(c = fixture()) {
  const events = [], g = new Game(e => events.push(e), c);
  g.playCard("hero_blue", 2, 2); g.playCard("hero_green", 8, 2); g.playCard("hero_purple", 11, 8);
  g.startDay();
  return { g, events, healer:g.heroes[0], near:g.heroes[1], far:g.heroes[2] };
}
const advance = (g, seconds) => { for (let t = 0; t < seconds - 1e-9; t += .025) g.tick(.025); };
{
  const {g,events,healer,near,far} = setup();
  near.hp -= 100; far.hp -= 150; healer.hp -= 20;
  const ownHp = healer.hp, initial = near.hp;
  advance(g, 1.6);
  assert.ok(healer.x > 2 && healer.x < near.x, "walks across the map to the nearest injured ally");
  assert.ok(near.hp > initial); assert.equal(healer.hp, ownHp, "no self healing");
  assert.ok(events.some(e => e.type === "healingCast" && e.target === near));
  assert.equal(events.filter(e => e.type === "attack" && e.source === healer).length, 0);
  const first = events.find(e => e.type === "heal" && e.automatic);
  assert.equal(first.amount, 30);
  advance(g, 6);
  assert.equal(near.hp, near.maxHp); assert.ok(far.hp > far.maxHp - 150, "moves on after fully healing first patient");
  assert.ok(events.filter(e => e.type === "heal" && e.automatic).every(e => e.unit.hp <= e.unit.maxHp));
}
{
  const c = fixture(); c.cards.hero_blue.unit.healing = {targets:"towers",valueMode:"percent",value:10};
  const {g,healer,near,events} = setup(c);
  g.cards.tower = 1; g.playCard("tower",3,3); const tower = g.towers[0];
  near.hp = 1; tower.hp = 10;
  advance(g,.025);
  assert.equal(tower.hp, 10 + tower.maxHp * .1, "diagonal distance 1 heals a tower using its maximum HP");
  assert.equal(healer.x, 2); assert.equal(healer.y, 2);
  assert.equal(events.filter(e=>e.type==="heal"&&e.automatic).length, 1);
  advance(g,.4); assert.equal(events.filter(e=>e.type==="heal"&&e.automatic).length,1,"healing respects rate");
  advance(g,.2); assert.equal(events.filter(e=>e.type==="heal"&&e.automatic).length,2);
  tower.hp = tower.maxHp - 1; healer.cooldown = 0; advance(g,.025);
  assert.equal(tower.hp, tower.maxHp, "caps at missing HP");
  assert.equal(events.filter(e=>e.type==="heal"&&e.automatic).at(-1).amount, 1);
  tower.hp = 0; advance(g,1); assert.equal(near.hp,1,"tower-only healer never switches to heroes");
  assert.equal(healer.healingTargetId, null);
}
{
  const {g,healer,near,far,events} = setup();
  near.hp = far.hp = 1;
  advance(g,.3);
  g.select(0); g.move(11,7); const manual = clone(healer.path);
  const healingCount = events.filter(e => e.type === "healingCast").length;
  advance(g,.1); assert.ok(healer.path.length > 0);
  assert.equal(events.filter(e => e.type === "healingCast").length, healingCount, "manual orders suppress treatment en route");
  assert.deepEqual(healer.path.at(-1), manual.at(-1), "AI cannot replace manual destination");
  advance(g,5);
  assert.ok(events.some(e => e.type === "healingCast" && e.target === far), "manual repositioning redirects treatment to the new nearest ally");
}
{
  const {g,healer,near,far} = setup();
  near.hp = far.hp = 1;
  // The nearer patient has no reachable treatment cell.
  for (let y=0;y<=4;y++) for(let x=6;x<=10;x++) if(x!==8||y!==2) g.obstacles.add(`${x},${y}`);
  assert.equal(healingRoute(g,healer,near), null);
  advance(g,.025); assert.equal(healer.healingTargetId, far.id, "skips unreachable nearest patient");
  assert.ok(!g.obstacles.has(`${healer.x},${healer.y}`));
  far.hp = far.maxHp; near.hp = 0;
  advance(g,.5); assert.equal(healer.healingTargetId, null, "dead patients are never revived by healing");
}
{
  const {g,healer,near} = setup();
  Object.assign(near,{x:3,y:2,hp:10});
  for (const ally of g.heroes.filter(h => h !== healer)) ally.cooldown = 100;
  g.enemies.push({id:999,side:"enemy",x:2,y:3,hp:1000,maxHp:1000,atk:0,range:0,rate:1,speed:.05,cooldown:100,moveCooldown:100});
  advance(g,1); assert.equal(g.enemies[0].hp,1000, "healing behavior never attacks adjacent enemies");
  for(const phase of ["ready","waiting","between"]) {
    g.phase=phase; g.waveWait=100; const hp=near.hp; advance(g,.5); assert.equal(near.hp,hp,phase+" does not automatically heal");
  }
  const c=clone(g.config); selectAttackModule(c.cards.hero_blue.unit, "slash"); delete c.cards.hero_blue.unit.healing;
  g.applyConfig(c); assert.equal(healer.combatBehavior,"attack"); assert.equal(healer.healing,undefined);
  g.phase="battle"; healer.cooldown=0; advance(g,.5); assert.ok(g.enemies[0].hp<1000,"live switch restores attacks");
}
{
  const {g,healer,near} = setup();
  const f = g.summonFollowers(near,{hpPercent:50,atkPercent:50,count:1})[0];
  f.hp=1; near.hp=near.maxHp;
  assert.deepEqual(injuredAllies(g,healer),[f],"followers are eligible allies");
  healer.healing.targets="towers"; assert.deepEqual(injuredAllies(g,healer),[]);
  const portable=fixture(); assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(portable))),portable);
}
for(const mutate of [
  c=>c.cards.hero_blue.unit.healing.value=0,
  c=>c.cards.hero_blue.unit.healing={targets:"allies",valueMode:"percent",value:101},
  c=>c.cards.hero_blue.unit.healing.targets="enemy",
  c=>delete c.cards.hero_blue.unit.healing,
  c=>c.cards.hero_blue.unit.range=0,
  c=>c.enemies.grunt.combatBehavior="heal",
]) {const c=fixture();mutate(c);assert.throws(()=>assertConfig(c));}
{
  const {g,healer,near} = setup();
  // Simulate an ally crossing the healer's cell just as the last patient fills.
  Object.assign(near,{x:healer.x,y:healer.y}); healer.moveCooldown=0;
  advance(g,.025);
  assert.ok(healer.x!==near.x || healer.y!==near.y,"does not idle overlapping a friendly when treatment ends");
  assert.deepEqual({x:near.x,y:near.y},{x:2,y:2},"auto healing never displaces its patient");
}
console.log("PASS healing: global nearest/reachable patients, autonomous movement, fixed/percent healing, towers/followers, range/rate/caps, manual redirection, death/full-health filtering, battle-only behavior, live changes and portability");
