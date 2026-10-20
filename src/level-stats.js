import { isHealer, healingDefaults } from "./healing-behavior.js";

// The existing base attributes are the values at level 1.
export function levelStats(spec, level = 1, fallbackGrowth = {}) {
  const steps = Math.max(0, level - 1);
  const stats = Object.fromEntries(["maxHp", "atk"].map((key) => [
    key, spec[key] + (spec.levelGrowth?.[key] ?? fallbackGrowth[key] ?? 0) * steps,
  ]));
  if (isHealer(spec)) {
    const healing = structuredClone(spec.healing || healingDefaults);
    healing.value += (spec.levelGrowth?.atk ?? fallbackGrowth.atk ?? 0) * steps;
    if (healing.valueMode === "percent") healing.value = Math.min(100, healing.value);
    stats.atk = spec.atk;
    stats.healing = healing;
  }
  return stats;
}

export function migrateLevelGrowth(config) {
  if (config?.version !== 2) return config;
  if (config.initial?.levelGrowth) delete config.initial.levelGrowth.rate;
  for (const card of Object.values(config.cards || {})) {
    if (!card?.unit || card.unit.levelGrowth !== undefined) continue;
    card.unit.levelGrowth = {
      maxHp: card.category === "hero" ? (config.initial?.levelGrowth?.maxHp ?? 0) : 0,
      atk: card.category === "hero" ? (config.initial?.levelGrowth?.atk ?? 0) : 0,
    };
  }
  for (const enemy of Object.values(config.enemies || {}))
    if (enemy && enemy.levelGrowth === undefined) enemy.levelGrowth = { maxHp: 0, atk: 0 };
  if (Array.isArray(config.days)) for (const day of config.days)
    if (Array.isArray(day?.waves)) for (const wave of day.waves)
      if (Array.isArray(wave?.spawns)) for (const point of wave.spawns)
        if (Array.isArray(point?.enemies)) for (const row of point.enemies)
          if (row && typeof row === "object" && row.level === undefined) row.level = 1;
  return config;
}
