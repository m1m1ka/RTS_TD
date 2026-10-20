export function debugGenerateCard(game, key, count) {
  if (!Object.hasOwn(game.config.cards, key) || !Number.isInteger(count) || count < 1 || count > 99) return false;
  if ((game.cards[key] || 0) + count > 999) return false;
  game.generateCards({ pool: "selected", cards: [key], count });
  game.syncSkillCards();
  return true;
}
export function debugLevelHero(game, id, levels) {
  const hero = game.heroes.find(h => h.id === id && !h.destroyed);
  if (!hero || !Number.isInteger(levels) || levels < 1 || levels > 999 || hero.level + levels > 9999) return false;
  hero.level += levels;
  game.rebuildHero(hero);
  game.heroTriggers.syncSourceEffects();
  game.emit("upgrade", { unit: hero, levels });
  return true;
}

export function debugJumpToDay(game, id) {
  if (!game.config.days.some(day => day.id === id)) return false;
  game.rewardOptions = [];
  game.initialHandOptions = [];
  game.initialDraftVersion++;
  game.completedDays = [];
  game.routeHistory = [];
  game.baseHp = game.baseMaxHp;
  game.heroTriggers.timers.clear();
  for (const hero of [...game.heroes, ...game.heroReserve, ...game.towers]) {
    delete hero.preparedDayId;
    delete hero.reviveUsage;
    hero.cardPlayCounts = {};
  }
  return game.enterDay(id);
}
