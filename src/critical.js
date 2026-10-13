// Stored in percentage points: 25 means a 25% chance. Damage is always 200%.
export function criticalChance(unit) {
  return Math.max(0, Math.min(100, Number(unit.critChance) || 0));
}
export function migrateCritical(c) {
  if (c?.version !== 2) return c;
  const units = [...Object.values(c.cards || {}).map(card => card?.unit), ...Object.values(c.enemies || {})];
  for (const unit of units)
    if (unit && typeof unit === "object" && unit.critChance === undefined) unit.critChance = 0;
  return c;
}
