import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
const clone=structuredClone;
const rule=(event,effects=[{type:"level",value:1}],extra={})=>({...newTriggerRule(),trigger:{event,scope:"any",radius:-1},effects,...extra});
function setup(edit) {
  const c=clone(DEFAULT_CONFIG);
  for(const card of Object.values(c.cards))if(card.category==="hero")card.triggerRules=[];
  c.cards.hero_blue.unit.mechanics={deathsAsSacrifice:true};
  c.cards.hero_purple.triggerRules=[rule("heroSacrifice")];
  edit?.(c);
  const events=[],g=new Game(e=>events.push(e),assertConfig(c));
  for(const[key,x,y]of[["hero_blue",4,4],["hero_green",5,4],["hero_purple",8,4]])g.playCard(key,x,y);
  return {g,c,events,owner:g.heroes[0],victim:g.heroes[1],listener:g.heroes[2]};
}
const kill=(g,h)=>g.hit(h,1000000,{side:"enemy"});
{
  const {g,victim,listener,events}=setup();
  kill(g,victim);assert.equal(listener.level,2,"ordinary death now notifies sacrifice listeners");
  assert.equal(events.filter(e=>e.type==="heroSacrifice").length,1);
  kill(g,victim);assert.equal(listener.level,2,"hitting the corpse cannot repeat the event");
  g.reviveHero(victim,{maxRevives:2,hpPercent:50},listener);kill(g,victim);assert.equal(listener.level,3,"each real death can notify");
}
{
  const {g,victim,listener,events}=setup(c=>{
    c.cards.hero_green.triggerRules=[rule("sacrifice"),rule("sacrifice")];
    c.cards.hero_purple.unit.mechanics={deathsAsSacrifice:true};
  });
  kill(g,victim);assert.equal(victim.level,3,"existing sacrifice payloads still run exactly once each");
  assert.equal(listener.level,2);assert.equal(events.filter(e=>e.type==="heroSacrifice").length,1,"multiple carriers and rules do not multiply the notification");
}
{
  const {g,owner,victim,listener}=setup();
  kill(g,owner);assert.equal(listener.level,2,"carrier's own final death counts");
  kill(g,victim);assert.equal(listener.level,2,"dead carrier no longer converts others' deaths");
  g.reviveHero(owner,{maxRevives:2,hpPercent:50},listener);
  g.reviveHero(victim,{maxRevives:2,hpPercent:50},listener);
  kill(g,victim);assert.equal(listener.level,3,"carrier revival restores passive");
}
{
  const {g,c,owner,victim,listener}=setup();
  c.cards.hero_blue.unit.mechanics.deathsAsSacrifice=false;g.applyConfig(clone(c));
  kill(g,victim);assert.equal(listener.level,1);
  c.cards.hero_blue.unit.mechanics.deathsAsSacrifice=true;g.applyConfig(clone(c));assert.equal(listener.level,1,"hot enabling does not replay past deaths");
  g.reviveHero(victim,{maxRevives:2,hpPercent:50},owner);kill(g,victim);assert.equal(listener.level,2);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))),c);
}
{
  const {g,owner,victim,listener,events}=setup();
  const [f]=g.summonFollowers(owner,{hpPercent:50,atkPercent:50,count:1});kill(g,f);
  g.cards.tower=1;g.playCard("tower",6,6);kill(g,g.towers[0]);
  kill(g,{id:999,side:"enemy",hp:1,maxHp:1,x:2,y:2});
  assert.equal(listener.level,1,"followers, towers and enemies do not count");
  g.cards.legacy=1;g.playCard("legacy",victim.x,victim.y);
  assert.equal(events.filter(e=>e.type==="heroSacrifice").length,1,"permanent destruction also notifies");
}
{
  const {g,owner,events}=setup();g.cards.legacy=1;g.playCard("legacy",owner.x,owner.y);
  assert.equal(events.filter(e=>e.type==="heroSacrifice").length,1,"destroying the carrier counts its own death before it leaves");
}
{
  const {g,victim,listener}=setup(c=>c.cards.hero_purple.triggerRules=[rule("heroSacrifice",[{type:"revive",maxRevives:1,hpPercent:50}],{target:{kind:"eventHero",radius:-1,count:1}})]);
  kill(g,victim);assert.ok(victim.hp>0,"converted death can be used by an ally to revive the victim");
  assert.equal(victim.reviveUsage.used,1);assert.equal(listener.level,1);
}
{
  const {g,victim,listener}=setup(c=>{
    c.cards.hero_blue.unit.mechanics.dormant=true;
    c.cards.hero_green.triggerRules=[{...rule("sacrifice"),enabled:false}];
    c.cards.hero_purple.triggerRules=[rule("heroSacrifice",undefined,{trigger:{event:"heroSacrifice",scope:"others",radius:1}})];
  });
  kill(g,victim);assert.equal(listener.level,1,"existing listener radius is still respected");
  g.reviveHero(victim,{maxRevives:1,hpPercent:50},listener);Object.assign(listener,{x:6,y:4});
  kill(g,victim);assert.equal(listener.level,2,"passive also works while carrier sleeps; disabled sacrifice rules are not required");
}
{
  const {g,victim,listener}=setup(c=>c.cards.hero_purple.unit.mechanics={dormant:true});
  kill(g,victim);assert.equal(listener.level,1,"sleeping listener still cannot execute its rules");
}
{
  const c=clone(DEFAULT_CONFIG);c.cards.hero_blue.unit.mechanics={deathsAsSacrifice:"true"};assert.throws(()=>assertConfig(c));
}
console.log("PASS death-to-sacrifice: plain deaths, once-only rules/carriers, carrier death/revival/removal, hot toggles, exclusions, destruction, event-target resurrection, scope/radius, dormancy and portable validation");
