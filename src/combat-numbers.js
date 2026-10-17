export const combatNumberStyles = {
  damage: { color: "#ffffff", fontSize: 32, duration: .85 },
  critical: { color: "#ff4141", fontSize: 46, duration: 1.05 },
  healing: { color: "#57ef83", fontSize: 32, duration: .9 },
};

export function combatNumber(event) {
  const healing = event.type === "heal" || event.type === "lifeSteal";
  if (!healing && event.type !== "hit") return null;
  const amount = healing ? event.amount : event.damage;
  if (!Number.isFinite(amount) || amount < 0 || (healing && amount === 0)) return null;
  const kind = healing ? "healing" : event.critical ? "critical" : "damage";
  return { kind, text: `${healing ? "+" : "−"}${Math.ceil(amount)}`, ...combatNumberStyles[kind] };
}
