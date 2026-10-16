import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
import { assertConfig } from "../src/config/schema.js";
const level = { type: "level", value: 1 };
const revive = { type: "revive", maxRevives: 2, hpPercent: 50 };
const rule = (event, effects=[level], scope="any", radius=-1, target="self") => ({ ...newTriggerRule(),
  trigger:{event,scope,radius}, target:{kind:target,radius:-1,count:1}, effects });
function setup(edit) {
  const c=structuredClone(DEFAULT_CONFIG);
  for(const card of Object.values(c.cards))if(card.category==="hero")card.triggerRules=[];
  c.cards.hero_blue.triggerRules=[rule("sacrifice")];
  c.cards.hero_green.triggerRules=[rule("heroSacrifice")];
  edit?.(c);assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))),c);
  const events=[],g=new Game(e=>events.push(e),c);
  g.playCard("hero_blue",4,4);g.playCard("hero_green",5,4);g.playCard("hero_purple",9,4);
  return {g,c,events,a:g.heroes[0],b:g.heroes[1],d:g.heroes[2]};
}
const kill=(g,h)=>g.hit(h,100000,{side:"enemy"});
{
  const {g,a,b,events}=setup(c=>c.cards.hero_blue.triggerRules.push(rule("sacrifice")));
  kill(g,a);assert.equal(a.level,3);assert.equal(b.level,2,"one notification after all sacrifice rules");
  assert.equal(events.filter(e=>e.type==="heroSacrifice").length,1);
  kill(g,a);g.applyConfig(g.config);assert.equal(b.level,2);
  a.hp=1;kill(g,a);assert.equal(b.level,3,"a later death can notify again");
}
for(const scope of ["any","others","self"]) {
  const {g,a,b,d}=setup(c=>{
    c.cards.hero_green.triggerRules=[rule("heroSacrifice",[level],scope,1)];
    c.cards.hero_purple.triggerRules=[rule("heroSacrifice",[level],"any",1)];
  });
  kill(g,a);assert.equal(b.level,scope==="self"?1:2);assert.equal(d.level,1,"listener distance applies");
}
for(const rules of [[],[{...rule("sacrifice"),enabled:false}]]) {
  const {g,a,b}=setup(c=>c.cards.hero_blue.triggerRules=rules);
  kill(g,a);assert.equal(b.level,1,"plain deaths without enabled sacrifice rules do not notify");
}
{
  const {g,a,b}=setup();
  const [f]=g.summonFollowers(a,{count:1,hpPercent:50,atkPercent:50});
  kill(g,f);assert.equal(b.level,1);
  b.hp=0;kill(g,a);assert.equal(b.level,1,"dead listeners cannot respond");
}
{
  const {g,a,b}=setup(c=>{
    c.cards.hero_blue.triggerRules=[rule("sacrifice",[revive]),rule("heroSacrifice",[level],"self")];
  });
  kill(g,a);assert.equal(a.level,2,"revived source can listen to its own completed sacrifice");assert.equal(b.level,2);
  kill(g,a);assert.equal(a.level,3);assert.equal(b.level,3);
  kill(g,a);assert.equal(a.hp,0);assert.equal(a.level,3);assert.equal(b.level,4);
}
{
  const {g,a,b}=setup(c=>c.cards.hero_green.triggerRules=[rule("heroSacrifice",[revive],"others",1,"eventHero")]);
  kill(g,a);assert.ok(a.hp>0);assert.equal(a.reviveUsage.used,1,"listener can revive the fallen event source");
  assert.equal(b.level,1);
}
{
  const {g,a,b}=setup();g.cards.legacy=1;assert.ok(g.playCard("legacy",a.x,a.y));
  assert.ok(!g.heroes.includes(a));assert.ok(b.level>=2,"permanent destruction also reports completed sacrifice");
}
{
  const {g,a,b,events}=setup(c=>{
    c.cards.hero_green.triggerRules=[rule("heroSacrifice",[{type:"triggerPreparation"}]),
      rule("preparation",[level,{type:"triggerBattleStart"}]),rule("battleStart",[{type:"triggerPreparation"}])];
  });
  const before=b.level;events.length=0;kill(g,a);
  assert.equal(b.level,before+1,"listener echo chain shares the recursion guard");
  assert.equal(events.filter(e=>e.type==="heroSacrifice").length,1);
}
console.log("PASS sacrifice listeners: after all rules, scope/range, repeat deaths, disabled/follower/dead exclusions, self revival, event-source revival, destruction and bounded echo chains");
