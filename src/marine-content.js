export const pirateLooks = {
  pirate_soldier: "普通海盗士兵",
  pirate_cannon: "海盗火炮",
  pirate_shield: "海盗盾兵",
  pirate_medic: "医疗海盗",
  pirate_heavy: "重装海盗",
  pirate_captain: "船长 Boss 海盗",
};
export const pirateIds = Object.keys(pirateLooks);
export const pirateAliases = { grunt: "pirate_soldier", runner: "pirate_shield", tank: "pirate_heavy", boss: "pirate_captain" };
export const marineLabel = id => id === "base" ? "守护目标 · 美人鱼" : pirateLooks[pirateAliases[id] || id];
export const piratePresets = Object.fromEntries([
  ["pirate_soldier", 80, 12, 1, .7, .6, "slash", ""],
  ["pirate_cannon", 140, 30, 4, .45, .35, "coffeeCannon", "coffeeCannon"],
  ["pirate_shield", 180, 14, 1, .65, .55, "slash", ""],
  ["pirate_medic", 90, 8, 2, .7, .6, "staff", "staff"],
  ["pirate_heavy", 350, 28, 1, .55, .35, "slash", ""],
  ["pirate_captain", 950, 45, 1, .75, .38, "slash", ""],
].map(([id, maxHp, atk, range, rate, speed, attackModule, weapon]) => [id, {
  name: pirateLooks[id], type: id, useIcon: id, maxHp, atk, range, rate, speed, attackModule, weapon,
  critChance: 0, levelGrowth: { maxHp: 0, atk: 0 },
}]));

// Retain existing wave IDs, balance and custom art; install the two additional looks once.
export function migrateMarineContent(c) {
  if (c?.version !== 2 || !c.enemies || c.marineContentVersion !== undefined) return c;
  const oldNames = { grunt: "加班小兵", runner: "催稿蜘蛛", tank: "会议重甲", boss: "周五临时需求" };
  for (const [id, oldName] of Object.entries(oldNames)) {
    const enemy = c.enemies[id];
    if (enemy?.name === oldName) enemy.name = marineLabel(id);
  }
  for (const id of ["pirate_cannon", "pirate_medic"]) {
    if (!c.enemies[id] && Object.keys(c.enemies).length < 50) c.enemies[id] = structuredClone(piratePresets[id]);
  }
  c.marineContentVersion = 1;
  return c;
}
