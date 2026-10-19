import { marineLabel } from "./marine-content.js";
import { inferHeroRole } from "./hero-grades.js";
// Looks and starting stat templates only; equipment and trigger rules remain editable.
export const heroPresets = [
  { id: "gearengineer", name: "螺帽", role: "护目镜工程师", theme: "workshop", color: "#b7ab83", shade: "#7c876a", stats: [280, 34, 4, 1, 4.5, 10], growth: [40, 7], weapon: "coffeeCannon" },
  { id: "rivetbot", name: "铆钉", role: "重装机器人", theme: "workshop", color: "#a6b3a4", shade: "#697f70", stats: [510, 30, 1, .9, 3, 5], growth: [78, 7], weapon: "", melee: "claw" },
  { id: "wrenchsmith", name: "扳手", role: "随队维修工", theme: "workshop", color: "#a8b49a", shade: "#6e8772", stats: [310, 26, 1, 1.2, 5, 5], growth: [46, 6], weapon: "", melee: "slash" },
  { id: "sparkwelder", name: "火花", role: "面罩焊接工", theme: "workshop", color: "#b7a18a", shade: "#7e7766", stats: [350, 39, 1, 1.05, 4, 15], growth: [52, 8], weapon: "", melee: "slash" },
  { id: "windupbot", name: "发条", role: "钟芯小机灵", theme: "workshop", color: "#c5b48b", shade: "#8b8e6b", stats: [235, 27, 3, 1.5, 6, 15], growth: [34, 6], weapon: "staff" },
  { id: "ragebear", name: "噬鬃", role: "凶熊 · 狂暴前排", theme: "blood", color: "#a28a73", shade: "#6b6452", stats: [540, 42, 1, .85, 4, 15], growth: [80, 9], weapon: "", melee: "claw" },
  { id: "bloodknight", name: "赤誓", role: "血誓盾卫", theme: "blood", color: "#ad8b83", shade: "#78635e", stats: [440, 27, 1, 1, 3.5, 5], growth: [68, 6], weapon: "", melee: "slash" },
  { id: "frenzyaxe", name: "裂鬃", role: "双斧狂战士", theme: "blood", color: "#bb957c", shade: "#865f50", stats: [320, 40, 1, 1.4, 5, 20], growth: [45, 9], weapon: "", melee: "slash" },
  { id: "bloodseer", name: "绯纱", role: "血杯祭司", theme: "blood", color: "#b59b9b", shade: "#80636e", stats: [240, 34, 3, 1, 4, 5], growth: [36, 8], weapon: "staff" },
  { id: "thornmartyr", name: "缚棘", role: "荆冠殉道者", theme: "blood", color: "#c3b89c", shade: "#8a8d70", stats: [390, 24, 1, 1.15, 4, 5], growth: [62, 5], weapon: "", melee: "claw" },
  { id: "redhunter", name: "暮鸦", role: "赤巾猎手", theme: "blood", color: "#ac9190", shade: "#75616b", stats: [245, 32, 4, 1.25, 5.5, 20], growth: [35, 7], weapon: "bow" },
  { id: "candlekeeper", name: "烬烛", role: "献火守烛人", theme: "blood", color: "#bbb197", shade: "#807c66", stats: [275, 30, 3, 1.1, 3.5, 5], growth: [42, 7], weapon: "staff" },
  { id: "chainbreaker", name: "断镣", role: "破枷斗士", theme: "blood", color: "#a5a99a", shade: "#707d72", stats: [370, 35, 1, 1.35, 5, 15], growth: [55, 8], weapon: "", melee: "claw" },
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
  { id: "footman", name: "灰盔", role: "盾甲步兵", theme: "medieval", color: "#a9b3a8", shade: "#6c8175", stats: [390, 26, 1, 1.1, 4, 5], growth: [60, 6], weapon: "", melee: "slash" },
  { id: "cavalier", name: "栗骑", role: "重装骑兵", theme: "medieval", color: "#b8a789", shade: "#807859", stats: [420, 38, 1, .95, 6.5, 10], growth: [65, 8], weapon: "", melee: "slash" },
  { id: "musketeer", name: "燧羽", role: "羽帽火枪手", theme: "medieval", color: "#b19c9d", shade: "#796773", stats: [230, 52, 5, .65, 4, 15], growth: [32, 11], weapon: "musket" },
  { id: "fieldmedic", name: "白棉", role: "随军医疗兵", theme: "medieval", color: "#c3c6aa", shade: "#849879", stats: [250, 18, 3, 1.2, 4.5, 0], growth: [38, 4], weapon: "staff" },
  { id: "commander", name: "狮旗", role: "披风指挥官", theme: "medieval", color: "#a2b7b5", shade: "#667f86", stats: [350, 30, 1, 1.1, 4.5, 10], growth: [52, 7], weapon: "", melee: "slash" },
  { id: "pikeman", name: "长锋", role: "锁甲长枪兵", theme: "medieval", color: "#b3bd9f", shade: "#798966", stats: [320, 32, 2, 1, 4, 5], growth: [48, 7], weapon: "", melee: "slash" },
  { id: "arbalist", name: "弩鸦", role: "皮甲弩手", theme: "medieval", color: "#bca783", shade: "#80735b", stats: [260, 40, 4, .85, 4.5, 15], growth: [38, 9], weapon: "crossbow" },
  { id: "chaplain", name: "晨祷", role: "圣堂牧师", theme: "medieval", color: "#cbbf9e", shade: "#968869", stats: [280, 32, 3, .95, 3.5, 5], growth: [44, 7], weapon: "staff" },
  { id: "headsman", name: "铁面", role: "重斧行刑官", theme: "medieval", color: "#a4a3a4", shade: "#646c6c", stats: [380, 48, 1, .8, 3.5, 20], growth: [55, 10], weapon: "", melee: "slash" },
  { id: "standardbearer", name: "赤旌", role: "王国旗手", theme: "medieval", color: "#bdab91", shade: "#8a775e", stats: [300, 22, 1, 1.2, 5, 5], growth: [46, 5], weapon: "", melee: "slash" },
];
export const presetById = Object.fromEntries(heroPresets.map((p) => [p.id, p]));
export const presetIds = heroPresets.map((p) => p.id);
export const lookLabel = (id) => presetById[id] ? `${presetById[id].name} · ${presetById[id].role}` : id === "catgirl" ? "猫女 · 米娅" : marineLabel(id) || id;
export function createPresetCard(id) {
  const p = presetById[id];
  if (!p) throw new Error("未知英雄预设");
  const [maxHp, atk, range, rate, speed, critChance] = p.stats;
  return {
    name: p.name, category: "hero", rarity: "common", role: inferHeroRole({ unit: { type: id, range } }), statSource: "custom", target: "ground", icon: id, useIcon: id, visual: "fireball",
    text: `${p.role} · 部署英雄`, effects: [], triggerRules: [],
    unit: { type: id, attackModule: p.weapon || p.melee || "claw", weapon: p.weapon, maxHp, atk, range, rate, speed, critChance, levelGrowth: { maxHp: p.growth[0], atk: p.growth[1] } },
  };
}
