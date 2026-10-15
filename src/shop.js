export const SHOP_DEFAULTS = { heroPrice: 3, refreshCost: 1, heroPackPrice: 3, resourcePackPrice: 2, equipmentPackPrice: 3 };
export const packNames = { hero: "英雄卡包", resource: "资源卡包", equipment: "装备卡包" };
export function migrateShops(c) {
  if (c?.version !== 2 || !Array.isArray(c.days)) return c;
  for (const day of c.days) {
    if (!day || typeof day !== "object") continue;
    day.kind ??= "battle";
    if (day.kind === "shop") { day.shop ??= { ...SHOP_DEFAULTS }; day.waves ??= []; }
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
export const shopPrices = game => ({ ...SHOP_DEFAULTS, ...game.config.days[game.day].shop });
export function enterShop(game) {
  game.phase = "shop";
  const categories = Object.keys(packNames).filter(category => categoryCards(game, category).length);
  game.shop = {
    heroes: sampleCards(categoryCards(game, "hero"), 2),
    packs: sampleCards(categories, 2).map(category => ({ category, sold: false })),
    opening: null, revision: 0,
  };
}
export function refreshShop(game) {
  if (game.phase !== "shop" || game.shop.opening || !categoryCards(game, "hero").length) return false;
  const cost = shopPrices(game).refreshCost;
  if (game.gold < cost) return false;
  game.gold -= cost;
  game.shop.heroes = sampleCards(categoryCards(game, "hero"), 2);
  game.shop.revision++;
  game.emit("shopRefresh"); return true;
}
export function buyShopHero(game, index) {
  if (game.phase !== "shop" || game.shop.opening || !Number.isInteger(index)) return false;
  const key = game.shop.heroes[index], price = shopPrices(game).heroPrice;
  if (!key || game.config.cards[key]?.category !== "hero" || game.gold < price) return false;
  game.gold -= price; game.shop.heroes[index] = null;
  game.cards[key] = (game.cards[key] || 0) + 1;
  game.emit("shopPurchase", { card: key, price }); return true;
}
export function buyShopPack(game, index) {
  if (game.phase !== "shop" || game.shop.opening || !Number.isInteger(index)) return false;
  const pack = game.shop.packs[index];
  if (!pack || pack.sold) return false;
  const price = shopPrices(game)[pack.category + "PackPrice"], pool = categoryCards(game, pack.category);
  if (!pool.length || game.gold < price) return false;
  game.gold -= price; pack.sold = true;
  game.shop.opening = { index, price, category: pack.category, options: sampleCards(pool, 3) };
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
