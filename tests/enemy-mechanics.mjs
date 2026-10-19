import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { selectAttackModule } from "../src/attack-modules.js";
const fixture = (armor = { mode: "percent", value: 50 }, module = "bow") => {
  const c = structuredClone(DEFAULT_CONFIG);
  for (const card of Object.values(c.cards)) if (card.category === "hero") card.triggerRules = [];
  c.days[0].obstacles = []; c.days[0].mines = [];
  selectAttackModule(c.cards.hero_blue.unit, module);
  c.enemies.grunt.mechanics = { rangedReduction: armor };
  c.enemies.grunt.maxHp = 10000;
  return assertConfig(c);
};
function setup(armor, module) {
  const config = fixture(armor, module), events = [], g = new Game(e => events.push(e), config);
  g.playCard("hero_blue", 5, 4);
  const hero = g.heroes[0]; Object.assign(hero, { atk: 100, critChance: 0, splash: 0 });
  const enemy = { ...structuredClone(config.enemies.grunt), id: ++g.id, enemyId: "grunt", x: 6, y: 4, hp: 10000, maxHp: 10000, side: "enemy" };
  g.enemies.push(enemy);
  return { g, hero, enemy, events, config };
}
for (const module of ["bow", "crossbow", "musket", "staff", "slash", "claw", "coffeeCannon"]) {
  const { g, hero, enemy, events } = setup(undefined, module);
  g.attack(hero, enemy); g.resolveAttacks(2);
  const ranged = ["bow", "crossbow", "musket", "staff"].includes(module);
  assert.equal(enemy.hp, 10000 - (ranged ? 50 : 100), module);
  assert.equal(events.filter(e => e.type === "blocked").length, ranged ? 1 : 0);
}
for (const [armor, expected] of [
  [{ mode: "percent", value: 25 }, 60], [{ mode: "fixed", value: 30 }, 50],
  [{ mode: "percent", value: 100 }, 0], [{ mode: "fixed", value: 9999 }, 0],
  [{ mode: "fixed", value: 0 }, 80], [{ mode: "percent", value: 0 }, 80],
]) {
  const { g, hero, enemy, events } = setup(armor);
  enemy.damageReduction = .2; hero.hp = 10; hero.lifeSteal = .5;
  g.attack(hero, enemy); g.resolveAttacks(2);
  assert.equal(enemy.hp, 10000 - expected, "general reduction precedes extra resistance");
  assert.equal(hero.hp, 10 + Math.ceil(expected * .5), "life steal uses actual damage");
  assert.equal(events.filter(e => e.type === "blocked").length, expected < 80 ? 1 : 0);
  assert.equal(events.filter(e => e.type === "hit").length, expected ? 1 : 0);
  assert.equal(g.kills, 0);
}
{
  const { g, hero, enemy } = setup();
  hero.critChance = 100; g.attack(hero, enemy); g.resolveAttacks(2);
  assert.equal(enemy.hp, 9900, "critical damage is resisted after its multiplier");
  hero.critChance = 0;
  g.attack(hero, enemy); selectAttackModule(hero, "slash"); g.resolveAttacks(2);
  assert.equal(enemy.hp, 9850, "in-flight arrow keeps its ranged identity after equipment changes");
  g.attack(hero, enemy); selectAttackModule(hero, "bow"); g.resolveAttacks(2);
  assert.equal(enemy.hp, 9750, "in-flight melee attack cannot become a ranged hit");
  selectAttackModule(hero, "slash"); hero.weapon = "musket";
  g.attack(hero, enemy); g.resolveAttacks(2); assert.equal(enemy.hp, 9700, "equipped ranged weapon counts");
  g.attack(hero, enemy); g.heroes = []; g.resolveAttacks(2);
  assert.equal(enemy.hp, 9650, "a hero removed by sacrifice still fired the in-flight projectile");
}
{
  const { g, hero, enemy, events } = setup(undefined, "staff");
  hero.splash = .5; hero.splashRadius = 2;
  const other = { ...structuredClone(enemy), id: ++g.id, y: 3, mechanics: { rangedReduction: { mode: "fixed", value: 40 } } };
  g.enemies.push(other); g.attack(hero, enemy); g.resolveAttacks(2);
  assert.equal(enemy.hp, 9950); assert.equal(other.hp, 9990);
  assert.equal(events.filter(e => e.type === "blocked").length, 2, "each splash target applies its own armor");
}
{
  const { g, hero, enemy, events } = setup({ mode: "percent", value: 100 });
  for (const source of [
    { ...hero, id: ++g.id, isFollower: true },
    { ...hero, id: ++g.id, type: "tower" },
    { side: "hero", type: "spell", weapon: "staff" },
    { ...hero, side: "enemy", id: ++g.id },
  ]) g.hit(enemy, 100, source, false, "arrow");
  assert.equal(enemy.hp, 9600); assert.equal(events.filter(e => e.type === "blocked").length, 0);
  g.phase = "battle"; const damage = g.config.cards.fireball.effects[0].value;
  g.playCard("fireball", enemy.x, enemy.y); assert.equal(enemy.hp, 9600 - damage, "battle cards bypass this hero-only defense");
}
{
  const { g, hero, enemy, config } = setup();
  const hot = structuredClone(config); hot.enemies.grunt.mechanics.rangedReduction = { mode: "fixed", value: 80 };
  g.applyConfig(hot); hero.atk = 100; let hp = enemy.hp; g.attack(hero, enemy); g.resolveAttacks(2); assert.equal(enemy.hp, hp - 20);
  delete hot.enemies.grunt.mechanics; g.applyConfig(hot); hero.atk = 100; hp = enemy.hp;
  g.attack(hero, enemy); g.resolveAttacks(2); assert.equal(enemy.hp, hp - 100, "disabling via hot edit clears existing enemies' armor");
}
{
  const config = fixture(); assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(config))), config);
  assert.ok(Object.values(DEFAULT_CONFIG.enemies).every(e => !e.mechanics?.rangedReduction), "opt-in only");
  for (const armor of [true, { mode: "other", value: 10 }, { mode: "percent", value: 101 }, { mode: "fixed", value: -1 }, { mode: "fixed", value: NaN }]) {
    const bad = structuredClone(config); bad.enemies.grunt.mechanics.rangedReduction = armor; assert.throws(() => assertConfig(bad));
  }
  const bad = structuredClone(config); bad.cards.hero_blue.unit.mechanics = { rangedReduction: { mode: "fixed", value: 5 } };
  assert.throws(() => assertConfig(bad), "enemy mechanics cannot be put on heroes");
}
console.log("PASS enemy ranged resistance: four weapons, fixed/percent/zero/full blocks, crits, splash, lifesteal, projectile identity, exclusions, live removal and validation");
