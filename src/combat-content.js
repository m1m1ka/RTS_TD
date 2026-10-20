// Upgrade existing saved content once, retaining custom healing values and other effects.
export function migrateCombatContent(config) {
  if (!config?.cards || config.combatContentVersion >= 1) return config;
  const coffee = config.cards.coffee;
  if (coffee?.category === "resource" && coffee.effects?.some(e => e.type === "heal")) {
    coffee.category = "battle";
    coffee.target = "hero";
    coffee.cooldown ??= 12;
  }
  const arcane = config.cards.arcane;
  if (arcane?.category === "equipment" && Array.isArray(arcane.effects)) {
    arcane.effects = arcane.effects.map(e => e.type === "weapon" && e.weapon === "staff"
      ? { type: "splash", value: .55, radius: 1 } : e);
    if (arcane.text === "装备法杖 · 获得溅射") arcane.text = "攻击获得 55% 溅射 · 保留原武器";
  }
  config.combatContentVersion = 1;
  return config;
}
