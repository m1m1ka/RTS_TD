// Looks and starting stat templates only; equipment and trigger rules remain editable.
export const heroPresets = [
  { id: "ironwarden", name: "铁壁", role: "重甲坦克", color: "#a5b5ad", shade: "#607c73", stats: [520, 18, 1, .85, 3, 0], growth: [85, 4], weapon: "", melee: "slash" },
  { id: "shellguard", name: "壳卫", role: "龟甲守卫", color: "#a4b478", shade: "#637c51", stats: [460, 22, 1, .9, 3.5, 0], growth: [75, 5], weapon: "", melee: "claw" },
  { id: "emberblade", name: "赤鬃", role: "近战狂战士", color: "#c58b70", shade: "#925e4e", stats: [330, 37, 1, 1.2, 4.5, 10], growth: [48, 9], weapon: "", melee: "slash" },
  { id: "ronin", name: "竹影", role: "斗笠浪人", color: "#bcb185", shade: "#807555", stats: [280, 31, 1, 1.5, 5.5, 15], growth: [40, 7], weapon: "", melee: "slash" },
  { id: "falconer", name: "鹰羽", role: "远程游侠", color: "#91a584", shade: "#596f58", stats: [240, 27, 4, 1.3, 5, 10], growth: [35, 6], weapon: "bow" },
  { id: "gunner", name: "铜镜", role: "远程炮手", color: "#c8a16e", shade: "#8b6b4a", stats: [280, 44, 4, .75, 4, 5], growth: [40, 10], weapon: "coffeeCannon" },
  { id: "raven", name: "夜鸦", role: "蒙面刺客", color: "#a09aae", shade: "#615d79", stats: [220, 26, 1, 1.9, 7, 25], growth: [30, 6], weapon: "", melee: "slash" },
  { id: "foxblade", name: "绯狐", role: "狐族刺客", color: "#c69b83", shade: "#8c6658", stats: [235, 29, 1, 1.7, 6.5, 20], growth: [32, 7], weapon: "", melee: "claw" },
  { id: "frostwitch", name: "霜铃", role: "冰晶法师", color: "#a4c4c7", shade: "#648a93", stats: [215, 36, 4, .9, 4.5, 5], growth: [30, 9], weapon: "staff" },
  { id: "antler", name: "鹿苔", role: "林地祭司", color: "#a5b68b", shade: "#657e58", stats: [290, 25, 3, 1.1, 4, 5], growth: [48, 6], weapon: "staff" },
];
export const presetById = Object.fromEntries(heroPresets.map((p) => [p.id, p]));
export const presetIds = heroPresets.map((p) => p.id);
export const lookLabel = (id) => presetById[id] ? `${presetById[id].name} · ${presetById[id].role}` : id === "catgirl" ? "猫女 · 米娅" : id;
export function createPresetCard(id) {
  const p = presetById[id];
  if (!p) throw new Error("未知英雄预设");
  const [maxHp, atk, range, rate, speed, critChance] = p.stats;
  return {
    name: p.name, category: "hero", target: "ground", icon: id, useIcon: id, visual: "fireball",
    text: `${p.role} · 部署英雄`, effects: [], triggerRules: [],
    unit: { type: id, weapon: p.weapon, maxHp, atk, range, rate, speed, critChance, levelGrowth: { maxHp: p.growth[0], atk: p.growth[1] } },
  };
}
