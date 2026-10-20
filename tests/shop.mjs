import { redeployHeroes } from "./helpers/redeploy.mjs";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { SHOP_DEFAULTS } from "../src/shop.js";
const fixture = () => {
  const c = structuredClone(DEFAULT_CONFIG); c.days = c.days.slice(0,3);
  c.days[1].kind = "shop"; c.days[1].shop = {...SHOP_DEFAULTS}; c.days[1].waves = [];
  return c;
};
{
  const c = assertConfig(fixture()), events=[], g=new Game(e=>events.push(e),c);
  assert.ok(g.playCard("hero_blue",7,3)); g.playCard("training",7,3);
  const hero=g.heroes[0]; g.playCard("guard",7,3);
  g.phase="reward";g.rewardOptions=["training","coffee","guard","tower","fireball"];
  g.chooseReward([0]);g.gold=30;
  assert.ok(g.chooseDay(c.days[1].id));assert.equal(g.phase,"shop");assert.equal(g.heroes.length,0);
  assert.equal(g.heroReserve[0],hero);assert.equal(hero.level,2);
  const hot = structuredClone(c);
  hot.days[1].obstacles = [{x:7,y:3}];
  g.applyConfig(assertConfig(hot));
  assert.deepEqual([hero.x,hero.y],[7,3], "shop saves cannot move the retained formation");
  assert.equal(g.shop.heroes.length,2);assert.equal(new Set(g.shop.heroes).size,2);
  assert.equal(g.shop.packs.length,2);
  assert.ok(g.shop.packs.every(p=>["hero","resource","equipment"].includes(p.category)));
  const time=g.time;g.tick(100);g.startDay();assert.equal(g.time,time);assert.equal(g.phase,"shop");
  assert.equal(g.playCard("hero_blue",7,3),false);
  const key=g.shop.heroes[0], before=g.cards[key]||0;
  assert.ok(g.buyShopHero(0));assert.equal(g.gold,27);assert.equal(g.cards[key],before+1);
  assert.equal(g.buyShopHero(0),false);assert.equal(g.gold,27);
  const packs=structuredClone(g.shop.packs);
  assert.ok(g.refreshShop());assert.equal(g.gold,26);assert.ok(g.shop.heroes[0]);assert.deepEqual(g.shop.packs,packs);
  for(const i of [0,1]) {
    const gold=g.gold, price=SHOP_DEFAULTS[g.shop.packs[i].category+"PackPrice"];
    assert.ok(g.buyShopPack(i));assert.equal(g.gold,gold-price);
    assert.equal(g.shop.opening.options.length,3);assert.equal(new Set(g.shop.opening.options).size,3);
    assert.ok(g.shop.opening.options.every(key=>c.cards[key].category===g.shop.packs[i].category));
    assert.equal(g.buyShopPack(i),false);assert.equal(g.buyShopHero(0),false);assert.equal(g.refreshShop(),false);assert.equal(g.leaveShop(),false);
    assert.equal(g.choosePackCard(3),false);assert.equal(g.choosePackCard(-1),false);
    const picked=g.shop.opening.options[1], owned=g.cards[picked]||0;
    assert.ok(g.choosePackCard(1));assert.equal(g.cards[picked],owned+1);assert.equal(g.shop.opening,null);
    assert.equal(g.choosePackCard(1),false);assert.equal(g.buyShopPack(i),false);
  }
  assert.ok(g.refreshShop());assert.ok(g.shop.packs.every(p=>p.sold),"hero refresh never restocks packs");
  const gold=g.gold;assert.ok(g.leaveShop());assert.equal(g.phase,"route");assert.equal(g.gold,gold);assert.equal(g.leaveShop(),false);
  assert.ok(g.chooseDay(c.days[2].id));assert.equal(g.phase,"between");assert.equal(g.shop,null);assert.equal(g.heroes.length,0);
  redeployHeroes(g);assert.equal(g.heroes[0].level,2);
  assert.deepEqual([g.heroes[0].x,g.heroes[0].y],[7,3]);assert.equal(g.heroes[0].level,2);assert.ok(g.heroes[0].equipment.includes("guard"));
  assert.ok(!events.some(e=>e.type==="victory"||e.type==="gold"),"shop grants no victory payout");
}
{
  const c=fixture();c.startDayId=c.days[1].id;c.days=c.days.slice(1);
  const g=new Game(()=>{},assertConfig(c));assert.equal(g.phase,"shop");
  const stock=structuredClone(g.shop);
  assert.equal(g.buyShopHero(0),false);assert.equal(g.buyShopPack(0),false);assert.equal(g.refreshShop(),false);
  assert.deepEqual(g.shop,stock);assert.equal(g.gold,0);
  const hot=structuredClone(c);hot.days[0].shop.heroPrice=0;g.applyConfig(assertConfig(hot));
  assert.deepEqual(g.shop,stock,"saving never rerolls stock");assert.ok(g.buyShopHero(0));assert.equal(g.gold,0);
  g.gold=20;assert.ok(g.buyShopPack(0));
  const amount=g.shop.opening.price, category=g.shop.opening.category, gold=g.gold;
  // Remove a generated card definition while opening: retain remaining valid options.
  const next=structuredClone(hot), removed=g.shop.opening.options[0];
  delete next.cards[removed];delete next.initial.cards[removed];
  for(const pool of Object.values(next.rewardPools))delete pool.cards[removed];
  g.applyConfig(assertConfig(next));
  assert.ok(!g.shop.opening.options.includes(removed));assert.equal(g.gold,gold);assert.equal(g.shop.opening.category,category);
  assert.ok(g.choosePackCard(0));
  g.leaveShop();g.chooseDay(g.nextDays()[0]);g.reset();assert.equal(g.gold,0);assert.equal(g.phase,"shop");
}
{
  const c=fixture();c.days=c.days.slice(1,2);c.days[0].next=[];
  const g=new Game(()=>{},assertConfig(c));assert.ok(g.leaveShop());assert.equal(g.phase,"won");
  assert.equal(g.gold,0);assert.deepEqual(g.completedDays,[c.days[0].id]);
}
{
  const c=fixture();c.days=c.days.slice(1,2);c.days[0].next=[];
  const g=new Game(()=>{},assertConfig(c));g.gold=10;
  g.shop.packs[0].category="equipment";
  assert.ok(g.buyShopPack(0));assert.equal(g.gold,7);
  const next=structuredClone(c);
  for(const [key,card] of Object.entries(next.cards)) if(card.category==="equipment") {
    delete next.cards[key];delete next.initial.cards[key];
    for(const pool of Object.values(next.rewardPools))delete pool.cards[key];
  }
  g.applyConfig(assertConfig(next));
  assert.equal(g.shop.opening,null);assert.equal(g.gold,10,"deleted pack options refund the paid price");
  assert.equal(g.shop.packs[0].sold,false);assert.equal(g.buyShopPack(0),false,"empty category cannot charge money");
  assert.ok(g.leaveShop());
}
{
  const c=fixture();delete c.days[1].shop;
  const migrated=assertConfig(c);assert.deepEqual(migrated.days[1].shop,{useDefaults:true});
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))),migrated);
}
for(const mutate of [c=>c.days[1].kind="unknown",c=>c.days[1].shop.heroPrice=-1,c=>c.days[1].shop.refreshCost=1.5,c=>c.days[1].shop.resourcePackPrice=NaN]) {
  const c=fixture();mutate(c);assert.ok(validateConfig(c).length);assert.throws(()=>assertConfig(c));
}
console.log("PASS shop: node entry/exit, hero reserve, gold charges, stock counts, paid refresh, pack categories and three-of-one, sold-out protection, frozen battle, hot edits, terminal shops and portability");
