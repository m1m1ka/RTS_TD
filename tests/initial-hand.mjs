import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import { assertConfig } from "../src/config/schema.js";
import { drawWeightedCards, drawRewards } from "../src/rewards.js";

const config = () => {
  const c = structuredClone(DEFAULT_CONFIG);
  c.initial.cards = { hero_blue: 1, hero_green: 1, hero_purple: 1, training: 3, fireball: 1, coffee: 0 };
  return c;
};
{
  const c = config(), events = [], g = new Game(e => events.push(e), c);
  assert.equal(g.phase, "initialDraft");
  assert.deepEqual(g.cards, {});
  assert.deepEqual(g.skillCards, []);
  assert.equal(g.initialHandOptions.length, 5);
  assert.equal(new Set(g.initialHandOptions).size, 5);
  assert.ok(!g.initialHandOptions.includes("coffee"));
  g.tick(100); g.startDay();
  assert.equal(g.phase, "initialDraft"); assert.equal(g.time, 0);
  assert.equal(g.playCard("hero_blue", 7, 3), false);
  for (const invalid of [null, [], [0], [0, 0], [0, 1, 2], [-1, 1], [0, 5], [0, .5], ["0", 1], [NaN, 1]]) {
    assert.equal(g.chooseInitialHand(invalid), false);
    assert.deepEqual(g.cards, {});
  }
  const selected = ["hero_blue", "fireball"].map(key => g.initialHandOptions.indexOf(key));
  assert.equal(g.chooseInitialHand(selected, g.initialDraftVersion - 1), false);
  assert.ok(g.chooseInitialHand(selected));
  assert.deepEqual(g.cards, { hero_blue: 1, fireball: 1 });
  assert.equal(g.skillCards.length, 1);
  assert.equal(g.phase, "ready");
  assert.deepEqual(g.initialHandOptions, []);
  assert.deepEqual(g.completedDays, []);
  assert.equal(g.chooseInitialHand(selected), false);
  assert.equal(events.filter(e => e.type === "initialHandChosen").length, 1);
  const next = config(); next.initial.cards = { hero_green: 99 };
  g.applyConfig(next);
  assert.deepEqual(g.cards, { hero_blue: 1, fireball: 1 }, "saving a pool never grants it to an existing hand");
  const version = g.initialDraftVersion;
  g.reset();
  assert.equal(g.phase, "initialDraft");
  assert.deepEqual(g.cards, {});
  assert.ok(g.initialDraftVersion > version);
  assert.deepEqual(g.initialHandOptions, Array(5).fill("hero_green"));
  assert.ok(g.chooseInitialHand([0, 1]));
  assert.deepEqual(g.cards, { hero_green: 2 }, "different offers of the same card each grant one copy");
}
{
  const g = new Game(() => {}, config()), offers = [...g.initialHandOptions], version = g.initialDraftVersion;
  const edited = config(); edited.initial.baseHp += 100;
  g.applyConfig(edited);
  assert.deepEqual(g.initialHandOptions, offers, "unrelated saves do not reroll");
  assert.equal(g.initialDraftVersion, version);
  const changed = config(); changed.initial.cards = { hero_purple: 1 };
  g.applyConfig(changed);
  assert.deepEqual(g.initialHandOptions, Array(5).fill("hero_purple"));
  assert.equal(g.chooseInitialHand([0, 1], version), false, "reject stale animated claims after a pool edit");
  assert.deepEqual(g.cards, {});
  assert.ok(g.chooseInitialHand([0, 4]));
}
{
  const c = config(); c.days[0].kind = "shop";
  const g = new Game(() => {}, assertConfig(c));
  assert.equal(g.phase, "initialDraft"); assert.equal(g.shop, null);
  assert.ok(g.chooseInitialHand([0, 1]));
  assert.equal(g.phase, "shop"); assert.ok(g.shop);
}
{
  const c = config();
  assert.deepEqual(assertConfig(JSON.parse(JSON.stringify(assertConfig(c)))).initial.cards, c.initial.cards);
  const random = Math.random;
  try {
    Math.random = () => .1;
    assert.equal(drawWeightedCards(c, { hero_blue: 1, hero_green: 9 }, 5)[0], "hero_green");
  } finally { Math.random = random; }
  const g = new Game(() => {}, c);
  g.chooseInitialHand([0, 1]);
  const before = { ...g.cards };
  g.phase = "reward"; g.rewardOptions = drawRewards(c, c.days[0]);
  assert.equal(g.rewardOptions.length, 3, "normal victory rewards stay three-of-one");
  assert.equal(g.chooseReward([0, 1]), false);
  const chosen = g.rewardOptions[0];
  assert.ok(g.chooseReward([0]));
  assert.equal(g.cards[chosen], (before[chosen] || 0) + 1);
  assert.ok(g.chooseDay(g.nextDays()[0]));
  assert.equal(g.phase, "between"); assert.deepEqual(g.initialHandOptions, []);
}
console.log("PASS initial hand: weighted five-of-two, atomic claims, duplicates, no pre-grants, frozen combat, skills, reset, hot config, shop starts, portability and unchanged victory rewards");
