import { reachableTerrain } from "./terrain.js";

export const SEA_DEFAULTS = { boatSpeed: 2, landingKnockback: 2 };
export const SAIL_DISTANCE = 6;
export const CREW_SPRITE_SIZE = .84;
export const CREW_STACK_STEP = .48;
export const BOAT_SLOTS = 4;
export function migrateSeaArrivals(c) {
  if (c?.version === 2 && c.initial) {
    c.initial.boatSpeed ??= SEA_DEFAULTS.boatSpeed;
    c.initial.landingKnockback ??= SEA_DEFAULTS.landingKnockback;
  }
  return c;
}

// Interior legacy spawn points project to the closest reachable shore.
export function landingGate(game, point) {
  const solid = new Set([...game.obstacles, ...game.mines.filter(m => m.hp > 0).map(m => `${m.x},${m.y}`), ...game.towers.filter(t => t.hp > 0).map(t => `${t.x},${t.y}`)]);
  const reachable = reachableTerrain(solid), cells = [];
  for (let x = 0; x < 15; x++) cells.push({ x, y: 0, dx: 0, dy: 1 }, { x, y: 10, dx: 0, dy: -1 });
  for (let y = 0; y < 11; y++) cells.push({ x: 0, y, dx: 1, dy: 0 }, { x: 14, y, dx: -1, dy: 0 });
  return cells.filter(p => reachable.has(`${p.x},${p.y}`))
    .sort((a,b) => Math.abs(a.x-point.x)+Math.abs(a.y-point.y)-Math.abs(b.x-point.x)-Math.abs(b.y-point.y))[0];
}

export function boatPosition(boat) {
  return { x: boat.gate.x - boat.dx * (1 + boat.remaining), y: boat.gate.y - boat.dy * (1 + boat.remaining) };
}
export function passengerPosition(boat, seat = 0) {
  const anchor = boatPosition(boat), slot = seat % BOAT_SLOTS;
  return { x: anchor.x - boat.dx * slot, y: anchor.y - boat.dy * slot };
}
export function passengerVisualPosition(boat, seat) {
  const anchor = passengerPosition(boat, seat);
  return { x: anchor.x, y: anchor.y - .2 - Math.floor(seat / BOAT_SLOTS) * CREW_STACK_STEP };
}

export function launchBoat(game, queue) {
  if (queue.boatLaunched || queue.spawned >= queue.types.length) return;
  const gate = landingGate(game, queue);
  if (!gate) return; // A live terrain edit may temporarily close the shore.
  const count = queue.types.length - queue.spawned;
  const boat = { id: ++game.id, gate: { x: gate.x, y: gate.y }, dx: gate.dx, dy: gate.dy,
    count, layers: Math.ceil(count / BOAT_SLOTS), remaining: SAIL_DISTANCE, members: [], interval: queue.interval, unloadWait: 0 };
  queue.boatLaunched = true;
  game.boats.push(boat);
  for (let seat = 0; seat < count; seat++) {
    const p = passengerPosition(boat, seat);
    const visual = passengerVisualPosition(boat, seat);
    game.spawn(queue, { x: Math.round(p.x), y: Math.round(p.y), seaX: visual.x, seaY: visual.y, boatId: boat.id, boatSeat: seat });
    boat.members.push(game.enemies.at(-1).id);
  }
  game.emit("boatLaunched", { boat });
}

export function landingCells(boat) {
  return [0, -1, 1].map(offset => ({
    x: boat.gate.x + (boat.dy ? offset : 0),
    y: boat.gate.y + (boat.dx ? offset : 0),
  })).filter(p => p.x >= 0 && p.x < 15 && p.y >= 0 && p.y < 11);
}

// Plan before moving anyone, so a rejected landing never pushes a bystander.
function shorePushPlan(game, heroes, boat) {
  const distance = game.config.initial.landingKnockback ?? SEA_DEFAULTS.landingKnockback;
  if (!distance) return null;
  const allies = [...game.heroes, ...game.followers].filter(u => u.hp > 0);
  const plan = new Map(), reserved = new Set(heroes.map(h => `${h.x},${h.y}`));
  const key = p => `${p.x},${p.y}`;
  const position = unit => plan.get(unit)?.to || unit;
  const occupants = p => allies.filter(u => key(position(u)) === key(p));
  const enemyAt = p => game.enemies.some(e => e.hp > 0 && !e.boatId && key(e) === key(p));
  // Flying past units is allowed; terrain, the core, mines and towers stay solid.
  const inland = unit => {
    const cells = [];
    let from = { x: unit.x, y: unit.y };
    for (let i = 0; i < distance; i++) {
      const to = { x: from.x + boat.dx, y: from.y + boat.dy };
      if (!game.canStep(unit, from, to, false, false)) break;
      cells.push(to); from = to;
    }
    return cells.reverse();
  };
  const record = (hero, to) => {
    const from = { x: hero.x, y: hero.y };
    plan.set(hero, { hero, from, to, moved: Math.abs(to.x - from.x) + Math.abs(to.y - from.y) });
    reserved.add(key(to));
  };
  // Find a vacancy, then move the whole chain into it. Breadth-first search
  // handles packed formations without recursive cycles or partial mutations.
  const pushAside = hero => {
    const queue = [{ hero, parent: null }], visited = new Set([hero]);
    for (let index = 0; index < queue.length; index++) {
      const node = queue[index], unit = node.hero;
      const adjacent = [[boat.dx, boat.dy], [-boat.dy, boat.dx], [boat.dy, -boat.dx], [-boat.dx, -boat.dy]]
        .map(([dx, dy]) => ({ x: unit.x + dx, y: unit.y + dy }))
        .filter(to => game.canStep(unit, unit, to, false, false));
      for (const to of [...inland(unit), ...adjacent]) {
        if (reserved.has(key(to)) || enemyAt(to)) continue;
        const blocking = occupants(to).filter(u => u !== unit);
        if (!blocking.length) {
          record(unit, to);
          for (let child = node; child.parent; child = child.parent)
            record(child.parent.hero, { x: child.hero.x, y: child.hero.y });
          return true;
        }
        if (blocking.length === 1 && !visited.has(blocking[0]) && !plan.has(blocking[0])) {
          visited.add(blocking[0]); queue.push({ hero: blocking[0], parent: node });
        }
      }
    }
    return false;
  };
  for (const hero of heroes) {
    let placed = false;
    for (const to of inland(hero)) {
      if (reserved.has(key(to)) || enemyAt(to)) continue;
      const before = new Map(plan), oldReserved = new Set(reserved);
      reserved.add(key(to));
      if (occupants(to).filter(u => u !== hero).every(pushAside)) {
        record(hero, to); placed = true; break;
      }
      plan.clear(); for (const [unit, move] of before) plan.set(unit, move);
      reserved.clear(); for (const cell of oldReserved) reserved.add(cell);
    }
    if (!placed) return null;
  }
  return [...plan.values()];
}

function chooseLanding(game, boat, enemy) {
  const solid = new Set([...game.obstacles, ...game.mines.filter(m => m.hp > 0).map(m => `${m.x},${m.y}`), ...game.towers.filter(t => t.hp > 0).map(t => `${t.x},${t.y}`)]);
  const reachable = reachableTerrain(solid);
  const cells = landingCells(boat).filter(p => reachable.has(`${p.x},${p.y}`) && !game.blocked(p.x, p.y, enemy));
  const front = cells.find(p => p.x === boat.gate.x && p.y === boat.gate.y);
  const free = cells.find(p => !game.blocked(p.x, p.y, enemy, true));
  for (const cell of cells) {
    // Resolve the bow cell, including its knockback, before diverting along shore.
    if (cell !== front && free) return free;
    if (!game.blocked(cell.x, cell.y, enemy, true)) return cell;
    const atCell = u => u.hp > 0 && u.x === cell.x && u.y === cell.y;
    if (game.enemies.some(atCell)) continue;
    const heroes = [...game.heroes, ...game.followers].filter(atCell);
    const plan = shorePushPlan(game, heroes, boat);
    if (!plan?.length) continue;
    for (const { hero, from, to, moved } of plan) {
      Object.assign(hero, to);
      hero.path = [];
      hero.moveCooldown = Math.max(hero.moveCooldown || 0, .25);
      game.emit("knockback", { unit: hero, from, to, distance: moved });
    }
    return cell;
  }
  return null;
}

export function tickBoats(game, dt) {
  for (const boat of game.boats) {
    const aboard = game.enemies.filter(e => e.hp > 0 && e.boatId === boat.id);
    if (!aboard.length) continue;
    boat.aboardCount = aboard.length;
    boat.layers = Math.ceil(aboard.length / BOAT_SLOTS);
    boat.remaining = Math.max(0, boat.remaining - dt * (game.config.initial.boatSpeed ?? SEA_DEFAULTS.boatSpeed));
    if (boat.remaining < 1e-9) boat.remaining = 0;
    for (const [seat, e] of aboard.entries()) {
      e.boatSeat = seat; // Close gaps in the human tower after casualties or landing.
      const p = passengerPosition(boat, e.boatSeat);
      const visual = passengerVisualPosition(boat, e.boatSeat);
      e.seaX = visual.x; e.seaY = visual.y;
      e.x = Math.round(p.x); e.y = Math.round(p.y);
    }
    if (boat.remaining > 0) continue;
    boat.unloadWait -= dt;
    if (boat.unloadWait > 1e-9) continue;
    const enemy = aboard[0];
    const landing = chooseLanding(game, boat, enemy);
    if (!landing) continue;
    const from = { x: enemy.seaX, y: enemy.seaY };
    Object.assign(enemy, landing);
    delete enemy.boatId; delete enemy.boatSeat; delete enemy.seaX; delete enemy.seaY;
    enemy.moveCooldown = 1 / enemy.speed;
    boat.unloadWait = boat.interval;
    game.emit("land", { unit: enemy, from });
  }
  game.boats = game.boats.filter(boat => game.enemies.some(e => e.hp > 0 && e.boatId === boat.id));
}
