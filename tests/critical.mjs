import assert from "node:assert/strict";
import { Game, BASE } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
const config = () => structuredClone(DEFAULT_CONFIG);
const target = (id, x = 6) => ({ id, side: "enemy", x, y: 3, hp: 1000, maxHp: 1000 });
{
  const c = config(), events = [];
  c.cards.hero_blue.unit.critChance = 100;
  const g = new Game(e => events.push(e), c);
  g.playCard("hero_blue", 7, 3);
  const hero = g.heroes[0], victim = target(100), other = target(101, 5);
  hero.splash = .5; hero.splashRadius = 1;
  g.enemies = [victim, other];
  g.attack(hero, victim);
  assert.equal(g.attacks[0].critical, true);
  const damage = hero.atk * 2;
  assert.equal(g.attacks[0].damage, damage);
  hero.atk = 999; hero.critChance = 0;
  g.resolveAttacks(10);
  assert.equal(victim.hp, 1000 - damage, "projectiles keep rolled damage even if attacker changes");
  assert.equal(other.hp, 1000 - Math.round(damage / 2), "splash shares one critical roll");
  assert.ok(events.filter(e => e.type === "hit").every(e => e.critical));
  g.attack(hero, victim); assert.equal(g.attacks[0].critical, false);
  assert.equal(g.attacks[0].damage, 999);
}
{
  const g = new Game(() => {}, config()), victim = target(100);
  const enemy = { id: 10, side: "enemy", x: 7, y: 4, atk: 30, critChance: 100, type: "grunt", weapon: "blade" };
  g.attack(enemy, BASE); g.resolveAttacks(10);
  assert.equal(g.baseHp, g.baseMaxHp - 60, "enemy crits apply against the core");
  victim.damageReduction = .25;
  g.attack(enemy, victim); g.resolveAttacks(10);
  assert.equal(victim.hp, 955, "mitigation applies after 200% multiplier");
  const random = Math.random;
  try {
    enemy.critChance = 25;
    Math.random = () => .2499; g.attack(enemy, victim); assert.equal(g.attacks.at(-1).critical, true);
    Math.random = () => .25; g.attack(enemy, victim); assert.equal(g.attacks.at(-1).critical, false);
  } finally { Math.random = random; }
}
{
  const c = config();
  delete c.cards.hero_blue.unit.critChance; delete c.enemies.grunt.critChance;
  const migrated = assertConfig(c);
  assert.equal(migrated.cards.hero_blue.unit.critChance, 0);
  assert.equal(migrated.enemies.grunt.critChance, 0);
  migrated.cards.hero_blue.unit.critChance = 12.5; migrated.enemies.grunt.critChance = 18;
  const g = new Game(() => {}, migrated); g.playCard("hero_blue", 7, 3);
  g.heroes[0].level = 9; g.rebuildHero(g.heroes[0]);
  assert.equal(g.heroes[0].critChance, 12.5, "level gains do not change crit chance");
  migrated.cards.hero_blue.unit.critChance = 37; g.applyConfig(migrated);
  assert.equal(g.heroes[0].critChance, 37);
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))), migrated);
  for (const value of [-1, 101, "20", null]) {
    const bad = config(); bad.enemies.grunt.critChance = value; assert.throws(() => assertConfig(bad));
  }
}
console.log("PASS critical: 0/100% and probability boundary, fixed 200%, delayed attacks, splash, enemy/core, mitigation, growth, live config and migration");
