import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { heroRarities, heroRoles, applyHeroStatPreset } from "../src/hero-grades.js";
import { Game } from "../src/game.js";

const legacy = structuredClone(DEFAULT_CONFIG);
delete legacy.initial.heroStatPresets;
for (const card of Object.values(legacy.cards)) {
  delete card.rarity; delete card.role; delete card.statSource;
}
legacy.cards.hero_blue.unit.maxHp = 777;
const migrated = assertConfig(legacy);
assert.equal(migrated.cards.hero_blue.statSource, "custom");
assert.equal(migrated.cards.hero_blue.unit.maxHp, 777);
assert.deepEqual(legacy.cards.hero_blue.rarity, undefined, "loading does not mutate the input");
assert.deepEqual(assertConfig(migrated), migrated, "migration is idempotent");

for (const rarity of Object.keys(heroRarities)) for (const role of Object.keys(heroRoles)) {
  const config = structuredClone(DEFAULT_CONFIG), card = config.cards.hero_blue;
  const original = structuredClone(card);
  Object.assign(card, { rarity, role, statSource: "preset" });
  applyHeroStatPreset(card, config.initial.heroStatPresets);
  const preset = config.initial.heroStatPresets[rarity][role];
  assert.equal(card.unit.maxHp, preset.maxHp);
  assert.equal(card.unit.rate, preset.rate);
  assert.deepEqual(card.unit.levelGrowth, preset.levelGrowth);
  assert.notEqual(card.unit.levelGrowth, preset.levelGrowth, "growth is not aliased");
  assert.deepEqual(card.triggerRules, original.triggerRules);
  assert.equal(card.unit.attackModule, original.unit.attackModule);
  assert.deepEqual(validateConfig(config), []);
  const game = new Game(() => {}, assertConfig(config));
  assert.ok(game.playCard("hero_blue", 7, 3));
  assert.ok(game.playCard("training", 7, 3));
  assert.equal(game.heroes[0].maxHp, preset.maxHp + preset.levelGrowth.maxHp);
  assert.equal(game.heroes[0].atk, preset.atk + preset.levelGrowth.atk);
  assert.equal(game.heroes[0].speed, preset.speed);
  const next = structuredClone(config);
  next.initial.heroStatPresets[rarity][role].maxHp += 100;
  game.applyConfig(assertConfig(next));
  assert.equal(game.heroes[0].maxHp, preset.maxHp + preset.levelGrowth.maxHp + 100);
  assert.equal(next.cards.hero_green.unit.maxHp, config.cards.hero_green.unit.maxHp);
}
for (const [path, value] of [
  ["cards.hero_blue.rarity", "legendary"], ["cards.hero_blue.role", "mage"],
  ["cards.hero_blue.statSource", "unknown"], ["initial.heroStatPresets", null],
  ["initial.heroStatPresets.epic.support", null],
  ["initial.heroStatPresets.rare.tank.maxHp", 0],
  ["initial.heroStatPresets.rare.tank.range", 1.5],
  ["initial.heroStatPresets.rare.tank.rate", 21],
  ["initial.heroStatPresets.rare.tank.levelGrowth.atk", -1],
]) {
  const config = structuredClone(DEFAULT_CONFIG), parts = path.split("."), key = parts.pop();
  parts.reduce((v, k) => v[k], config)[key] = value;
  assert.throws(() => assertConfig(config), undefined, path);
}
console.log("PASS hero grades: 15 presets, legacy preservation, validation, independent growth, deployment, leveling and live updates");
