export const generationDefaults = { pool: "category", category: "resource", cards: [], count: 1 };
export const generationCategories = { resource: "资源牌", hero: "英雄牌", battle: "战斗牌", equipment: "装备牌", all: "所有卡牌" };
export function setGenerationCandidates(effect, keys, cards) {
  effect.cards = [...new Set(keys)].filter(key => typeof key === "string" && Object.hasOwn(cards, key));
}
export function pruneGenerationCandidates(config) {
  for (const card of Object.values(config.cards)) {
    const effects = [...(card.effects || []), ...(card.triggerRules || []).flatMap(rule => rule.effects || []),
      ...(card.skillTiers || []).flatMap(tier => tier.effects || [])];
    for (const effect of effects) if (effect.type === "generateCard")
      setGenerationCandidates(effect, effect.cards || [], config.cards);
  }
}
export function generationPool(effect, cards) {
  return effect.pool === "selected"
    ? [...new Set(effect.cards || [])].filter(key => cards[key])
    : Object.keys(cards).filter(key => effect.category === "all" || cards[key].category === effect.category);
}
