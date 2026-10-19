import { RESOURCE_CARDS } from "./resource-effects.js";
export function migrateRewards(c) {
  if (c?.version !== 2 || !Array.isArray(c.days) || !c.cards) return c;
  c.rewardPools ??= {};
  for (const day of c.days) {
    if (!day || typeof day !== "object") continue;
    if (day.kind === "shop") continue;
    if (day.rewardPool === undefined) {
      const key = `pool_${day.id}`, weights = {};
      for (const pack of day.rewards || []) for (const [id, count] of Object.entries(pack.cards || {}))
        if (c.cards[id] && count > 0) weights[id] = Math.min(999, (weights[id] || 0) + count);
      for (const id of Object.keys(RESOURCE_CARDS)) if (c.cards[id]) weights[id] ??= 1;
      if (!Object.keys(weights).length) for (const id of Object.keys(c.cards).slice(0, 10)) weights[id] = 1;
      c.rewardPools[key] ??= { name: `${day.name || "关卡"}奖励池`, cards: weights };
      day.rewardPool = key;
    }
    delete day.rewards;
  }
  return c;
}
export function drawRewards(config, day) {
  const weights = config.rewardPools?.[day.rewardPool]?.cards || {};
  const all = Object.keys(weights).filter(key => config.cards[key] && weights[key] > 0);
  let available = [...all]; const result = [];
  if (!all.length) return result;
  for (let i = 0; i < 3; i++) {
    if (!available.length) available = [...all];
    let roll = Math.random() * available.reduce((sum, key) => sum + weights[key], 0);
    let index = available.length - 1;
    for (let j = 0; j < available.length; j++) if ((roll -= weights[available[j]]) < 0) { index = j; break; }
    result.push(available.splice(index, 1)[0]);
  }
  return result;
}
