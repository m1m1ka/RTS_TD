import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { SHOP_DEFAULTS, shopPrices, heroShopPrice, enterShop } from "../src/shop.js";
import { ECONOMY_DEFAULTS } from "../src/economy.js";
import { victoryPayout } from "../src/gold.js";
import { addVictoryBonus, finishVictoryBonuses } from "../src/hero-mechanics.js";
function fixture() {
  const c = structuredClone(DEFAULT_CONFIG);
  c.days[0].kind = "shop"; c.days[0].shop = { useDefaults: true };
  c.cards.hero_blue.rarity = "common"; c.cards.hero_green.rarity = "rare"; c.cards.hero_purple.rarity = "epic";
  return assertConfig(c);
}
{
  const c = fixture(), g = new Game(() => {}, c);
  g.gold = 100;
  for (const [key, price] of [["hero_blue", 3], ["hero_green", 5], ["hero_purple", 8]]) {
    g.shop.heroes = [key]; assert.equal(heroShopPrice(g, key), price);
    const gold = g.gold; assert.ok(g.buyShopHero(0)); assert.equal(g.gold, gold - price);
    assert.equal(g.buyShopHero(0), false); assert.equal(g.gold, gold - price);
  }
  g.shop.heroes = ["hero_purple"]; g.gold = 7;
  assert.equal(g.buyShopHero(0), false); assert.equal(g.gold, 7);
  g.gold = 100;
  for (const category of ["hero", "resource", "equipment"]) {
    g.shop.packs = [{ category, sold: false }];
    const gold = g.gold; assert.ok(g.buyShopPack(0));
    assert.equal(g.gold, gold - c.initial.economy[category + "PackPrice"]); assert.ok(g.choosePackCard(0));
  }
}
{
  const c = fixture(); Object.assign(c.initial.economy, { refreshCost: 2, refreshIncrease: 3 });
  const g = new Game(() => {}, c); g.gold = 100;
  for (const cost of [2, 5, 8]) {
    assert.equal(shopPrices(g).refreshCost, cost);
    const before = g.gold; assert.ok(g.refreshShop()); assert.equal(g.gold, before - cost);
  }
  g.gold = 10; const stock = structuredClone(g.shop);
  assert.equal(g.refreshShop(), false); assert.deepEqual(g.shop, stock);
  const hot = structuredClone(c); hot.initial.economy.refreshIncrease = 2; hot.initial.economy.epicHeroPrice = 17;
  g.applyConfig(hot); assert.equal(shopPrices(g).refreshCost, 8); assert.equal(heroShopPrice(g, "hero_purple"), 17);
  assert.equal(g.shop.refreshCount, 3, "saving preserves the successful refresh count");
  enterShop(g); assert.equal(shopPrices(g).refreshCost, 2, "new shop resets escalation");
  hot.initial.economy.refreshIncrease = 0; hot.initial.economy.refreshCost = 0; g.applyConfig(hot);
  g.gold = 0; assert.ok(g.refreshShop()); assert.ok(g.refreshShop()); assert.equal(g.gold, 0);
}
{
  const c = fixture(); c.days[0].shop = { useDefaults: false, heroPrices: { common: 1, rare: 2, epic: 3 }, refreshCost: 4, refreshIncrease: 5, heroPackPrice: 8 };
  const g = new Game(() => {}, assertConfig(c)); g.gold = 100;
  assert.equal(heroShopPrice(g, "hero_purple"), 3); assert.equal(shopPrices(g).heroPackPrice, 8);
  g.refreshShop(); assert.equal(shopPrices(g).refreshCost, 9);
  const hot = structuredClone(g.config); hot.days[0].shop.useDefaults = true; g.applyConfig(hot);
  assert.equal(heroShopPrice(g, "hero_purple"), 8); assert.equal(shopPrices(g).refreshCost, 2);
}
for (const [fixed, mine] of [[0, 0], [9, 7], [999, 999]]) {
  const c = fixture(); Object.assign(c.initial.economy, { victoryGold: fixed, mineGold: mine });
  const payout = victoryPayout([{ x: 1, y: 1, hp: 1 }, { x: 2, y: 2, hp: 0 }, { x: 3, y: 3, hp: 50 }], c);
  assert.equal(payout.total, fixed + 2 * mine);
  assert.equal(payout.coins.reduce((n, coin) => n + coin.amount, 0), payout.total);
  assert.ok(payout.coins.length <= 20); assert.ok(payout.duration < 8);
  assert.ok(payout.coins.every(coin => coin.amount > 0 && !(coin.x === 2 && coin.y === 2)));
  assert.ok(payout.coins.every((coin, i) => !i || coin.at >= payout.coins[i - 1].at));
}
{
  const c = fixture(); c.initial.economy.victoryGold = c.initial.economy.mineGold = 0;
  const payout = victoryPayout([], c); addVictoryBonus(payout, { id: 1, x: 3, y: 3 }, 7); finishVictoryBonuses(payout);
  assert.equal(payout.total, 7); assert.ok(payout.coins.every(coin => Number.isFinite(coin.at)));
}
{
  const c = structuredClone(DEFAULT_CONFIG); c.initial.firstWaveDelay = 0;
  Object.assign(c.initial.economy, { victoryGold: 9, mineGold: 7 });
  c.days[0].waves = [c.days[0].waves[0]];
  c.days[0].mines = [{ x: 3, y: 3, maxHp: 180 }, { x: 4, y: 3, maxHp: 180 }];
  c.cards.hero_blue.triggerRules = [];
  const g = new Game(() => {}, assertConfig(c));
  g.playCard("hero_blue", 7, 3); g.startDay(); g.mines[1].hp = 0;
  g.spawnQueues.forEach(q => q.spawned = q.types.length); g.enemies = []; g.tick(0);
  assert.equal(g.settlement.total, 16);
  const hot = structuredClone(c); hot.initial.economy.victoryGold = 99; g.applyConfig(hot);
  g.tick(10); assert.equal(g.gold, 16, "settlement is snapshotted once at victory");
  g.tick(100); assert.equal(g.gold, 16);
}
{
  const c = fixture(); delete c.initial.economy; c.days[0].shop = { ...SHOP_DEFAULTS };
  const migrated = assertConfig(c);
  assert.deepEqual(migrated.initial.economy, ECONOMY_DEFAULTS); assert.equal(migrated.days[0].shop.useDefaults, true);
  c.days[0].shop.heroPrice = 11;
  const custom = assertConfig(c), g = new Game(() => {}, custom);
  assert.equal(custom.days[0].shop.useDefaults, false); assert.equal(heroShopPrice(g, "hero_purple"), 11, "legacy custom flat prices are retained");
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(custom))), custom);
}
for (const key of Object.keys(ECONOMY_DEFAULTS)) for (const value of [-1, .5, 1000, NaN]) {
  const c = fixture(); c.initial.economy[key] = value; assert.throws(() => assertConfig(c));
}
console.log("PASS economy: rarity prices, pack prices, escalating refresh/failure/reset/hot edits, shop overrides, zero/large rewards, surviving mines, settlement snapshots, bonuses, legacy defaults and validation");
