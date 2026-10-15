import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
import { assertConfig } from "../src/config/schema.js";
const prep=(effects,target={kind:"self",radius:-1,count:1})=>({...newTriggerRule(),trigger:{event:"preparation",scope:"any",radius:-1},target,effects});
const echo={type:"triggerPreparation"},level={type:"level",value:1};
const config=()=>{const c=structuredClone(DEFAULT_CONFIG);for(const card of Object.values(c.cards))if(card.category==="hero")card.triggerRules=[];return c;};
{
  const c=config();c.cards.hero_blue.triggerRules=[prep([level,echo])];
  const events=[],g=new Game(e=>events.push(e),assertConfig(c));g.playCard("hero_blue",4,4);
  assert.equal(g.heroes[0].level,3,"natural preparation can echo itself once, never recursively forever");
  assert.deepEqual(events.filter(e=>e.type==="heroPreparation").map(e=>e.extra),[false,true]);
  g.heroTriggers.prepare();g.applyConfig(assertConfig(c));assert.equal(g.heroes[0].level,3);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))),c);
}
{
  const c=config();c.cards.hero_blue.triggerRules=[prep([level,{type:"generateCard",pool:"selected",category:"resource",cards:["training"],count:1},{type:"summonFollower",hpPercent:50,atkPercent:50,count:1}]),{...prep([{type:"level",value:99}]),enabled:false},{...newTriggerRule(),effects:[echo]}];
  const events=[],g=new Game(e=>events.push(e),c),initial=g.cards.training;
  g.playCard("hero_blue",4,4);const h=g.heroes[0],day=h.preparedDayId;
  assert.equal(h.level,2);assert.equal(g.cards.training,initial+1);assert.equal(g.followers.length,1);
  g.startDay();assert.equal(h.level,3);assert.equal(g.cards.training,initial+2);assert.equal(g.followers.length,2);
  const phase=g.phase,wait=g.waveWait;g.cards.war_drum=1;g.playCard("war_drum",h.x,h.y);
  assert.equal(h.level,4);assert.equal(g.cards.training,initial+3);assert.equal(g.followers.length,3);
  assert.equal(h.preparedDayId,day);assert.equal(g.phase,phase);assert.equal(g.waveWait,wait);
  assert.equal(events.filter(e=>e.type==="day").length,1,"echo never starts a new day or replays the start click");
}
{
  const c=config();const near={kind:"nearest",radius:2,count:1};
  c.cards.hero_blue.triggerRules=[prep([level,{type:"triggerBattleStart"}],near)];
  c.cards.hero_green.triggerRules=[{...newTriggerRule(),target:near,effects:[echo]},prep([level])];
  const events=[],g=new Game(e=>events.push(e),c);g.playCard("hero_green",5,4);g.playCard("hero_blue",4,4);
  assert.equal(events.filter(e=>e.type==="heroPreparation"&&e.unit===g.heroes[1]).length,2);
  assert.equal(events.filter(e=>e.type==="heroBattleStart").length,1,"mixed preparation/start cycle shares one guard");
  assert.equal(g.heroes[0].level,4);
}
{
  const c=config();c.cards.hero_blue.triggerRules=[prep([level])];
  c.cards.hero_green.triggerRules=[prep([echo],{kind:"nearest",radius:1,count:1})];
  const g=new Game(()=>{},c);g.playCard("hero_blue",4,4);g.playCard("hero_green",5,4);
  const [a,b]=g.heroes;assert.equal(a.level,3);
  a.preparedDayId=undefined;b.preparedDayId=undefined;
  g.heroTriggers.prepare([b]);assert.equal(a.level,4);assert.equal(a.preparedDayId,undefined,"extra preparation does not consume normal preparation");
  g.heroTriggers.prepare([a]);assert.equal(a.level,5);
  a.hp=0;b.preparedDayId=undefined;g.heroTriggers.prepare([b]);assert.equal(a.level,5,"dead targets are excluded");
}
console.log("PASS preparation echo: configurable/portable effect, self echo, combat repeats, full enabled rule payloads, mixed-event cycles, range/death filtering and independent normal preparation");
