import { presetById } from "./hero-presets.js";
import { healingDefaults } from "./healing-behavior.js";

export const attackModules = {
  slash: { label: "近战 · 挥砍", kind: "slash", weapon: "" },
  claw: { label: "近战 · 爪击", kind: "claw", weapon: "" },
  heal: { label: "治疗 · 恢复友军", kind: "healing", weapon: "staff", heroOnly: true },
  bow: { label: "远程 · 弓箭", kind: "arrow", weapon: "bow" },
  crossbow: { label: "远程 · 弩箭", kind: "arrow", weapon: "crossbow" },
  musket: { label: "远程 · 火枪", kind: "bullet", weapon: "musket" },
  staff: { label: "魔法 · 法球", kind: "orb", weapon: "staff" },
  coffeeCannon: { label: "炮击 · 咖啡炮", kind: "coffee", weapon: "coffeeCannon" },
};
export const attackModuleOptions = Object.fromEntries(Object.entries(attackModules).map(([id, spec]) => [id, spec.label]));
export const damagingModuleOptions = Object.fromEntries(Object.entries(attackModules).filter(([, spec]) => !spec.heroOnly).map(([id, spec]) => [id, spec.label]));

export function selectAttackModule(unit, id) {
  const module = attackModules[id];
  if (!module) return;
  unit.attackModule = id;
  unit.weapon = module.weapon;
  if (id === "heal") {
    unit.combatBehavior = "heal";
    unit.healing ??= structuredClone(healingDefaults);
    unit.range = Math.max(1, unit.range);
  } else if (unit.combatBehavior === "heal") unit.combatBehavior = "attack";
}

// Only old configuration needs to infer an action from appearance. New selections
// are explicit, so changing an icon or adding a portrait cannot change combat.
export function attackModuleId(unit) {
  if (Object.hasOwn(attackModules, unit?.attackModule)) return unit.attackModule;
  if (Object.hasOwn(attackModules, unit?.weapon)) return unit.weapon;
  return presetById[unit?.type]?.melee || (unit?.type === "blue" ? "slash" : "claw");
}
export function attackProfile(unit) {
  const attackModule = attackModuleId(unit);
  return { attackModule, weapon: attackModules[attackModule].weapon };
}
export function migrateAttackModules(config) {
  if (config?.version !== 2) return config;
  const units = [...Object.values(config.cards || {}).map(c => c?.unit), ...Object.values(config.enemies || {})];
  for (const unit of units) {
    if (!unit || typeof unit !== "object" || Array.isArray(unit)) continue;
    if (unit.attackModule === "heal" && unit.combatBehavior !== "heal") {
      unit.combatBehavior = "heal";
      unit.healing ??= structuredClone(healingDefaults);
    }
    if (unit.combatBehavior === "heal") unit.attackModule = "heal";
    else if (unit.attackModule === undefined) unit.attackModule = attackModuleId(unit);
  }
  return config;
}
