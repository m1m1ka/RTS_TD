import assert from "node:assert/strict";
import { Game, dist } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { applyResourceEffect } from "../src/resource-effects.js";
const summon = { type: "summonFollower", hpPercent: 40, atkPercent: 60, count: 1 };
const rule = (effects = [summon]) => ({ ...newTriggerRule(), trigger: { event: "preparation", scope: "any", radius: -1 }, effects });
const config = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  c.cards.hero_blue.triggerRules = [rule()];
  c.initial.firstWaveDelay = 10;
  for (const d of c.days) { d.obstacles = []; d.mines = []; }
  return c;
};
const create = (c = config()) => {
  const events = [], g = new Game(e => events.push(e), c);
  assert.ok(g.playCard("hero_blue", 7, 3));
  return { g, h: g.heroes[0], f: g.followers[0], events };
};
{
  const c = config(); c.cards.hero_blue.effects.push({ type: "level", value: 2 });
  const {g,h,f,events} = create(c);
  assert.equal(h.level, 3);
  assert.equal(f.maxHp, Math.ceil(h.maxHp * .4)); assert.equal(f.atk, Math.ceil(h.atk * .6));
  assert.equal(dist(h,f),1); assert.equal(f.hp,f.maxHp); assert.equal(f.isFollower,true);
  assert.equal(f.useIcon,h.useIcon); assert.equal(f.weapon,h.weapon);
  assert.equal(g.heroes.length,1); assert.equal(g.cards.hero_blue,undefined);
  assert.equal(g.cardTarget("training",f.x,f.y).valid,false);
  assert.ok(g.blocked(f.x,f.y,h,true));
  g.heroTriggers.prepare(); g.applyConfig(structuredClone(c));
  g.selected=0; g.move(10,3); for(let i=0;i<120;i++)g.tick(.025);
  assert.equal(h.x,10); assert.equal(dist(h,f),1,"follows owner on grid");
  assert.equal(events.filter(e=>e.type==="heroPreparation").length,1);
  assert.equal(g.followers.length,1);
  g.startDay(); g.startDay(); assert.equal(g.followers.length,1,"click start does not repeat preparation");
  g.cards.hero_blue=1; g.playCard("hero_blue",5,5); assert.equal(g.followers.length,1,"waiting/battle deployment has no preparation");
  g.phase="route"; const next=g.nextDays()[0]; assert.ok(g.chooseDay(next));
  assert.equal(g.followers.length,2,"both retained heroes prepare for next battle node");
  assert.ok(!g.followers.includes(f)); assert.equal(events.filter(e=>e.type==="heroPreparation").length,3);
  g.reset(); assert.equal(g.followers.length,0);
}
{
  const c=config(); c.days[1].kind="shop";
  const {g,events}=create(c);g.phase="route";g.chooseDay(g.nextDays()[0]);
  assert.equal(g.phase,"shop");assert.equal(g.followers.length,0);
  assert.equal(events.filter(e=>e.type==="heroPreparation").length,1);
  g.leaveShop();g.chooseDay(g.nextDays()[0]);assert.equal(g.followers.length,1);
}
{
  const c=config(); c.cards.hero_blue.triggerRules=[rule([{type:"level",value:1},{...summon,count:4}])];
  const g=new Game(()=>{},c); g.obstacles.add("7,2");g.obstacles.add("8,3");g.obstacles.add("6,3");
  g.playCard("hero_blue",7,3);assert.equal(g.heroes[0].level,2);assert.equal(g.followers.length,1);
  assert.equal(g.followers[0].y,4);assert.equal(g.followers[0].atk,Math.ceil(g.heroes[0].atk*.6));
  assert.equal(g.summonFollowers(g.followers[0],summon).length,0,"no clone recursion");
}
{
  const c=config();c.cards.hero_blue.triggerRules=[rule([{type:"triggerBattleStart"}]),newTriggerRule()];
  const {g,h,events}=create(c);assert.equal(h.level,2);assert.equal(events.filter(e=>e.type==="heroBattleStart").length,1);
  g.startDay();assert.equal(h.level,3,"preparation can compose an explicit start effect");
}
{
  const {g,h,f}=create();g.startDay();g.beginWave();
  g.spawnQueues=[{types:["grunt"],spawned:0,nextAt:999}];
  const enemy={id:++g.id,side:"enemy",type:"grunt",hp:200,maxHp:200,atk:7,range:1,rate:1,speed:1,x:f.x,y:f.y-1,cooldown:0,moveCooldown:0};
  g.enemies.push(enemy);g.tick(.025);
  assert.ok(g.attacks.some(a=>a.source===f&&a.target===enemy),"follower automatically attacks");
  assert.ok(g.attacks.some(a=>a.source===enemy&&a.target===f),"enemies attack followers");
  const hp=f.hp;g.resolveAttacks(1);assert.ok(f.hp<hp);assert.ok(enemy.hp<200);
  g.attack({...enemy,atk:10,splash:1,splashRadius:4},h);const old=f.hp;g.resolveAttacks(1);assert.equal(f.hp,old-10,"enemy splash includes followers");
  g.hit(f,9999,enemy);g.tick(.025);assert.equal(g.followers.length,0);
  g.spawnQueues=[];g.enemies=[];g.tick(.025);assert.equal(g.followers.length,0,"wave clear never revives followers");
}
{
  const {g,h}=create();g.playCard("hero_green",5,5);
  applyResourceEffect(g,h,{type:"sacrifice",radius:-1});assert.equal(g.followers.length,0,"destroying owner dismisses its followers");
}
{
  const c=config();assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))),c,"portable config roundtrip");
  for(const [key,value]of [["count",0],["count",1.5],["count",9],["hpPercent",0],["atkPercent",501],["hpPercent",NaN]]){
    const invalid=structuredClone(c);invalid.cards.hero_blue.triggerRules[0].effects[0][key]=value;
    assert.ok(validateConfig(invalid).length,`${key} ${value}`);
  }
}
console.log("PASS preparation/followers: deployment timing, once per day, shop exclusion, stat snapshots, occupancy, following, combat/death, cascades, owner destruction and portable config validation");
