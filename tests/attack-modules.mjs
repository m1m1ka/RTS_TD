import assert from "node:assert/strict";
import { Game, attackKind } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig, validateConfig } from "../src/config/schema.js";
import { attackModules, attackModuleId, selectAttackModule } from "../src/attack-modules.js";
import { heroPresets, createPresetCard } from "../src/hero-presets.js";
const clone = () => structuredClone(DEFAULT_CONFIG);
assert.equal(Object.keys(attackModules).length, 8);
{
  const old = clone();
  for (const p of heroPresets) old.cards[`hero_${p.id}`] = createPresetCard(p.id);
  const units = [...Object.values(old.cards).map(c=>c.unit), ...Object.values(old.enemies)].filter(Boolean);
  for (const unit of units) delete unit.attackModule;
  const migrated = assertConfig(old);
  for (const p of heroPresets) assert.equal(migrated.cards[`hero_${p.id}`].unit.attackModule, p.weapon || p.melee || "claw");
  assert.equal(migrated.cards.hero_blue.unit.attackModule,"slash");
  assert.equal(migrated.cards.hero_green.unit.attackModule,"bow");
  assert.equal(migrated.cards.hero_purple.unit.attackModule,"staff");
  assert.equal(migrated.cards.hero_catgirl.unit.attackModule,"claw");
  assert.equal(migrated.cards.tower.unit.attackModule,"coffeeCannon");
  for (const [id, unit] of Object.entries(old.enemies)) assert.equal(migrated.enemies[id].attackModule, attackModuleId(unit));
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))), migrated,"migration is portable and idempotent");
}
for (const [module,spec] of Object.entries(attackModules)) {
  const c=clone();c.cards.hero_blue.unit.attackModule=module;c.cards.hero_blue.triggerRules=[];
  // The module is authoritative even if an imported config's legacy weapon is stale.
  const g=new Game(()=>{},assertConfig(c));g.playCard("hero_blue",7,3);const hero=g.heroes[0];
  assert.equal(hero.type,"blue");assert.equal(hero.useIcon,"blue");
  assert.equal(attackKind(hero),spec.kind);assert.equal(hero.weapon,spec.weapon);
  const before=[hero.maxHp,hero.atk,hero.rate,hero.range,hero.speed];
  const edited=structuredClone(c);edited.cards.hero_blue.useIcon="cavalier";
  edited.cards.hero_blue.unit.type="raven";g.applyConfig(edited);
  assert.equal(attackKind(hero),spec.kind,"skin does not dictate attack");
  assert.deepEqual([hero.maxHp,hero.atk,hero.rate,hero.range,hero.speed],before);
  const [f]=g.summonFollowers(hero,{count:1,hpPercent:50,atkPercent:50});
  if (spec.heroOnly) {
    assert.equal(hero.combatBehavior, "heal");
    assert.equal(hero.healing.value, 30);
    assert.equal(f.attackModule, "staff", "healer followers retain offensive spells");
    assert.equal(attackKind(f), "orb");
    for (const unit of [c.enemies.grunt, c.cards.tower.unit]) {
      unit.attackModule = module;
      assert.throws(() => assertConfig(c), /治疗模组仅适用于英雄/);
      unit.attackModule = "claw";
    }
    selectAttackModule(c.cards.hero_blue.unit, "bow");
    g.applyConfig(assertConfig(c));
    assert.equal(hero.combatBehavior, "attack");
    assert.equal(attackKind(hero), "arrow");
    continue;
  }
  assert.equal(f.attackModule,module);assert.equal(attackKind(f),spec.kind);
  g.enemies=[];g.config.enemies.grunt.attackModule=module;g.startDay();g.beginWave();
  const queue={x:7,y:0,spawned:0,types:["grunt"],levels:[1],interval:1};
  g.spawn(queue);assert.equal(attackKind(g.enemies[0]),spec.kind,"enemies share the same modules");
  g.config.cards.tower.unit.attackModule=module;g.cards.tower=1;g.playCard("tower",5,5);
  assert.equal(attackKind(g.towers[0]),spec.kind,"summoned towers use the same modules");
}
{
  const c=clone(),g=new Game(()=>{},c);g.playCard("hero_blue",7,3);const h=g.heroes[0];
  c.cards.hero_blue.unit.attackModule="musket";g.applyConfig(c);
  assert.equal(attackKind(h),"bullet");assert.equal(h.weapon,"musket");
  c.cards.quiver.effects=[{type:"weapon",weapon:"bow",range:4}];g.cards.quiver=1;g.playCard("quiver",7,3);
  assert.equal(attackKind(h),"arrow","equipment overrides the module weapon");
  c.cards.hero_blue.unit.attackModule="claw";g.applyConfig(c);assert.equal(attackKind(h),"arrow");
  h.equipment=[];g.rebuildHero(h);assert.equal(attackKind(h),"claw");assert.equal(h.weapon,"");
  const invalid=clone();invalid.cards.hero_blue.unit.attackModule="hero_blue";
  assert.ok(validateConfig(invalid).length);assert.throws(()=>assertConfig(invalid));
}
console.log("PASS attack modules: 7 shared attacks and hero healing module, legacy migration, followers, live switching, equipment and validation");
