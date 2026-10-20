import { landingGate } from "./sea-arrivals.js";

// Only unlaunched crews in the current wave are announced.
export function upcomingLandings(game) {
  if (!["ready", "between", "waiting", "battle"].includes(game.phase)) return [];
  const points = game.phase === "battle"
    ? game.spawnQueues.filter(q => !q.boatLaunched && q.spawned < q.types.length).map(q => ({
      ...q, enemies: q.types.slice(q.spawned).map(type => ({ type, count: 1 })),
    }))
    : game.currentWave()?.spawns || [];
  const groups = new Map();
  for (const point of points) {
    const gate = landingGate(game, point);
    if (!gate) continue;
    const key = `${gate.x},${gate.y},${gate.dx},${gate.dy}`;
    if (!groups.has(key)) groups.set(key, { key, gate, enemies: new Map() });
    const group = groups.get(key);
    for (const { type, count } of point.enemies) {
      if (game.config.enemies[type]) group.enemies.set(type, (group.enemies.get(type) || 0) + count);
    }
  }
  return [...groups.values()].map(group => ({ ...group, enemies: [...group.enemies].map(([type, count]) => ({ type, count })) }));
}
