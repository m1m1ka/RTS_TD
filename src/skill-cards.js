// Inventory counts remain compatible with rewards/generation; skill copies own their state.
export function defaultSkillTiers(card) {
  return [1, 2].map(level => ({
    cooldown: Math.max(1, (card.cooldown ?? 12) - level * 2),
    effects: structuredClone(card.effects || []).map(effect => {
      if (["damage", "heal"].includes(effect.type)) effect.value = Math.min(effect.valueMode === "percent" ? 100 : 100000, effect.value * 3 ** level);
      if (effect.type === "slow") {
        effect.duration = Math.min(120, effect.duration * 2 ** level);
        effect.value = Math.min(.95, effect.value + .1 * level);
      }
      if ("radius" in effect) effect.radius = Math.min(24, effect.radius + level);
      if (effect.type === "generateCard") effect.count = Math.min(20, effect.count * 2 ** level);
      return effect;
    }),
  }));
}
export function migrateSkillCards(config) {
  for (const card of Object.values(config?.cards || {})) if (card?.category === "battle") {
    card.cooldown ??= 12;
    card.skillTiers ??= defaultSkillTiers(card);
  }
  return config;
}
export function skillDefinition(card, tier = 1) {
  if (card?.category !== "battle") return card;
  const upgrade = tier > 1 ? (card.skillTiers ?? defaultSkillTiers(card))[tier - 2] : null;
  const result = { ...card, cooldown: upgrade?.cooldown ?? card.cooldown ?? 12, effects: upgrade?.effects ?? card.effects };
  if (tier > 1) result.text = skillEffectText(result);
  return result;
}
export function skillEffectText(card) {
  return card.effects.map(effect => {
    if (effect.type === "heal") return `恢复 ${effect.value}${effect.valueMode === "percent" ? "% 最大生命" : " 生命"}`;
    if (effect.type === "damage") return `${effect.radius ? `范围 ${effect.radius} 格` : "单体"} · ${effect.value}${effect.valueMode === "percent" ? "% 最大生命" : ""} 伤害`;
    if (effect.type === "slow") return `范围 ${effect.radius} 格 · 减速 ${Math.round(effect.value * 100)}% · ${effect.duration} 秒`;
    if (effect.type === "generateCard") return `获得 ${effect.count} 张卡牌`;
    return "";
  }).filter(Boolean).join("；");
}
export function syncSkillCards(game) {
  game.skillCards ??= [];
  game.skillCardId ??= 0;
  game.skillCards = game.skillCards.filter(copy => game.config.cards[copy.cardId]?.category === "battle" && game.cards[copy.cardId] > 0);
  for (const [key, count] of Object.entries(game.cards)) {
    const card = game.config.cards[key];
    if (card?.category !== "battle") continue;
    const copies = game.skillCards.filter(copy => copy.cardId === key);
    // Configuration deletion of upper tiers downgrades retained cards, preserving cooldown.
    for (const copy of copies) copy.tier = Math.min(copy.tier, (card.skillTiers ?? defaultSkillTiers(card)).length + 1);
    if (copies.length > count) {
      const removed = new Set(copies.slice(count));
      game.skillCards = game.skillCards.filter(copy => !removed.has(copy));
    }
    for (let i = copies.length; i < count; i++)
      game.skillCards.push({ id: `skill-${++game.skillCardId}`, cardId: key, tier: 1, readyAt: 0, cooldown: 0 });
  }
  return game.skillCards;
}
export function skillCopy(game, key, id) {
  const copies = syncSkillCards(game).filter(copy => copy.cardId === key);
  return id ? copies.find(copy => copy.id === id) : copies.find(copy => copy.readyAt <= game.time + 1e-9) || copies[0];
}
export function fusionOptions(game) {
  const groups = new Map();
  for (const copy of syncSkillCards(game)) {
    const key = `${copy.cardId}:${copy.tier}`;
    if (!groups.has(key)) groups.set(key, { cardId: copy.cardId, tier: copy.tier, copies: [] });
    groups.get(key).copies.push(copy);
  }
  return [...groups.values()].map(group => ({ ...group,
    maxed: group.tier > (game.config.cards[group.cardId].skillTiers ?? defaultSkillTiers(game.config.cards[group.cardId])).length,
  }));
}
export function fuseSkillCards(game, key, tier) {
  if (game.phase !== "shop" || !game.shop || game.shop.opening || !Number.isInteger(tier)) return false;
  const group = fusionOptions(game).find(group => group.cardId === key && group.tier === tier);
  if (!group || group.maxed || group.copies.length < 3) return false;
  const materials = group.copies.slice(0, 3), removed = new Set(materials);
  // Fusion never bypasses a material's remaining cooldown.
  const readyAt = Math.max(game.time, ...materials.map(copy => copy.readyAt));
  game.skillCards = game.skillCards.filter(copy => !removed.has(copy));
  game.skillCards.push({ id: `skill-${++game.skillCardId}`, cardId: key, tier: tier + 1, readyAt, cooldown: Math.max(0, readyAt - game.time) });
  game.cards[key] -= 2;
  game.emit("skillFused", { card: key, tier: tier + 1 });
  return true;
}
