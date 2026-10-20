import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { migrateHeroTags, inferHeroTags, HERO_TAGS } from "../src/hero-tags.js";
const c = structuredClone(DEFAULT_CONFIG);
delete c.initial.heroTagDescriptions;
for (const card of Object.values(c.cards)) delete card.tags;
migrateHeroTags(c);
assertConfig(c);
for (const card of Object.values(c.cards).filter(c => c.category === "hero")) assert.deepEqual(card.tags, inferHeroTags(card));
c.cards.hero_blue.tags = [];
migrateHeroTags(c);
assert.deepEqual(c.cards.hero_blue.tags, []);
delete c.initial.heroTagDescriptions.follower;
c.initial.heroTagDescriptions.parts = "保留自定义说明";
migrateHeroTags(c);
assert.ok(c.initial.heroTagDescriptions.follower.includes("协战单位"));
assert.equal(c.initial.heroTagDescriptions.parts, "保留自定义说明");
assert.deepEqual(c.cards.hero_blue.tags, []);
assert.deepEqual(inferHeroTags({ triggerRules: [{ enabled: true, effects: [{type:"summonFollower"}] }] }), ["follower"]);
c.cards.hero_blue.tags = Object.keys(HERO_TAGS);
assertConfig(c);
for (const tags of [["unknown"], ["parts", "parts"], "parts"]) {
  const invalid = structuredClone(c); invalid.cards.hero_blue.tags = tags;
  assert.throws(() => assertConfig(invalid));
}
const invalid = structuredClone(c); invalid.initial.heroTagDescriptions.parts = "a".repeat(181);
assert.throws(() => assertConfig(invalid));
console.log("PASS hero tags: legacy inference, explicit empty tags, multiple tags and invalid configuration");
