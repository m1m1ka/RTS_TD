export const HERO_CONTENT_VERSION = 1;
export const CATGIRL_CARD = {
  name: "米娅", category: "hero", target: "ground",
  text: "灵巧猫女 · 近战快攻",
  icon: "catgirl", useIcon: "catgirl", visual: "fireball", effects: [],
  unit: {
    name: "米娅", type: "catgirl", weapon: "",
    maxHp: 230, atk: 24, range: 1, rate: 1.8, speed: 6,
  },
  triggerRules: [],
};

// Install new built-in content once; subsequent user deletions stay deleted.
export function migrateHeroContent(c) {
  if (c?.version !== 2 || c.heroContentVersion !== undefined) return c;
  if (!c.cards || Array.isArray(c.cards) || typeof c.cards !== "object" ||
      !c.initial?.cards || Array.isArray(c.initial.cards) || typeof c.initial.cards !== "object") return c;
  if (!Object.hasOwn(c.cards, "hero_catgirl") && Object.keys(c.cards).length < 100) {
    c.cards.hero_catgirl = structuredClone(CATGIRL_CARD);
    if (!Object.hasOwn(c.initial.cards, "hero_catgirl")) c.initial.cards.hero_catgirl = 1;
  }
  c.heroContentVersion = HERO_CONTENT_VERSION;
  return c;
}
