import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
const clone=structuredClone;
function fixture(mechanics={}) {
  const c=clone(DEFAULT_CONFIG);
  for(const card of Object.values(c.cards)) if(card.category==="hero") card.triggerRules=[];
  c.cards.hero_blue.unit.mechanics=mechanics;
  c.initial.firstWaveDelay=0;
  c.days[0].waves=[{id:"test",name:"机制测试",startDelay:0,hpScale:1,atkScale:1,spawns:[{x:14,y:5,delay:1000,interval:1,enemies:[{type:"grunt",count:1,level:1}]}]}];
  return assertConfig(c);
}
function setup(c=fixture()) {
  const events=[],g=new Game(e=>events.push(e),c);
  g.playCard("hero_blue",4,4);g.playCard("hero_green",5,4);
  return {g,events,h:g.heroes[0],ally:g.heroes[1]};
}
const enemy=(g,x,y,extra={})=>{const e={id:++g.id,side:"enemy",type:"grunt",x,y,hp:10000,maxHp:10000,atk:100,rate:1,range:1,speed:1,cooldown:100,moveCooldown:100,weapon:"bow",attackModule:"bow",...extra};g.enemies.push(e);return e;};
{
  const {g,h,ally}=setup(fixture({immobile:true}));
  g.select(0);g.move(4,3);assert.deepEqual(h.path,[]);assert.equal(g.canControl(h),false);
  assert.deepEqual(g.reachableCells(h),[]);
  assert.equal(g.yieldPlan(ally,h),null,"immobile heroes cannot be displaced by friendly orders");
  g.startDay(); const e=enemy(g,3,4);g.tick(.025);assert.ok(g.attacks.some(a=>a.source===h),"immobile can attack");
  const c=clone(g.config);Object.assign(c.cards.hero_blue.unit,{combatBehavior:"heal",healing:{targets:"allies",valueMode:"fixed",value:30}});
  g.applyConfig(c);ally.hp-=100;h.cooldown=0;g.tick(.025);assert.equal(ally.hp,ally.maxHp-70,"immobile healer can treat nearby allies");
  Object.assign(ally,{x:10,y:4});h.cooldown=0;g.tick(.025);assert.equal(h.x,4,"immobile healer never chases");
}
{
  const {g,h}=setup(fixture({knockback:{distance:3}}));g.startDay();
  const e=enemy(g,6,6);g.attack(h,e);g.resolveAttacks(1);
  assert.deepEqual([e.x,e.y],[9,9],"three diagonal cells, once on primary impact");
  Object.assign(e,{x:6,y:6});g.obstacles.add("8,8");g.attack(h,e);g.resolveAttacks(1);assert.deepEqual([e.x,e.y],[7,7],"obstacle stops knockback");
  g.obstacles.clear();Object.assign(e,{x:13,y:4});g.attack(h,e);g.resolveAttacks(1);assert.equal(e.x,14,"stops at board edge");
  Object.assign(e,{x:6,y:4});enemy(g,7,4);g.attack(h,e);g.resolveAttacks(1);assert.equal(e.x,6,"cannot push through another unit");
  const fatal=enemy(g,8,3,{hp:1});g.attack(h,fatal);g.resolveAttacks(1);assert.deepEqual([fatal.x,fatal.y],[8,3],"dead targets are not moved");
  const moving=enemy(g,8,2);g.attack(h,moving);Object.assign(h,{x:12,y:2});g.resolveAttacks(1);assert.deepEqual([moving.x,moving.y],[10,0],"uses attack launch origin even if source moves");
}
{
  const {g,h,events}=setup(fixture({arrowReduction:{mode:"percent",value:50}}));
  const archer=enemy(g,3,4);h.damageReduction=.2;let hp=h.hp;
  g.hit(h,100,archer,false,"arrow");assert.equal(h.hp,hp-40,"general reduction then arrow percentage");
  hp=h.hp;g.hit(h,100,archer,false,"orb");assert.equal(h.hp,hp-80,"non-arrow damage is unchanged");
  h.mechanics.arrowReduction={mode:"fixed",value:100};hp=h.hp;g.hit(h,100,archer,false,"arrow");
  assert.equal(h.hp,hp);assert.ok(events.some(e=>e.type==="blocked"));
  h.mechanics.arrowReduction={mode:"percent",value:50};h.damageReduction=0;
  hp=h.hp;g.attack(archer,h);archer.weapon="staff";archer.attackModule="staff";g.resolveAttacks(1);
  assert.equal(h.hp,hp-50,"in-flight arrow type is stable after weapon change");
}
{
  const c=fixture({dormant:true});
  c.cards.hero_blue.triggerRules=[{...newTriggerRule(),effects:[{type:"level",value:2}]}];
  const {g,h,ally,events}=setup(c);
  assert.ok(g.isDormant(h));g.select(0);g.move(3,4);assert.deepEqual(h.path,[]);
  g.startDay();assert.equal(h.level,1,"sleeping hero cannot trigger start rules");
  const e=enemy(g,3,4);g.tick(.1);assert.equal(g.attacks.filter(a=>a.source===h).length,0);
  const f=g.summonFollowers(ally,{count:1,hpPercent:50,atkPercent:50});assert.equal(f.length,1);
  g.cards.tower=1;g.playCard("tower",3,3);
  g.hit(ally,100000,e);assert.equal(g.isDormant(h),false,"followers and towers do not prevent awakening");
  assert.equal(events.filter(e=>e.type==="heroAwakened").length,1);
  g.tick(.01);assert.ok(g.attacks.some(a=>a.source===h));
  g.reviveHero(ally,{hpPercent:100,maxRevives:1},h);assert.equal(g.isDormant(h),false,"revived allies do not re-sleep the hero");
  g.applyConfig(clone(c));assert.equal(g.isDormant(h),false,"hot saves preserve daily awakening");
  g.phase="route";g.chooseDay(g.nextDays()[0]);assert.equal(g.isDormant(h),true,"next day resets");
  g.startDay();assert.equal(g.isDormant(h),true);
}
{
  const {g,h,ally}=setup(fixture({dormant:true}));
  g.config.cards.hero_green.triggerRules=[{...newTriggerRule(),trigger:{event:"sacrifice",scope:"any",radius:-1},effects:[{type:"revive",maxRevives:1,hpPercent:50}]}];
  g.startDay();g.hit(ally,100000,enemy(g,6,4));
  assert.ok(ally.hp>0);assert.equal(g.isDormant(h),true,"sacrifice revival settles before checking last survivor");
  const solo=new Game(()=>{},fixture({dormant:true}));solo.playCard("hero_blue",4,4);solo.startDay();assert.equal(solo.isDormant(solo.heroes[0]),false);
}
{
  const c=fixture();
  const bonus={...newTriggerRule(),trigger:{event:"victory",scope:"any",radius:-1},target:{kind:"allAllies",radius:-1,count:1},effects:[{type:"victoryGold",value:17}]};
  c.cards.hero_blue.triggerRules=[clone(bonus)];c.cards.hero_green.triggerRules=[clone(bonus)];
  const {g,h,ally}=setup(assertConfig(c));g.startDay();ally.hp=0;
  g.spawnQueues=[];g.enemies=[];g.tick(.01);
  assert.equal(g.phase,"victory");assert.equal(g.gold,0,"bonus is paid during the victory animation");
  assert.equal(g.settlement.total,21,"base 4 plus survivor's 17, not multiplied by targets");
  assert.equal(g.settlement.bonuses.length,1);
  assert.ok(g.settlement.coins.some(c=>c.x===h.x&&c.y===h.y));
  g.tick(g.settlement.duration+1);assert.equal(g.gold,21);g.tick(10);assert.equal(g.gold,21,"no repeat payment");
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))),c);
}
for(const mechanics of [{immobile:1},{dormant:"yes"},{knockback:{distance:0}},{knockback:{distance:1.5}},{arrowReduction:{mode:"percent",value:101}},{arrowReduction:{mode:"fixed",value:-1}}]) assert.throws(()=>fixture(mechanics));
{
  const c=fixture();c.cards.hero_blue.triggerRules=[{...newTriggerRule(),effects:[{type:"victoryGold",value:2}]}];assert.throws(()=>assertConfig(c));
}
console.log("PASS hero mechanics: default opt-in, immobility/healing/yielding, diagonal collision-aware knockback, arrow snapshot/reduction/zero damage, dormant actions/revival/day reset, survivor-only animated gold and validation");
