export const DEFAULT_HERO_RANK_LEVELS = [5, 10, 15];
export const MAX_HERO_RANK = 3;

export function heroRank(card, level = 1) {
  if (card?.category !== "hero") return 0;
  const levels = card.rankLevels || DEFAULT_HERO_RANK_LEVELS;
  let rank = 0;
  while (rank < MAX_HERO_RANK && level >= levels[rank]) rank++;
  return rank;
}

// Overrides live beside their effect, so reordering/copying rules keeps them attached.
// Each rank inherits unconfigured values from rank 0, never from another rank.
export function resolveRankValues(value, rank) {
  if (Array.isArray(value)) return value.map(item => resolveRankValues(item, rank));
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "rankValues")
    .map(([key, item]) => [key, resolveRankValues(item, rank)]));
  const overrides = value.rankValues?.[rank];
  if (rank > 0 && overrides && typeof overrides === "object")
    for (const [key, number] of Object.entries(overrides))
      if (typeof result[key] === "number" && Number.isFinite(number)) result[key] = number;
  return result;
}

export function rankedHeroCard(card, level) {
  return card?.category === "hero" ? resolveRankValues(card, heroRank(card, level)) : card;
}

export const isRankValuePath = path => /^(?:effects\.\d+|triggerRules\.\d+\.(?:trigger|target|effects\.\d+)|unit\.(?:healing|mechanics\.(?:arrowReduction|knockback)))\.[a-zA-Z]\w*$/.test(path);

export function heroRankConfigErrors(card) {
  const errors = [], object = v => v && typeof v === "object" && !Array.isArray(v);
  if (card.rankLevels !== undefined) {
    if (card.category !== "hero") errors.push("只有英雄牌可以配置英雄升阶等级");
    const levels = card.rankLevels;
    if (!Array.isArray(levels) || levels.length !== 3 || levels.some((v, i) => !Number.isInteger(v) || v < 2 || v > 9999 || (i > 0 && v <= levels[i - 1])))
      errors.push("升阶等级需要三个递增整数（2～9999），分别对应 1、2、3 阶");
  }
  function visit(value, path = "") {
    if (!value || typeof value !== "object") return;
    if (Object.hasOwn(value, "rankValues")) {
      if (card.category !== "hero" || !object(value.rankValues)) errors.push(`${path}：阶数数值只支持英雄效果，且必须为对象`);
      else for (const [rank, overrides] of Object.entries(value.rankValues)) {
        if (!["1", "2", "3"].includes(rank) || !object(overrides)) { errors.push(`${path}：只支持 1～3 阶的数值配置`); continue; }
        for (const [key, number] of Object.entries(overrides))
          if (!isRankValuePath(`${path}.${key}`) || typeof value[key] !== "number" || !Number.isFinite(number))
            errors.push(`${path} ${rank} 阶：${key} 必须是现有效果的有限数值`);
      }
    }
    for (const [key, child] of Object.entries(value))
      if (key !== "rankValues") visit(child, path ? `${path}.${key}` : key);
  }
  visit(card);
  return errors;
}

export function migrateHeroRanks(config) {
  if (config?.version === 2 && config.cards)
    for (const card of Object.values(config.cards))
      if (card?.category === "hero") card.rankLevels ??= [...DEFAULT_HERO_RANK_LEVELS];
  return config;
}
