export const generationDefaults = { pool: "category", category: "resource", cards: [], count: 1 };
export const generationCategories = { resource: "资源牌", hero: "英雄牌", battle: "战斗牌", equipment: "装备牌", all: "所有卡牌" };
export function generationPool(effect, cards) {
  return effect.pool === "selected"
    ? [...new Set(effect.cards || [])].filter(key => cards[key])
    : Object.keys(cards).filter(key => effect.category === "all" || cards[key].category === effect.category);
}
