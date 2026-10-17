export const heroRarities = { common: "普通", rare: "稀有", epic: "史诗" };
export const heroRoles = { tank: "坦克", warrior: "战士", marksman: "射手", assassin: "刺客", support: "辅助" };
export const heroStatFields = {
  maxHp: { label: "基础生命值", min: 1, max: 1000000 },
  atk: { label: "基础攻击力", min: 0, max: 100000 },
  speed: { label: "移动速度（格/秒）", min: .05, max: 20 },
  rate: { label: "攻击速度（次/秒）", min: .05, max: 20 },
  range: { label: "攻击距离（格）", min: 0, max: 24, step: 1 },
  critChance: { label: "暴击率（%）", min: 0, max: 100 },
  "levelGrowth.maxHp": { label: "生命值每级成长", min: 0, max: 100000 },
  "levelGrowth.atk": { label: "攻击力每级成长", min: 0, max: 100000 },
};

export function createHeroStatPresets() {
  const base = {
    tank: [500, 22, 3, .9, 1, 0, 75, 5],
    warrior: [350, 35, 4.5, 1.2, 1, 10, 50, 8],
    marksman: [240, 32, 5, 1.3, 4, 15, 35, 7],
    assassin: [230, 30, 6.5, 1.7, 1, 20, 32, 7],
    support: [280, 24, 4.5, 1.1, 3, 5, 42, 6],
  };
  return Object.fromEntries(Object.entries({ common: 1, rare: 1.25, epic: 1.6 }).map(([rarity, scale]) => [
    rarity, Object.fromEntries(Object.entries(base).map(([role, stats]) => {
      const [hp, attack, speed, rate, range, critChance, hpGrowth, atkGrowth] = stats;
      const scaled = n => Math.round(n * scale * 100) / 100;
      return [role, { maxHp: scaled(hp), atk: scaled(attack), speed, rate, range, critChance,
        levelGrowth: { maxHp: scaled(hpGrowth), atk: scaled(atkGrowth) } }];
    })),
  ]));
}

export function inferHeroRole(card) {
  const type = card.unit?.type || card.useIcon;
  if (["wrenchsmith", "fieldmedic", "chaplain", "antler", "bloodseer", "candlekeeper", "standardbearer", "commander"].includes(type) || card.unit?.combatBehavior === "heal") return "support";
  if (["rivetbot", "ironwarden", "shellguard", "bloodknight", "thornmartyr", "footman"].includes(type)) return "tank";
  if (["raven", "foxblade", "catgirl"].includes(type)) return "assassin";
  if (card.unit?.range >= 3) return "marksman";
  return "warrior";
}

export function applyHeroStatPreset(card, presets) {
  const preset = presets?.[card.rarity]?.[card.role];
  if (card.category !== "hero" || !card.unit || !preset) return;
  for (const key of Object.keys(heroStatFields)) {
    if (key.startsWith("levelGrowth.")) continue;
    card.unit[key] = preset[key];
  }
  card.unit.levelGrowth = structuredClone(preset.levelGrowth);
}

export function syncHeroStatPresets(config) {
  for (const card of Object.values(config.cards || {})) {
    if (card?.statSource === "preset") applyHeroStatPreset(card, config.initial?.heroStatPresets);
  }
  return config;
}

// Old saves retain their exact combat values until the user selects a preset.
export function migrateHeroGrades(config) {
  if (config?.version !== 2 || !config.initial) return config;
  if (config.initial.heroStatPresets === undefined) config.initial.heroStatPresets = createHeroStatPresets();
  for (const card of Object.values(config.cards || {})) {
    if (card?.category !== "hero") continue;
    if (card.rarity === undefined) card.rarity = "common";
    if (card.role === undefined) card.role = inferHeroRole(card);
    if (card.statSource === undefined) card.statSource = "custom";
  }
  return syncHeroStatPresets(config);
}

export const heroRarityClass = card => card.category === "hero"
  ? `rarity-${Object.hasOwn(heroRarities, card.rarity) ? card.rarity : "common"}` : "";
export const heroGradeLabel = card => card.category === "hero"
  ? `${heroRarities[card.rarity] || heroRarities.common} · ${heroRoles[card.role] || heroRoles[inferHeroRole(card)]}` : "";
