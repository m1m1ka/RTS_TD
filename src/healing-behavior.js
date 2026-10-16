import { gridDistance } from "./grid-distance.js";

export const combatBehaviors = { attack: "自动攻击", heal: "自动治疗" };
export const healingTargets = { allies: "英雄、随从与炮台", heroes: "英雄与随从", towers: "仅炮台" };
export const healingDefaults = { targets: "allies", valueMode: "fixed", value: 30 };
export const isHealer = unit => unit?.combatBehavior === "heal";

export function injuredAllies(game, healer) {
  const kind = healer.healing?.targets || "allies";
  return [...(kind === "towers" ? [] : [...game.heroes, ...game.followers]), ...(kind === "heroes" ? [] : game.towers)]
    .filter(u => u !== healer && u.hp > 0 && u.hp < u.maxHp && !u.destroyed)
    .sort((a, b) => gridDistance(healer, a) - gridDistance(healer, b) || a.id - b.id);
}

// Search for a free treatment position, not the patient's occupied cell.
// Use the existing eight-direction movement, friendly transit and corner rules.
export function healingRoute(game, healer, patient = null) {
  const queue = [{ x: healer.x, y: healer.y, path: [] }], seen = new Set([`${healer.x},${healer.y}`]);
  const directions = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if ((!patient || gridDistance(cell, patient) <= healer.range) && !game.blocked(cell.x, cell.y, healer, true)) return cell.path;
    const neighbors = directions.map(([dx,dy]) => ({x: cell.x + dx, y: cell.y + dy}))
      .sort((a,b) => gridDistance(a, patient || healer) - gridDistance(b, patient || healer));
    for (const next of neighbors) {
      const key = `${next.x},${next.y}`;
      if (seen.has(key) || !game.canStep(healer, cell, next, true, true)) continue;
      seen.add(key); queue.push({ ...next, path: [...cell.path, next] });
    }
  }
  return null;
}

export function tickHealer(game, healer) {
  healer.healingTargetId = null;
  // A manual route is never overwritten by automatic treatment or chasing.
  if (healer.path.length || healer.hp <= 0 || healer.destroyed) return;
  for (const target of injuredAllies(game, healer)) {
    let inRange = gridDistance(healer, target) <= healer.range && !game.blocked(healer.x, healer.y, healer, true);
    if (!inRange) {
      if (healer.mechanics?.immobile) continue;
      if (healer.moveCooldown > 0) return;
      const path = healingRoute(game, healer, target);
      if (!path?.length) continue; // An unreachable nearer ally must not block other patients.
      if (!game.moveStep(healer, path[0], { final: path.length === 1, yieldAllies: false })) continue;
      inRange = gridDistance(healer, target) <= healer.range && !game.blocked(healer.x, healer.y, healer, true);
    }
    healer.healingTargetId = target.id;
    if (inRange && healer.cooldown <= 0) {
      const spec = healer.healing || healingDefaults;
      const amount = Math.min(target.maxHp - target.hp, spec.valueMode === "percent" ? target.maxHp * spec.value / 100 : spec.value);
      if (amount > 0) {
        target.hp += amount;
        healer.cooldown = 1 / healer.rate;
        game.emit("healingCast", { source: healer, target, amount });
        game.emit("heal", { source: healer, unit: target, amount, automatic: true });
      }
    }
    return;
  }
  // If a patient died or was healed by someone else mid-transit, leave the
  // shared friendly cell before idling. Never displace an ally automatically.
  if (healer.moveCooldown <= 0 && game.blocked(healer.x, healer.y, healer, true)) {
    const path = healingRoute(game, healer);
    if (path?.length) game.moveStep(healer, path[0], { final: path.length === 1, yieldAllies: false });
  }
}
