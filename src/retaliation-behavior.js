import { gridDistance } from "./grid-distance.js";
import { isHealer } from "./healing-behavior.js";
import { canMoveHero } from "./hero-mechanics.js";

const directions = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
const canRetaliate = (game, hero) => hero.hp > 0 && !hero.destroyed &&
  !isHealer(hero) && canMoveHero(game, hero);

export function rememberAttacker(game, hero, enemy) {
  if (!game.heroes.includes(hero) || !canRetaliate(game, hero) ||
      enemy?.side !== "enemy" || enemy.hp <= 0 || !game.enemies.includes(enemy) ||
      gridDistance(hero, enemy) <= hero.range) return;
  hero.retaliationTargetId = enemy.id;
}

// Find the nearest reachable firing position, including against passengers at sea.
// Automatic movement cannot displace allies or finish on an occupied cell.
function retaliationRoute(game, hero, enemy) {
  const queue = [{ x: hero.x, y: hero.y, path: [] }];
  const seen = new Set([`${hero.x},${hero.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (gridDistance(cell, enemy) <= hero.range && !game.blocked(cell.x, cell.y, hero, true)) return cell.path;
    const neighbors = directions.map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }))
      .sort((a, b) => gridDistance(a, enemy) - gridDistance(b, enemy));
    for (const next of neighbors) {
      const key = `${next.x},${next.y}`;
      if (seen.has(key) || !game.canStep(hero, cell, next, true, false)) continue;
      seen.add(key);
      queue.push({ ...next, path: [...cell.path, next] });
    }
  }
  return null;
}

export function tickRetaliation(game, hero) {
  if (!canRetaliate(game, hero)) { hero.retaliationTargetId = null; return null; }
  const enemy = game.enemies.find(e => e.id === hero.retaliationTargetId && e.hp > 0 && !e.destroyed);
  if (!enemy) { hero.retaliationTargetId = null; return null; }
  // Never store automatic routes in hero.path: it belongs to the player's orders.
  // Hits received while moving are deferred until the entire manual route ends.
  if (hero.path.length) return null;
  if (gridDistance(hero, enemy) > hero.range && hero.moveCooldown <= 0) {
    const route = retaliationRoute(game, hero, enemy);
    if (route?.length) game.moveStep(hero, route[0], { final: true, yieldAllies: false });
    else hero.moveCooldown = .15; // Retry when a unit moves or a boat approaches.
  }
  return gridDistance(hero, enemy) <= hero.range ? enemy : null;
}
