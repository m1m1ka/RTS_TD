import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { applyMapPreset, mapLayoutErrors } from "../src/map-presets.js";

const legacy = structuredClone(DEFAULT_CONFIG);
delete legacy.mapPresets;
legacy.days[0].obstacles = [{ x: 2, y: 2 }];
legacy.days[0].mines = [{ x: 4, y: 4, maxHp: 345 }];
const migrated = assertConfig(legacy);
assert.deepEqual(migrated.days, legacy.days, "migration does not alter existing maps or waves");
assert.ok(Object.values(migrated.mapPresets).some(p => p.mines.some(m => m.maxHp === 345)));
assert.deepEqual(assertConfig(migrated), migrated);
assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(migrated))), migrated);
const preset = { name: "测试地图", obstacles: [{ x: 3, y: 3 }], mines: [{ x: 4, y: 4, maxHp: 888 }] };
const first = structuredClone(migrated.days[0]), second = structuredClone(migrated.days[1]);
const waves = structuredClone(first.waves);
applyMapPreset(first, preset);
applyMapPreset(second, preset);
assert.deepEqual(first.waves, waves, "applying a map leaves waves and spawn settings intact");
assert.deepEqual(first.mines, preset.mines);
first.mines[0].maxHp = 111;
first.obstacles.push({ x: 2, y: 2 });
assert.equal(preset.mines[0].maxHp, 888);
assert.equal(second.mines[0].maxHp, 888);
assert.equal(second.obstacles.length, 1);
const gate = first.waves[0].spawns[0], before = structuredClone(first);
assert.throws(() => applyMapPreset(first, { name: "占用出生点", obstacles: [{ x: gate.x, y: gate.y }], mines: [] }), /出生点/);
assert.deepEqual(first, before, "failed application is atomic");
const wall = { obstacles: Array.from({ length: 11 }, (_, y) => ({ x: 6, y })), mines: [] };
assert.equal(mapLayoutErrors(wall).length, 0);
assert.throws(() => applyMapPreset({ waves: [{ spawns: [{ x: 0, y: 5 }] }] }, wall), /无法到达核心/);
for (const layout of [
  { obstacles: [{ x: 7, y: 5 }], mines: [] },
  { obstacles: [{ x: 1.5, y: 2 }], mines: [] },
  { obstacles: [{ x: 15, y: 2 }], mines: [] },
  { obstacles: [{ x: 2, y: 2 }], mines: [{ x: 2, y: 2 }] },
  { obstacles: [], mines: [{ x: 2, y: 2, maxHp: 0 }] },
  { obstacles: [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 3 }], mines: [{ x: 2, y: 2 }] },
]) {
  const c = structuredClone(DEFAULT_CONFIG);
  c.mapPresets.test = { name: "错误地图", ...layout };
  assert.throws(() => assertConfig(c));
}
for (const value of [null, [], { test: null }]) {
  const c = structuredClone(DEFAULT_CONFIG); c.mapPresets = value;
  assert.throws(() => assertConfig(c));
}
const empty = structuredClone(DEFAULT_CONFIG);
empty.mapPresets = {};
assert.deepEqual(assertConfig(empty).mapPresets, {}, "deleting all presets does not recreate them");
console.log("PASS map presets: migration, roundtrip, reuse, independent copies, unchanged waves, blocked spawn/routes and invalid layouts");
