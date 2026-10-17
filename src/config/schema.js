import { reachableTerrain } from "../terrain.js";
import { mapLayoutErrors } from "../map-presets.js";
import { heroRarities, heroRoles, heroStatFields } from "../hero-grades.js";
import { presetIds } from "../hero-presets.js";
import { attackModuleOptions } from "../attack-modules.js";
import { combatBehaviors, healingTargets } from "../healing-behavior.js";
import { valueModes, statModes } from "../effect-values.js";
import { generationDefaults, generationCategories } from "../card-generation.js";
import { RESOURCE_CARDS, resourceEffectTypes } from "../resource-effects.js";
import { SHOP_DEFAULTS } from "../shop.js";
import { campaignErrors } from "../campaign.js";
import { migrateConfig } from "./migrate.js";
import { triggerEvents, triggerScopes, triggerTargets, triggerEffects, cardPlayCategories, randomStatLabels } from "./trigger-rules.js";
export const CONFIG_VERSION = 2;
export const builtInIcons = [
  "parts",
  ...Object.keys(RESOURCE_CARDS),
  ...presetIds,
  "catgirl",
  "blue",
  "green",
  "purple",
  "base",
  "grunt",
  "runner",
  "tank",
  "boss",
  "tower",
  "training",
  "coffee",
  "fireball",
  "lightning",
  "frost",
  "quiver",
  "haste",
  "vampire",
  "guard",
  "arcane",
];
export const skins = [
  ...presetIds,
  "catgirl",
  "blue",
  "green",
  "purple",
  "grunt",
  "runner",
  "tank",
  "boss",
  "tower",
];
export const weaponOptions = {
  "": "无远程武器",
  bow: "弓",
  staff: "法杖",
  coffeeCannon: "咖啡炮",
  musket: "火枪",
  crossbow: "弩",
};
export const statLabels = {
  maxHp: "最大生命",
  atk: "攻击力",
  range: "攻击距离（格）",
  rate: "攻击速度（次/秒）",
  speed: "移动速度（格/秒）",
  critChance: "暴击率（%）",
};
export const triggerStatLabels = { ...statLabels, lifeSteal: "吸血率", critDamage: "暴击伤害（%，默认 200）" };
export const effectTypes = {
  ...resourceEffectTypes,
  generateCard: { label: "生成卡牌", categories: ["hero", "resource", "battle", "equipment"], defaults: generationDefaults },
  level: {
    label: "提升等级",
    categories: ["hero", "resource"],
    defaults: { value: 1 },
  },
  heal: {
    label: "恢复生命",
    categories: ["hero", "resource"],
    defaults: { value: 120 },
  },
  stat: {
    label: "属性增益",
    categories: ["hero", "resource", "equipment"],
    defaults: { stat: "atk", mode: "add", value: 8 },
  },
  damage: {
    label: "造成伤害",
    categories: ["battle"],
    defaults: { value: 100, radius: 1 },
  },
  slow: {
    label: "移动减速",
    categories: ["battle"],
    defaults: { value: 0.5, duration: 3, radius: 1 },
  },
  lifesteal: {
    label: "攻击吸血",
    categories: ["hero", "resource", "equipment"],
    defaults: { value: 0.15 },
  },
  mitigation: {
    label: "伤害减免",
    categories: ["hero", "resource", "equipment"],
    defaults: { value: 0.25 },
  },
  weapon: {
    label: "更换武器",
    categories: ["hero", "resource", "equipment"],
    defaults: { weapon: "staff", range: 3 },
  },
  splash: {
    label: "攻击溅射",
    categories: ["hero", "resource", "equipment"],
    defaults: { value: 0.55, radius: 1 },
  },
  summon: { label: "放置炮台", categories: ["resource"], defaults: {} },
};
export const cardRadius = (card) =>
  Math.max(0, ...card.effects.map((e) => e.radius || 0));
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const clone = (value) => structuredClone(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = (o) =>
  o !== null && typeof o === "object" && !Array.isArray(o);
export function validateConfig(c) {
  const errors = [];
  const fail = (path, msg) => errors.push(`${path}：${msg}`);
  const str = (v, p, max = 100) => {
    if (typeof v !== "string" || !v.trim() || v.length > max)
      fail(p, `请填写 1～${max} 字符`);
  };
  const num = (v, p, min, max, integer = false) => {
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < min ||
      v > max ||
      (integer && !Number.isInteger(v))
    )
      fail(p, `必须为 ${min}～${max} 的${integer ? "整数" : "数值"}`);
  };
  const enumeration = (v, p, list) => {
    if (!list.includes(v)) fail(p, "不支持的选项");
  };
  const id = (v, p) => {
    if (
      !/^[a-z][a-z0-9_]{0,47}$/.test(v) ||
      ["constructor", "prototype", "__proto__"].includes(v)
    )
      fail(p, "ID 须为小写字母开头的字母、数字、下划线（最多 48 位）");
  };
  const icon = (v, p) => {
    if (
      typeof v !== "string" ||
      (!builtInIcons.includes(v) &&
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v))
    )
      fail(p, "请选择内置图或上传 PNG / JPEG / WebP");
  };
  const generatedCards = (e, p) => {
    enumeration(e.pool, p + "生成来源", ["category", "selected"]);
    enumeration(e.category, p + "生成类型", Object.keys(generationCategories));
    num(e.count, p + "生成数量", 1, 99, true);
    if (!Array.isArray(e.cards) || e.cards.length > 100) { fail(p, "候选卡牌列表格式错误"); return; }
    if (e.pool === "selected") {
      if (!e.cards.length) fail(p, "至少选择一张候选卡牌");
      if (new Set(e.cards).size !== e.cards.length) fail(p, "候选卡牌不能重复");
      for (const key of e.cards) if (typeof key !== "string" || !own(c.cards, key)) fail(p, "候选卡牌不存在");
    }
  };
  const unit = (u, p, hero = false) => {
    if (!isObject(u)) {
      fail(p, "缺少单位属性");
      return;
    }
    for (const key of Object.keys(u))
      if (
        ![
          "name",
          "type",
          "weapon",
          "attackModule",
          "combatBehavior",
          "healing",
          "mechanics",
          "maxHp",
          "atk",
          "range",
          "rate",
          "speed",
          "critChance",
          "useIcon",
          "levelGrowth",
        ].includes(key)
      )
        fail(p, `未知单位字段 ${key}`);
    enumeration(u.type, p + "外观", skins);
    enumeration(u.weapon, p + "武器", Object.keys(weaponOptions));
    if (u.attackModule !== undefined) enumeration(u.attackModule, p + "攻击模组", Object.keys(attackModuleOptions));
    if (u.attackModule === "heal" && !hero) fail(p, "治疗模组仅适用于英雄");
    if (u.combatBehavior !== undefined) enumeration(u.combatBehavior, p + "战斗行为", Object.keys(combatBehaviors));
    if (u.mechanics !== undefined) {
      const m = u.mechanics;
      if (!hero || !isObject(m)) fail(p,"特殊机制必须是英雄配置对象");
      else {
        for (const k of Object.keys(m)) if (!["immobile","dormant","deathsAsSacrifice","knockback","arrowReduction"].includes(k)) fail(p,"未知特殊机制 "+k);
        for (const k of ["immobile","dormant","deathsAsSacrifice"]) if (m[k] !== undefined && typeof m[k] !== "boolean") fail(p,k+" 必须为开关");
        if (m.knockback !== undefined) {
          if (!isObject(m.knockback)) fail(p,"击退配置格式错误");
          else num(m.knockback.distance,p+"击退距离",1,24,true);
        }
        if (m.arrowReduction !== undefined) {
          if (!isObject(m.arrowReduction)) fail(p,"弓箭减伤配置格式错误");
          else {
            enumeration(m.arrowReduction.mode,p+"弓箭减伤方式",["fixed","percent"]);
            num(m.arrowReduction.value,p+"弓箭减伤量",0,m.arrowReduction.mode==="percent"?100:100000);
          }
        }
      }
    }
    if (u.combatBehavior === "heal" && !hero) fail(p, "自动治疗行为仅适用于英雄");
    if (u.combatBehavior === "heal" || u.healing !== undefined) {
      if (!isObject(u.healing)) fail(p, "缺少治疗参数");
      else {
        enumeration(u.healing.targets, p + "治疗对象", Object.keys(healingTargets));
        enumeration(u.healing.valueMode, p + "治疗数值类型", ["fixed", "percent"]);
        num(u.healing.value, p + "单次治疗量", u.healing.valueMode === "percent" ? .01 : 1, u.healing.valueMode === "percent" ? 100 : 100000);
      }
      if (u.combatBehavior === "heal" && u.range < 1) fail(p, "治疗距离至少为 1 格");
    }
    num(u.maxHp, p + "生命", 1, 1000000);
    num(u.atk, p + "攻击", 0, 100000);
    num(u.range, p + "距离", 0, 24, true);
    num(u.rate, p + "攻速", 0.05, 20);
    num(u.speed, p + "移速", 0.05, 20);
    if (u.critChance !== undefined) num(u.critChance, p + "暴击率", 0, 100);
    if (u.critDamage !== undefined) num(u.critDamage, p + "暴击伤害", 100, 100000);
    if (u.levelGrowth !== undefined) {
      if (!isObject(u.levelGrowth)) fail(p + "等级成长", "缺少生命和攻击每级增量");
      else for (const key of ["maxHp", "atk"])
        num(u.levelGrowth[key], p + "每级成长 " + key, 0, 100000);
    }
  };
  if (!isObject(c)) return ["配置文件必须是对象"];
  if (c.version !== CONFIG_VERSION)
    fail("版本", `仅支持版本 ${CONFIG_VERSION}`);
  if (c.heroContentVersion !== undefined && c.heroContentVersion !== 1)
    fail("英雄内容版本", "不支持的版本");
  if (c.resourceContentVersion !== undefined && c.resourceContentVersion !== 1)
    fail("资源内容版本", "不支持的版本");
  str(c.name, "配置名称", 80);
  if (
    !isObject(c.cards) ||
    !isObject(c.enemies) ||
    !isObject(c.initial) ||
    !Array.isArray(c.days)
  )
    return [...errors, "缺少 cards / enemies / initial / days 配置"];
  if (Object.keys(c.cards).length < 1 || Object.keys(c.cards).length > 100)
    fail("卡牌", "需要 1～100 张卡牌定义");
  if (!isObject(c.mapPresets) || Object.keys(c.mapPresets).length > 100) fail("地图预设", "需要最多 100 个地图预设");
  else for (const [key, preset] of Object.entries(c.mapPresets)) {
    id(key, "地图预设 ID");
    if (!isObject(preset)) { fail("地图预设 " + key, "格式错误"); continue; }
    str(preset.name, "地图预设名称", 80);
    for (const error of mapLayoutErrors(preset)) fail("地图预设 " + preset.name, error);
  }
  if (!isObject(c.initial.heroStatPresets)) fail("英雄数值预设", "缺少品质与定位预设");
  else for (const rarity of Object.keys(heroRarities)) {
    for (const role of Object.keys(heroRoles)) {
      const preset = c.initial.heroStatPresets[rarity]?.[role];
      const label = `英雄预设 ${heroRarities[rarity]} · ${heroRoles[role]}`;
      if (!isObject(preset)) { fail(label, "缺少数值配置"); continue; }
      for (const [path, spec] of Object.entries(heroStatFields)) {
        const value = path.split(".").reduce((v, key) => v?.[key], preset);
        num(value, label + " " + spec.label, spec.min, spec.max, spec.step === 1);
      }
    }
  }
  for (const [key, card] of Object.entries(c.cards)) {
    const p = `卡牌 ${key}`;
    id(key, p);
    if (!isObject(card)) {
      fail(p, "格式错误");
      continue;
    }
    str(card.name, p + "名称", 32);
    if (card.category === "hero") {
      enumeration(card.rarity, p + "品质", Object.keys(heroRarities));
      enumeration(card.role, p + "定位", Object.keys(heroRoles));
      enumeration(card.statSource, p + "数值来源", ["preset", "custom"]);
    }
    str(card.text, p + "描述", 180);
    if (card.temporary !== undefined && typeof card.temporary !== "boolean") fail(p, "临时牌开关必须为布尔值");
    enumeration(card.category, p + "类型", [
      "hero",
      "resource",
      "battle",
      "equipment",
    ]);
    enumeration(
      card.target,
      p + "目标",
      {
        hero: ["ground"],
        resource: ["hero", "ground", "any"],
        battle: ["enemy", "area"],
        equipment: ["hero"],
      }[card.category] || [],
    );
    icon(card.icon, p + "卡面图");
    icon(card.useIcon, p + "使用图");
    enumeration(card.visual, p + "施法特效", [
      "fireball",
      "lightning",
      "frost",
    ]);
    if (card.triggerRules !== undefined) {
      if (card.category !== "hero") fail(p, "只有英雄牌可以配置触发规则");
      if (!Array.isArray(card.triggerRules) || card.triggerRules.length > 20)
        fail(p, "触发规则最多 20 条");
      else for (const [i, rule] of card.triggerRules.entries()) {
        const rp = `${p}触发规则 ${i + 1}`;
        if (!isObject(rule) || !isObject(rule.trigger) || !isObject(rule.target)) {
          fail(rp, "缺少触发时机或作用目标"); continue;
        }
        str(rule.name, rp + "名称", 32);
        if (typeof rule.enabled !== "boolean") fail(rp, "启用状态必须是布尔值");
        enumeration(rule.trigger.event, rp + "事件", Object.keys(triggerEvents));
        if (rule.trigger.event === "cardPlayed") {
          num(rule.trigger.every ?? 1, rp + "用牌间隔", 1, 999, true);
          enumeration(rule.trigger.category ?? "all", rp + "用牌类型", Object.keys(cardPlayCategories));
        }
        if (rule.trigger.event === "interval") num(rule.trigger.interval, rp + "触发间隔（秒）", .1, 3600);
        enumeration(rule.trigger.scope, rp + "事件来源", Object.keys(triggerScopes));
        num(rule.trigger.radius, rp + "监听半径", -1, 24, true);
        enumeration(rule.target.kind, rp + "目标", Object.keys(triggerTargets));
        if (rule.target.kind === "eventTower" && rule.trigger.event !== "towerBuilt") fail(rp, "本次建造的炮台只能搭配建设炮台时");
        num(rule.target.radius, rp + "目标半径", -1, 24, true);
        num(rule.target.count, rp + "目标英雄数量", 1, 20, true);
        if (!Array.isArray(rule.effects) || !rule.effects.length || rule.effects.length > 20) {
          fail(rp, "需要 1～20 个后续效果"); continue;
        }
        for (const effect of rule.effects) {
          if (!isObject(effect)) { fail(rp, "效果格式错误"); continue; }
          enumeration(effect.type, rp + "效果", Object.keys(triggerEffects));
          if (effect.type === "randomStat") for (const stat of Object.keys(randomStatLabels))
            num(effect[stat], rp + randomStatLabels[stat], 0, ["lifeSteal", "critChance"].includes(stat) ? 100 : 100000);
          if (effect.type === "refundCard") {
            num(effect.chance, rp + "返还概率", 0, 100);
            if (rule.trigger.event !== "cardPlayed") fail(rp, "返还卡牌需要搭配用牌触发时机");
          }
          if (effect.type === "victoryGold") {
            num(effect.value,rp+"额外胜利金币",1,999,true);
            if (rule.trigger.event !== "victory") fail(rp,"额外胜利金币需搭配胜利触发时机");
          }
          if (rule.target.kind === "eventTower" && ["revive", "summonFollower", "triggerBattleStart", "triggerPreparation"].includes(effect.type)) fail(rp, "炮台不能响应英雄专属的复活、随从、开战或整备效果");
          if (effect.type === "ownerLevel") num(effect.percent, rp + "自身等级比例", .01, 1000);
          if (effect.type === "revive") {
            num(effect.maxRevives, rp + "每天复活次数", 1, 99, true);
            num(effect.hpPercent, rp + "复活生命比例", 1, 100);
          }
          if (effect.whileSourceAlive !== undefined) {
            if (typeof effect.whileSourceAlive !== "boolean") fail(rp, "英雄在场时生效必须是布尔值");
            if (effect.whileSourceAlive && effect.type !== "stat") fail(rp, "英雄在场时生效仅适用于持续性属性加成，即时效果不能回滚");
          }
          if (effect.type === "generateCard") generatedCards(effect, rp);
          if (effect.type === "summonFollower") {
            num(effect.hpPercent, rp + "随从生命比例", 1, 500);
            num(effect.atkPercent, rp + "随从攻击比例", 1, 500);
            num(effect.count, rp + "随从数量", 1, 8, true);
          }
          if (effect.type === "level") num(effect.value, rp + "等级", 1, 99, true);
          if (effect.valueMode !== undefined) {
            enumeration(effect.valueMode, rp + "数值类型", Object.keys(valueModes));
            if (effect.type !== "heal") fail(rp, "只有恢复生命支持数值类型；属性加成请使用计算方式");
          }
          if (effect.type === "heal") num(effect.value, rp + "治疗", effect.valueMode === "percent" ? .01 : 1, effect.valueMode === "percent" ? 100 : 100000);
          if (effect.type === "stat") {
            enumeration(effect.stat, rp + "属性", Object.keys(triggerStatLabels));
            enumeration(effect.mode, rp + "计算方式", Object.keys(statModes));
            enumeration(effect.duration, rp + "持续时间", ["day", "permanent"]);
            num(effect.value, rp + "数值", effect.mode === "multiply" ? 0.05 : 0,
              effect.mode === "percent" ? 10000 : effect.mode === "multiply" ? 10 : effect.stat === "lifeSteal" ? 0.95 : 100000, effect.stat === "range" && effect.mode === "add");
          }
        }
      }
    }
    if (!Array.isArray(card.effects) || card.effects.length > 20) {
      fail(p, "效果列表最多 20 项");
      continue;
    }
    if (card.category !== "hero" && !card.effects.length)
      fail(p, "至少需要一个效果");
    const summoned = card.effects.filter((e) => e?.type === "summon").length;
    if (card.category === "hero" || summoned) unit(card.unit, p, card.category === "hero");
    if (
      card.category === "resource" &&
      ((card.target === "ground" && summoned !== 1) ||
        (card.target === "hero" && summoned))
    )
      fail(p, "地面资源牌必须有一个放置炮台效果；英雄目标不能放置炮台");
    for (const [i, e] of card.effects.entries()) {
      const ep = p + "效果 " + (i + 1),
        spec = effectTypes[e?.type];
      if (!spec || !spec.categories.includes(card.category)) {
        fail(ep, "该类型不支持此效果");
        continue;
      }
      if (card.target === "any" && !["gold", "generateCard"].includes(e.type))
        fail(ep, "战场任意位置仅支持获得金币和生成卡牌；其他效果请选择英雄或地面目标");
      if (e.type === "level") num(e.value, ep, 1, 99, true);
      if (e.type === "generateCard") generatedCards(e, ep);
      if (e.type === "gold") num(e.value, ep + "金币", 1, 999, true);
      if (["swapLevels", "sacrifice", "drainLevels"].includes(e.type)) num(e.radius, ep + "英雄范围", -1, 24, true);
      if (["battleStart", "swapLevels", "sacrifice", "drainLevels"].includes(e.type) && card.target !== "hero") fail(ep, "此效果需要英雄目标");
      if (e.type === "drainLevels") {
        num(e.limit, ep + "吸取总上限", 1, 999, true);
        num(e.perHero, ep + "每位英雄上限", 1, 999, true);
      }
      if (e.valueMode !== undefined) {
        enumeration(e.valueMode, ep + "数值类型", Object.keys(valueModes));
        if (!["heal", "damage"].includes(e.type)) fail(ep, "只有恢复生命和造成伤害支持数值类型；属性加成请使用计算方式");
      }
      if (["heal", "damage"].includes(e.type)) num(e.value, ep, e.valueMode === "percent" ? .01 : 1, e.valueMode === "percent" ? 100 : 100000);
      if (["damage", "slow", "splash"].includes(e.type))
        num(e.radius, ep + "范围", 0, 24, true);
      if (["slow", "lifesteal", "mitigation", "splash"].includes(e.type))
        num(e.value, ep + "比例", 0, e.type === "splash" ? 5 : 0.95);
      if (e.type === "slow") num(e.duration, ep + "时长", 0.1, 120);
      if (e.type === "weapon") {
        enumeration(e.weapon, ep + "武器", Object.keys(weaponOptions));
        num(e.range, ep + "最小射程", 0, 24, true);
      }
      if (e.type === "stat") {
        enumeration(e.stat, ep + "属性", Object.keys(statLabels));
        enumeration(e.mode, ep + "模式", Object.keys(statModes));
        num(
          e.value,
          ep + "数值",
          e.mode === "multiply" ? 0.05 : 0,
          e.mode === "percent" ? 10000 : e.mode === "multiply" ? 10 : 100000,
          e.stat === "range" && e.mode === "add",
        );
      }
    }
  }
  if (Object.keys(c.enemies).length < 1 || Object.keys(c.enemies).length > 50)
    fail("敌人", "需要 1～50 种敌人");
  for (const [key, e] of Object.entries(c.enemies)) {
    id(key, "敌人 " + key);
    if (!isObject(e)) {
      fail(key, "敌人格式错误");
      continue;
    }
    str(e.name, key + "名称", 32);
    icon(e.useIcon, key + "图标");
    unit(e, "敌人 " + key);
  }
  const inventory = (v, p) => {
    if (!isObject(v)) {
      fail(p, "卡牌数量格式错误");
      return;
    }
    for (const [key, count] of Object.entries(v)) {
      if (!own(c.cards, key)) fail(p, `不存在卡牌 ${key}`);
      num(count, p + " " + key, 0, 999, true);
    }
  };
  num(c.initial.baseHp, "核心生命", 1, 1000000);
  num(c.initial.firstWaveDelay, "每天第一波等待时间", 0, 3600);
  num(c.initial.waveHeal, "波后治疗比例", 0, 1);
  num(c.initial.reviveHp, "复活血量比例", 0.01, 1);
  inventory(c.initial.cards, "初始手牌");
  if (
    isObject(c.initial.cards) &&
    !Object.entries(c.initial.cards).some(
      ([k, n]) => n > 0 && c.cards[k]?.category === "hero",
    )
  )
    fail("初始手牌", "至少需要一张英雄牌");
  if (!isObject(c.initial.levelGrowth)) fail("升级成长", "缺少配置");
  else
    for (const key of ["maxHp", "atk", "heal"])
      num(
        c.initial.levelGrowth[key],
        "升级成长 " + key,
        0,
        100000,
      );
  if (c.days.length < 1 || c.days.length > 100)
    fail("天数", "需要 1～100 天");
  const dayIds = new Set();
  for (const [i, day] of c.days.entries()) {
    const dp = `第 ${i + 1} 天`;
    if (!isObject(day)) { fail(dp, "格式错误"); continue; }
    id(day.id, dp + "ID");
    if (dayIds.has(day.id)) fail(dp, "关卡 ID 重复");
    dayIds.add(day.id);
    str(day.name, dp + "名称", 80);
    if (day.kind !== undefined) enumeration(day.kind, dp + "节点类型", ["battle", "shop"]);
    if (day.kind === "shop") {
      if (!isObject(day.shop)) fail(dp, "缺少商店价格配置");
      else for (const key of Object.keys(SHOP_DEFAULTS)) num(day.shop[key], dp + "商店 " + key, 0, 999, true);
      if (!Array.isArray(day.waves)) fail(dp, "商店的 waves 应为空数组或保留的战斗配置");
      continue;
    }
    const terrain = new Set();
    if (day.obstacles !== undefined && (!Array.isArray(day.obstacles) || day.obstacles.length > 164))
      fail(dp + "地图障碍", "需要最多 164 个格子坐标");
    else for (const cell of day.obstacles || []) {
      if (!isObject(cell)) { fail(dp + "地图障碍", "格子坐标格式错误"); continue; }
      num(cell.x, dp + "障碍 X", 0, 14, true);
      num(cell.y, dp + "障碍 Y", 0, 10, true);
      const key = `${cell.x},${cell.y}`;
      if (key === "7,5" || terrain.has(key)) fail(dp + "地图障碍", "不能占用打卡机或重复格子");
      terrain.add(key);
    }
    const mineCells = new Set();
    if (day.mines !== undefined && (!Array.isArray(day.mines) || day.mines.length > 163)) fail(dp + "金矿", "需要最多 163 个金矿坐标");
    else for (const mine of day.mines || []) {
      if (!isObject(mine)) { fail(dp + "金矿", "格式错误"); continue; }
      num(mine.x, dp + "金矿 X", 0, 14, true);
      num(mine.y, dp + "金矿 Y", 0, 10, true);
      if (mine.maxHp !== undefined) num(mine.maxHp, dp + "金矿生命", 1, 100000, true);
      const key = `${mine.x},${mine.y}`;
      if (key === "7,5" || terrain.has(key) || mineCells.has(key)) fail(dp + "金矿", "不能与打卡机、树木或其他金矿重叠");
      mineCells.add(key);
    }
    const reachable = reachableTerrain(new Set([...terrain, ...mineCells]));
    for (const key of mineCells) {
      const [x, y] = key.split(",").map(Number);
      if (![[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b]) => reachable.has(`${a},${b}`))) fail(dp + "金矿", "金矿需要保留可到达的相邻格子");
    }
    if (reachable.size < 2) fail(dp + "地图障碍", "需要保留通往打卡机的道路");
    if (!Array.isArray(day.waves) || !day.waves.length || day.waves.length > 100) {
      fail(dp, "每天需要 1～100 波");
      continue;
    }
    const waveIds = new Set();
    for (const [j, w] of day.waves.entries()) {
    const p = `${dp} · 第 ${j + 1} 波`;
    if (!isObject(w)) {
      fail(p, "格式错误");
      continue;
    }
    id(w.id, p + "ID");
    if (waveIds.has(w.id)) fail(p, "波次 ID 重复");
    waveIds.add(w.id);
    str(w.name, p + "名称", 80);
    num(w.startDelay, p + "上一波结束后等待秒数", 0, 3600);
    num(w.hpScale, p + "生命倍率", 0.05, 100);
    num(w.atkScale, p + "攻击倍率", 0.05, 100);
    if (!Array.isArray(w.spawns) || !w.spawns.length || w.spawns.length > 40)
      fail(p, "需要 1～40 个出生点");
    else {
      const seen = new Set();
      let total = 0;
      for (const pos of w.spawns) {
        if (!isObject(pos)) {
          fail(p, "出生点格式错误");
          continue;
        }
        num(pos.x, p + "出生点 X", 0, 14, true);
        num(pos.y, p + "出生点 Y", 0, 10, true);
        const key = `${pos.x},${pos.y}`;
        if (key === "7,5" || !reachable.has(key) || seen.has(key))
          fail(p, `出生点 (${key}) 不可达、被占用或重复`);
        seen.add(key);
        num(pos.delay, p + `出生点 (${key}) 波内延迟`, 0, 3600);
        num(pos.interval, p + `出生点 (${key}) 出兵间隔`, 0.1, 1200);
        if (!Array.isArray(pos.enemies) || !pos.enemies.length || pos.enemies.length > 500)
          fail(p, "每个出生点需要 1～500 项敌人类型 / 数量配置");
        else for (const row of pos.enemies) {
          if (!isObject(row)) { fail(p, "敌人配置格式错误"); continue; }
          if (!own(c.enemies, row.type)) fail(p, `不存在敌人 ${row.type}`);
          num(row.count, p + "敌人数量", 1, 500, true);
          if (row.level !== undefined) num(row.level, p + "敌人等级", 1, 999, true);
          total += row.count;
        }
      }
      num(total, p + "敌人总数", 1, 500, true);
    }
    }
    if (!c.rewardPools || !own(c.rewardPools, day.rewardPool)) fail(dp, "请选择有效奖励池");
  }
  if (!isObject(c.rewardPools) || !Object.keys(c.rewardPools).length || Object.keys(c.rewardPools).length > 100) fail("奖励池", "需要 1～100 个奖励池");
  else for (const [key, pool] of Object.entries(c.rewardPools)) {
    id(key, "奖励池 ID");
    if (!isObject(pool)) { fail(key, "奖励池格式错误"); continue; }
    str(pool.name, "奖励池名称", 80);
    inventory(pool.cards, "奖励池 " + pool.name);
    if (!Object.values(pool.cards || {}).some(n => n > 0)) fail(pool.name, "奖励池至少需要一张权重大于 0 的卡牌");
  }
  if (JSON.stringify(c).length > 3500000)
    fail("配置大小", "超过 3.5 MB，请减少上传图片");
  if (c.days.every((day) => isObject(day) && typeof day.id === "string"))
    for (const error of campaignErrors(c)) fail("关卡路线", error);
  return errors;
}
export function assertConfig(c) {
  c = migrateConfig(c);
  const errors = validateConfig(c);
  if (errors.length) throw new Error(errors.slice(0, 12).join("\n"));
  return clone(c);
}
