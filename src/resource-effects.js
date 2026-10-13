export const resourceEffectTypes = {
  gold: { label: "获得金币", categories: ["resource"], defaults: { value: 3 } },
  battleStart: { label: "触发目标的一次开战", categories: ["resource"], defaults: {} },
  swapLevels: { label: "与最近英雄交换等级", categories: ["resource"], defaults: { radius: -1 } },
  sacrifice: { label: "销毁英雄并传承等级", categories: ["resource"], defaults: { radius: -1 } },
  drainLevels: { label: "吸取周围英雄等级", categories: ["resource"], defaults: { radius: 2, limit: 3, perHero: 1 } },
};
const make = (name, icon, text, target, effects) => ({ name, icon, useIcon: icon, text, target, category: "resource", visual: "fireball", effects });
export const RESOURCE_CARDS = {
  coin_purse: make("小金库", "coin_purse", "立即获得 3 金币", "any", [{ type: "gold", value: 3 }]),
  war_drum: make("再响战鼓", "war_drum", "触发目标一次开战效果", "hero", [{ type: "battleStart" }]),
  level_swap: make("换位思考", "level_swap", "与最近的英雄交换等级", "hero", [{ type: "swapLevels", radius: -1 }]),
  legacy: make("薪火相传", "legacy", "销毁目标 · 全部等级转赠随机英雄", "hero", [{ type: "sacrifice", radius: -1 }]),
  siphon: make("经验虹吸", "siphon", "吸取 2 格内英雄等级 · 每人 1 级 · 上限 3 级", "hero", [{ type: "drainLevels", radius: 2, limit: 3, perHero: 1 }]),
};
export function migrateResourceContent(c) {
  if (c?.version !== 2 || !c.cards || c.resourceContentVersion !== undefined) return c;
  for (const [key, card] of Object.entries(RESOURCE_CARDS))
    if (!Object.hasOwn(c.cards, key) && Object.keys(c.cards).length < 100) c.cards[key] = structuredClone(card);
  c.resourceContentVersion = 1;
  return c;
}
export function resourceTargets(game, hero, effect) {
  return game.heroes.filter(h => h !== hero && h.hp > 0 && (effect.radius < 0 || Math.abs(h.x - hero.x) + Math.abs(h.y - hero.y) <= effect.radius))
    .sort((a,b) => Math.abs(a.x-hero.x)+Math.abs(a.y-hero.y)-Math.abs(b.x-hero.x)-Math.abs(b.y-hero.y) || a.id-b.id);
}
export function changeLevel(game, hero, level) {
  const previous = hero.level;
  hero.level = Math.max(1, level); game.rebuildHero(hero);
  if (hero.level > previous) game.emit("upgrade", { unit: hero });
}
export function applyResourceEffect(game, hero, effect) {
  if (effect.type === "battleStart") { game.heroTriggers.start([hero]); return; }
  if (!["swapLevels", "sacrifice", "drainLevels"].includes(effect.type)) return;
  const others = resourceTargets(game, hero, effect);
  if (!others.length) return;
  if (effect.type === "swapLevels") {
    const level = hero.level; changeLevel(game, hero, others[0].level); changeLevel(game, others[0], level);
  } else if (effect.type === "sacrifice") {
    const receiver = others[Math.floor(Math.random() * others.length)];
    changeLevel(game, receiver, receiver.level + hero.level);
    hero.destroyed = true; hero.hp = 0; hero.path = [];
    game.heroes = game.heroes.filter(h => h !== hero); game.selected = -1;
    game.attacks = game.attacks.filter(a => a.source !== hero && a.target !== hero);
    game.emit("heroDestroyed", { unit: hero });
  } else {
    let total = 0;
    for (const donor of others) {
      const take = Math.min(donor.level - 1, effect.perHero, effect.limit - total);
      if (take > 0) { changeLevel(game, donor, donor.level - take); total += take; }
      if (total >= effect.limit) break;
    }
    if (total) changeLevel(game, hero, hero.level + total);
  }
}
