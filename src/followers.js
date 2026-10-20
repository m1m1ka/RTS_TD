import { gridDistance } from "./grid-distance.js";
// Followers are combat units, never heroes: no card ownership or trigger rules.
export const FOLLOWER_SCALE = 0.65;
export const MAX_FOLLOWERS = 40;
export const FOLLOW_DELAY = 0.4;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const adjacent = (u) => [[0, -1], [1, 0], [0, 1], [-1, 0], [-1,-1], [1,-1], [-1,1], [1,1]].map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy }));
const gateCells = (game) => new Set(game.currentDay().waves.flatMap(w => w.spawns).map(p => `${p.x},${p.y}`));
const position = (u) => ({ x: u.x, y: u.y });
const same = (a, b) => a?.x === b?.x && a?.y === b?.y;
const neighborhood = (center) => [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ({ x: center.x + dx, y: center.y + dy })));
export const followerOwner = (game, unit) => game.heroes.find(h => h.id === unit.ownerId);
export const withinFollowerArea = (cell, owner) => !!owner && Math.abs(cell.x - owner.x) <= 1 && Math.abs(cell.y - owner.y) <= 1;
export function followerMoveArea(game, unit) {
  const owner = followerOwner(game, unit), gates = gateCells(game);
  return new Set(owner ? neighborhood(owner).map(p => `${p.x},${p.y}`).filter(key => !gates.has(key)) : []);
}
export function setFollowerDestination(game, unit, target) {
  const owner = followerOwner(game, unit);
  unit.manualTarget = position(target);
  unit.followOffset = { x: target.x - owner.x, y: target.y - owner.y };
  unit.followAnchor = unit.observedOwner = position(owner);
  unit.followTrail = [];
}

export function summonFollowers(game, owner, effect) {
  if (!game.heroes.includes(owner) || owner.hp <= 0) return [];
  const gates = gateCells(game), spawned = [];
  const cells = adjacent(owner).filter(p => !game.blocked(p.x, p.y, null, true) && !gates.has(`${p.x},${p.y}`));
  const capacity = Math.min(MAX_FOLLOWERS - game.followers.filter(u => u.hp > 0).length,
    8 - game.followers.filter(u => u.hp > 0 && u.ownerId === owner.id).length);
  for (const cell of cells.slice(0, Math.min(effect.count, capacity))) {
    const maxHp = Math.max(1, Math.ceil(owner.maxHp * effect.hpPercent / 100));
    const unit = {
      id: ++game.id, ownerId: owner.id, isFollower: true, side: "hero",
      name: `${owner.name}·随从`, type: owner.type, useIcon: owner.useIcon,
      attackModule: owner.attackModule === "heal" ? "staff" : owner.attackModule, weapon: owner.weapon, level: 0, equipment: [], ...cell,
      maxHp, hp: maxHp, atk: Math.max(0, Math.ceil(owner.atk * effect.atkPercent / 100)),
      rate: owner.rate, range: owner.range, speed: owner.speed, critChance: owner.critChance,
      cooldown: 0, moveCooldown: 0,
      path: [], manualTarget: null, followOffset: { x: cell.x - owner.x, y: cell.y - owner.y },
      followAnchor: position(owner), observedOwner: position(owner), followTrail: [],
      followDelay: FOLLOW_DELAY + ((game.id - 1) % 4) * 0.06,
    };
    game.followers.push(unit);
    spawned.push(unit);
    game.emit("followerSpawn", { unit, source: owner });
  }
  if (spawned.length < effect.count) game.emit("toast", { text: "随从空位不足或已达上限" });
  return spawned;
}

export function removeFollowers(game, ownerId) {
  const removed = game.followers.filter(u => ownerId === undefined || u.ownerId === ownerId);
  const ids = new Set(removed.map(u => u.id));
  game.followers = game.followers.filter(u => !ids.has(u.id));
  if (ids.has(game.selectedFollowerId)) game.selectedFollowerId = null;
  game.attacks = game.attacks.filter(a => !ids.has(a.source.id) && !ids.has(a.target.id));
  for (const unit of removed) game.emit("followerRemoved", { unit });
}

export function moveFollowers(game, dt) {
  const gates = gateCells(game);
  for (const unit of game.followers) {
    unit.moveCooldown -= dt;
    if (unit.hp <= 0) continue;
    const owner = followerOwner(game, unit);
    if (!owner) continue;
    // Observe each owner step, even during cooldown. Delayed samples keep a moving
    // owner from resetting a timer forever and make followers trail individually.
    if (!same(unit.observedOwner, owner)) {
      unit.observedOwner = position(owner);
      unit.followTrail.push({ ...position(owner), at: game.time + unit.followDelay });
      if (unit.followTrail.length > 32) unit.followTrail.shift();
    }
    while (unit.followTrail[0]?.at <= game.time) unit.followAnchor = position(unit.followTrail.shift());
    if (unit.manualTarget && (!withinFollowerArea(unit, owner) || !withinFollowerArea(unit.manualTarget, owner))) {
      unit.manualTarget = null;
      unit.path = [];
    }
    if (unit.moveCooldown > 0) continue;
    if (unit.manualTarget) {
      // Revalidate the whole route against the owner's current nine cells.
      const allowed = followerMoveArea(game, unit);
      unit.path = game.path(unit, unit.manualTarget, { units: true, avoid: gates, allowed }) || [];
      const next = unit.path[0];
      if (next) {
        if (game.moveStep(unit, next, { final: unit.path.length === 1 })) unit.path.shift();
        else { unit.moveCooldown = .15; continue; }
      }
      if (!unit.path.length) {
        setFollowerDestination(game, unit, unit);
        unit.manualTarget = null;
      }
      continue;
    }
    // Staying to fight is allowed only while still inside the owner's vicinity.
    if (withinFollowerArea(unit, owner) && game.phase === "battle" && game.enemies.some(e => e.hp > 0 && gridDistance(unit, e) <= unit.range)) continue;
    const anchor = unit.followAnchor, ideal = { x: anchor.x + unit.followOffset.x, y: anchor.y + unit.followOffset.y };
    const candidates = neighborhood(anchor).filter(p => !game.blocked(p.x, p.y, unit, true) && !gates.has(`${p.x},${p.y}`));
    if (same(unit, ideal) || (withinFollowerArea(unit, anchor) && !candidates.some(p => same(p, ideal)))) continue;
    const routes = candidates.map(p => ({ goal: p, path: game.path(unit, p, { units: true, avoid: gates }) })).filter(r => r.path);
    routes.sort((a, b) => distance(a.goal, ideal) - distance(b.goal, ideal) || a.path.length - b.path.length);
    const next = routes[0]?.path[0];
    if (!next || !game.moveStep(unit, next, { final: routes[0].path.length === 1, yieldAllies: false })) unit.moveCooldown = .3;
  }
}
