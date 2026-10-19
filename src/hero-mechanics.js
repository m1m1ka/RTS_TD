export function isDormant(game, hero) {
  return !!hero?.mechanics?.dormant && hero.awakenedDayId !== game.currentDay().id;
}
export function canMoveHero(game, unit) {
  return !unit.mechanics?.immobile && !isDormant(game, unit);
}
// Evaluate at the death boundary, before sacrifice effects run. The dying
// carrier still covers its own last death; already-dead other carriers do not.
export function deathCountsAsSacrifice(game, dyingHero) {
  return game.heroes.some(h => h.mechanics?.deathsAsSacrifice &&
    (h === dyingHero || (h.hp > 0 && !h.destroyed)));
}
export function syncHeroMechanics(game) {
  if (!["battle", "waiting"].includes(game.phase)) return;
  const living = game.heroes.filter(h => h.hp > 0 && !h.destroyed);
  if (living.length !== 1 || !isDormant(game, living[0])) return;
  const hero = living[0];
  hero.awakenedDayId = game.currentDay().id;
  hero.path = [];
  hero.cooldown = hero.moveCooldown = 0;
  game.emit("heroAwakened", { unit: hero });
}
export function knockback(game, target, origin, distance) {
  if (!distance || target.hp <= 0 || target.side !== "enemy" || target.boatId) return;
  const dx = Math.sign(target.x - origin.x), dy = Math.sign(target.y - origin.y);
  if (!dx && !dy) return;
  const from = {x:target.x,y:target.y};
  let moved = 0;
  for (; moved < distance; moved++) {
    const next = {x:target.x+dx,y:target.y+dy};
    if (!game.canStep(target,target,next,true,false)) break;
    Object.assign(target,next);
  }
  if (moved) {
    target.path = [];
    target.moveCooldown = Math.max(target.moveCooldown || 0, .2);
    game.emit("knockback", {unit:target,from,to:{x:target.x,y:target.y},distance:moved});
  }
}

export function addVictoryBonus(settlement, hero, amount) {
  const bonuses = settlement.bonuses ??= [];
  const existing = bonuses.find(b => b.id === hero.id);
  if (existing) existing.amount += amount;
  else bonuses.push({id:hero.id,x:hero.x,y:hero.y,amount});
}
export function finishVictoryBonuses(settlement) {
  if (!settlement.bonuses?.length) return;
  const start = Math.max(...settlement.coins.map(c=>c.at)) + .5;
  for (const bonus of settlement.bonuses) {
    const count = Math.min(5, bonus.amount);
    for (let i=0;i<count;i++) settlement.coins.push({
      x:bonus.x,y:bonus.y,index:i,at:start+i*.22,
      amount:Math.floor(bonus.amount/count)+(i<bonus.amount%count?1:0),
    });
    settlement.total += bonus.amount;
  }
  settlement.coins.sort((a,b)=>a.at-b.at);
  settlement.duration = Math.max(settlement.duration, settlement.coins.at(-1).at + 1.2);
}
