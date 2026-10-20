import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { upcomingLandings } from "../src/enemy-preview.js";
import { launchBoat } from "../src/sea-arrivals.js";
const config = structuredClone(DEFAULT_CONFIG);
config.days[0].obstacles = []; config.days[0].mines = [];
config.days[0].waves[0].spawns = [[0,5], [14,5], [7,0], [7,10]].map(([x,y]) => ({
  x, y, delay: 5, interval: 1, enemies: [{type:"grunt",count:2,level:1}, {type:"tank",count:1,level:1}],
}));
config.enemies.grunt.description = "近战海盗 <b>测试</b>";
assertConfig(config);
const game = new Game(() => {}, config);
let groups = upcomingLandings(game);
assert.equal(groups.length, 4);
for (const g of groups) assert.deepEqual(g.enemies, [{type:"grunt",count:2},{type:"tank",count:1}]);
game.dayPlan = structuredClone(config.days[0]); game.dayEnemySpecs = structuredClone(config.enemies);
game.beginWave();
assert.deepEqual(upcomingLandings(game), groups);
launchBoat(game, game.spawnQueues[0]);
assert.equal(upcomingLandings(game).length, 3);
assert.equal(game.enemies.length, 3);
game.spawnQueues.push({...game.spawnQueues[1], types:["grunt"], spawned:0, boatLaunched:false});
assert.equal(upcomingLandings(game)[0].enemies[0].count, 3);
for (const phase of ["reward","route","shop","victory","lost","won"]) {
  game.phase = phase; assert.deepEqual(upcomingLandings(game), []);
}
const bad = structuredClone(config); bad.enemies.grunt.description = "a".repeat(181);
assert.throws(() => assertConfig(bad));
bad.enemies.grunt.description = 4; assert.throws(() => assertConfig(bad));
bad.enemies.grunt.description = ""; assertConfig(bad);
console.log("PASS enemy preview: four shores, mixed crews, merged types, launch removal, phase cleanup and descriptions");
