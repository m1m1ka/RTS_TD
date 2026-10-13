import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { newTriggerRule } from "../src/config/trigger-rules.js";
import { generationDefaults, generationPool } from "../src/card-generation.js";
const effect = (extra = {}) => ({ type: "generateCard", ...structuredClone(generationDefaults), ...extra });
const fixture = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  return c;
};
{
  const c = fixture(), e = effect({ pool: "selected", cards: ["training"], count: 3 });
  c.cards.hero_blue.triggerRules = [{ ...newTriggerRule(), target: { kind: "allAllies", radius: -1, count: 1 }, effects: [e] }];
  const events = [], g = new Game(ev => events.push(ev), assertConfig(c));
  g.playCard("hero_blue",7,3); g.playCard("hero_green",5,5);
  const before = g.cards.training;
  g.startDay(); assert.equal(g.cards.training, before + 3, "generation is once per rule, not per hero target");
  assert.equal(g.heroes[0].level,1, "generated resources are not auto-played");
  assert.equal(events.filter(e => e.type === "cardsGenerated").length,1);
  g.applyConfig(structuredClone(c)); g.rebuildHero(g.heroes[0]); assert.equal(g.cards.training,before+3);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(c))),c);
}
{
  const c = fixture(), g = new Game(() => {},c);
  for (const category of ["hero","resource","equipment","battle","all"]) {
    const selected = g.generateCards(effect({ category, count: 20 }));
    assert.equal(Object.values(selected).reduce((a,b)=>a+b,0),20);
    assert.ok(Object.keys(selected).every(k => category === "all" || c.cards[k].category === category));
  }
  const random = Math.random;
  try {
    Math.random = () => 0;
    assert.deepEqual(g.generateCards(effect({pool:"selected", cards:["training","coffee"],count:4})),{training:4});
    Math.random = () => .999;
    assert.deepEqual(g.generateCards(effect({pool:"selected", cards:["training","coffee"],count:2})),{coffee:2});
  } finally { Math.random = random; }
  assert.deepEqual(g.generateCards(effect({pool:"selected", cards:["deleted"]})),{});
  assert.deepEqual(generationPool(effect({category:"equipment"}),{}),[]);
}
{
  const c = fixture();
  const generated = effect({pool:"selected",cards:["training"],count:2});
  for (const key of ["hero_blue","coffee","guard","fireball"]) c.cards[key].effects.push(structuredClone(generated));
  const g = new Game(() => {},assertConfig(c)); let count = g.cards.training;
  g.playCard("hero_blue",7,3); assert.equal(g.cards.training,count+=2);
  assert.ok(g.playCard("coffee",7,3), "full-health unit may receive a card that also generates cards"); assert.equal(g.cards.training,count+=2);
  assert.ok(g.playCard("guard",7,3)); assert.equal(g.cards.training,count+=2);
  g.applyConfig(structuredClone(c)); assert.equal(g.cards.training,count);
  g.phase="battle";
  g.enemies=[{id:90,x:5,y:5,hp:1000,maxHp:1000,side:"enemy"},{id:91,x:5,y:6,hp:1000,maxHp:1000,side:"enemy"}];
  g.playCard("fireball",5,5); assert.equal(g.cards.training,count+=2, "area damage does not multiply generation");
  g.phase="route"; g.chooseDay(g.nextDays()[0]); g.playCard("hero_blue",7,3);
  assert.equal(g.cards.training,count,"redeployment does not replay initial on-play effects");
}
{
  const c = fixture(); c.cards.training.effects = [effect({pool:"selected",cards:["training"],count:2})];
  const g=new Game(()=>{},assertConfig(c)); g.playCard("hero_blue",7,3);
  const before=g.cards.training; g.playCard("training",7,3);
  assert.equal(g.cards.training,before+1,"self-generation consumes the played copy exactly once and never recurses");
}
for (const extra of [{count:0},{count:100},{count:1.5},{pool:"unknown"},{category:"unknown"},{pool:"selected",cards:[]},{pool:"selected",cards:["missing"]},{pool:"selected",cards:["coffee","coffee"]}]) {
  const c=fixture(); c.cards.hero_blue.triggerRules=[{...newTriggerRule(),effects:[effect(extra)]}]; assert.throws(()=>assertConfig(c));
}
console.log("PASS generation: category/custom pools, random/fixed quantities, single rule/cast activation, card usage, no auto-play/recursion, hot save, redeployment and validation");
