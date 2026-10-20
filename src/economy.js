export const ECONOMY_DEFAULTS = {
  commonHeroPrice: 3, rareHeroPrice: 5, epicHeroPrice: 8,
  heroPackPrice: 3, resourcePackPrice: 2, equipmentPackPrice: 3,
  refreshCost: 1, refreshIncrease: 1, mineGold: 2, victoryGold: 4,
  commonHeroSellPrice: 1, rareHeroSellPrice: 2, epicHeroSellPrice: 4,
  battleSellPrice: 1, resourceSellPrice: 1, equipmentSellPrice: 1,
};
export const economySettings = config => ({ ...ECONOMY_DEFAULTS, ...config.initial?.economy });
export function migrateEconomy(config) {
  if (config?.version !== 2 || !config.initial) return config;
  config.initial.economy ??= { ...ECONOMY_DEFAULTS };
  if (typeof config.initial.economy === "object" && !Array.isArray(config.initial.economy))
    for (const [key, value] of Object.entries(ECONOMY_DEFAULTS)) config.initial.economy[key] ??= value;
  return config;
}
