import { drawWeightedCards } from "./rewards.js";
import { economySettings, migrateEconomy } from "./economy.js";
import { syncSkillCards } from "./skill-cards.js";

export function cardSellPrice(game, key) {
  const card = game.config.cards[key], prices = economySettings(game.config);
  if (!card) return 0;
  return prices[card.category === "hero" ? (card.rarity || "common") + "HeroSellPrice" : card.category + "SellPrice"] ?? 0;
}
export function sellableCards(game) {
  const skills = syncSkillCards(game), rows = [];
  for (const [key, count] of Object.entries(game.cards)) {
    const card = game.config.cards[key];
    if (!card || count <= 0) continue;
    if (card.category === "battle") {
      for (const copy of skills.filter(c => c.cardId === key))
        rows.push({ key, instance: copy.id, count: 1, detail: `${copy.tier} 阶` });
    } else if (card.category === "hero") {
      const reserves = game.heroReserve.filter(h => h.cardId === key).slice(0, count);
      for (const hero of reserves)
        rows.push({ key, instance: `reserve-${hero.id}`, count: 1, detail: `Lv.${hero.level} · ${hero.rank ?? 0} 阶 · 含已装备物品` });
      if (count > reserves.length) rows.push({ key, instance: "", count: count - reserves.length, detail: "未培养英雄牌" });
    } else rows.push({ key, instance: "", count, detail: "" });
  }
  return rows.map(row => ({ ...row, price: cardSellPrice(game, row.key) }));
}
export function sellShopCard(game, key, instance = "") {
  if (game.phase !== "shop" || !game.shop || game.shop.opening) return false;
  const row = sellableCards(game).find(r => r.key === key && r.instance === instance);
  if (!row) return false;
  if (instance.startsWith("reserve-")) game.heroReserve = game.heroReserve.filter(h => `reserve-${h.id}` !== instance);
  else if (game.config.cards[key].category === "battle") game.skillCards = game.skillCards.filter(c => c.id !== instance);
  if (--game.cards[key] <= 0) delete game.cards[key];
  game.gold += row.price;
  game.shop.revision++;
  game.emit("cardSold", { card: key, amount: row.price });
  return true;
}
export const SHOP_DEFAULTS = { heroPrice: 3, refreshCost: 1, heroPackPrice: 3, resourcePackPrice: 2, equipmentPackPrice: 3 };
export const packNames = { hero: "英雄卡包", resource: "资源卡包", equipment: "装备卡包" };
export function migrateShops(c) {
  if (c?.version !== 2 || !Array.isArray(c.days)) return c;
  migrateEconomy(c);
  for (const day of c.days) {
    if (!day || typeof day !== "object") continue;
    day.kind ??= "battle";
    if (day.kind === "shop") {
      day.shop ??= {};
      // Old stock defaults inherit the new global economy; custom prices remain local.
      day.shop.useDefaults ??= !day.shop.heroPrices && day.shop.refreshIncrease === undefined &&
        Object.entries(SHOP_DEFAULTS).every(([key, value]) => day.shop[key] === undefined || day.shop[key] === value);
      day.waves ??= [];
    }
  }
  return c;
}
export function sampleCards(pool, count) {
  const result = []; let available = [...pool];
  if (!pool.length) return result;
  for (let i = 0; i < count; i++) {
    if (!available.length) available = [...pool];
    result.push(available.splice(Math.floor(Math.random() * available.length), 1)[0]);
  }
  return result;
}
export const categoryCards = (game, category) => Object.keys(game.config.cards).filter(k => game.config.cards[k].category === category);
export function shopPrices(game) {
  const defaults = economySettings(game.config), settings = game.config.days[game.day].shop;
  const local = settings?.useDefaults === false || (settings && settings.useDefaults === undefined) ? settings : {};
  const prices = { ...defaults, ...local };
  prices.heroPrices = Object.fromEntries(["common", "rare", "epic"].map(rarity =>
    [rarity, local.heroPrices?.[rarity] ?? local.heroPrice ?? defaults[rarity + "HeroPrice"]]));
  prices.baseRefreshCost = prices.refreshCost;
  prices.refreshCost += (game.shop?.refreshCount || 0) * prices.refreshIncrease;
  return prices;
}
export const heroShopPrice = (game, key) => shopPrices(game).heroPrices[game.config.cards[key]?.rarity || "common"];
export function shopPoolWeights(game, category, pack = false) {
  const id = game.config.days[game.day].shop?.[category + (pack ? "Pack" : "") + "Pool"];
  const weights = id ? (game.config.rewardPools?.[id]?.cards || {}) : Object.fromEntries(categoryCards(game, category).map(key => [key, 1]));
  return Object.fromEntries(Object.entries(weights).filter(([key, weight]) => weight > 0 && game.config.cards[key]?.category === category));
}
const drawShopCards = (game, category, count, pack = false) => drawWeightedCards(game.config, shopPoolWeights(game, category, pack), count);
export function enterShop(game) {
  game.phase = "shop";
  const categories = Object.keys(packNames).filter(category => Object.keys(shopPoolWeights(game, category, true)).length);
  game.shop = {
    heroes: drawShopCards(game, "hero", 2),
    packs: sampleCards(categories, 2).map(category => ({ category, sold: false })),
    opening: null, revision: 0, refreshCount: 0,
  };
}
export function refreshShop(game) {
  if (game.phase !== "shop" || game.shop.opening || !Object.keys(shopPoolWeights(game, "hero")).length) return false;
  const cost = shopPrices(game).refreshCost;
  if (game.gold < cost) return false;
  game.gold -= cost;
  game.shop.refreshCount = (game.shop.refreshCount || 0) + 1;
  game.shop.heroes = drawShopCards(game, "hero", 2);
  game.shop.revision++;
  game.emit("shopRefresh"); return true;
}
export function buyShopHero(game, index) {
  if (game.phase !== "shop" || game.shop.opening || !Number.isInteger(index)) return false;
  const key = game.shop.heroes[index], price = heroShopPrice(game, key);
  if (!key || game.config.cards[key]?.category !== "hero" || game.gold < price) return false;
  game.gold -= price; game.shop.heroes[index] = null;
  game.cards[key] = (game.cards[key] || 0) + 1;
  game.emit("shopPurchase", { card: key, price }); return true;
}
export function buyShopPack(game, index) {
  if (game.phase !== "shop" || game.shop.opening || !Number.isInteger(index)) return false;
  const pack = game.shop.packs[index];
  if (!pack || pack.sold) return false;
  const price = shopPrices(game)[pack.category + "PackPrice"], pool = Object.keys(shopPoolWeights(game, pack.category, true));
  if (!pool.length || game.gold < price) return false;
  game.gold -= price; pack.sold = true;
  game.shop.opening = { index, price, category: pack.category, options: drawShopCards(game, pack.category, 3, true) };
  game.emit("packOpened", { category: pack.category }); return true;
}
export function choosePackCard(game, index) {
  if (game.phase !== "shop" || !game.shop.opening || !Number.isInteger(index)) return false;
  const key = game.shop.opening.options[index];
  if (!key || !game.config.cards[key]) return false;
  game.cards[key] = (game.cards[key] || 0) + 1;
  game.shop.opening = null;
  game.emit("shopPurchase", { card: key }); return true;
}
export function reconcileShop(game) {
  if (game.phase !== "shop" || !game.shop) return;
  game.shop.heroes = game.shop.heroes.map(key => game.config.cards[key]?.category === "hero" ? key : null);
  const opening = game.shop.opening;
  if (opening) {
    opening.options = opening.options.filter(key => game.config.cards[key]?.category === opening.category);
    if (!opening.options.length) {
      game.gold += opening.price;
      game.shop.packs[opening.index].sold = false;
      game.shop.opening = null;
      game.emit("toast", { text: "卡包候选已被配置移除，金币已退回" });
    }
  }
}
