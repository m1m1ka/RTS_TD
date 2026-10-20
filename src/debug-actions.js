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
