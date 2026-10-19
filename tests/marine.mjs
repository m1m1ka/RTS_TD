import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { piratePresets, pirateIds } from "../src/marine-content.js";

const old = structuredClone(DEFAULT_CONFIG);
delete old.marineContentVersion;
delete old.enemies.pirate_cannon;
delete old.enemies.pirate_medic;
old.enemies.grunt.name = "加班小兵";
Object.assign(old.enemies.runner, { name: "自定义快艇", maxHp: 567, useIcon: "green" });
const custom = structuredClone(old.enemies.runner), days = structuredClone(old.days);
const updated = assertConfig(old);
assert.equal(updated.enemies.grunt.name, "普通海盗士兵");
assert.deepEqual(updated.enemies.runner, custom, "preserve custom names, stats and artwork");
assert.deepEqual(updated.days, days, "preserve the player's maps and wave composition");
for (const id of pirateIds) {
  updated.enemies[id] = structuredClone(piratePresets[id]);
}
assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(updated))), updated, "all six presets are portable");
delete updated.enemies.pirate_medic;
assert.equal(assertConfig(updated).enemies.pirate_medic, undefined, "an intentionally deleted preset stays deleted");
console.log("PASS marine: six valid presets, legacy migration, custom art/stats, wave preservation and deletion persistence");
