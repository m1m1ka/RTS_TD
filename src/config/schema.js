import { obstacles } from "../art.js";
import { migrateConfig } from "./migrate.js";
export const CONFIG_VERSION = 2;
export const builtInIcons = [
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
};
export const statLabels = {
  maxHp: "最大生命",
  atk: "攻击力",
  range: "攻击距离（格）",
  rate: "攻击速度（次/秒）",
  speed: "移动速度（格/秒）",
};
export const effectTypes = {
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
  const unit = (u, p) => {
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
          "maxHp",
          "atk",
          "range",
          "rate",
          "speed",
          "useIcon",
        ].includes(key)
      )
        fail(p, `未知单位字段 ${key}`);
    enumeration(u.type, p + "外观", skins);
    enumeration(u.weapon, p + "武器", Object.keys(weaponOptions));
    num(u.maxHp, p + "生命", 1, 1000000);
    num(u.atk, p + "攻击", 0, 100000);
    num(u.range, p + "距离", 0, 24, true);
    num(u.rate, p + "攻速", 0.05, 20);
    num(u.speed, p + "移速", 0.05, 20);
  };
  if (!isObject(c)) return ["配置文件必须是对象"];
  if (c.version !== CONFIG_VERSION)
    fail("版本", `仅支持版本 ${CONFIG_VERSION}`);
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
  for (const [key, card] of Object.entries(c.cards)) {
    const p = `卡牌 ${key}`;
    id(key, p);
    if (!isObject(card)) {
      fail(p, "格式错误");
      continue;
    }
    str(card.name, p + "名称", 32);
    str(card.text, p + "描述", 180);
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
        resource: ["hero", "ground"],
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
    if (!Array.isArray(card.effects) || card.effects.length > 20) {
      fail(p, "效果列表最多 20 项");
      continue;
    }
    if (card.category !== "hero" && !card.effects.length)
      fail(p, "至少需要一个效果");
    const summoned = card.effects.filter((e) => e?.type === "summon").length;
    if (card.category === "hero" || summoned) unit(card.unit, p);
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
      if (e.type === "level") num(e.value, ep, 1, 99, true);
      if (["heal", "damage"].includes(e.type)) num(e.value, ep, 1, 100000);
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
        enumeration(e.mode, ep + "模式", ["add", "multiply"]);
        num(
          e.value,
          ep + "数值",
          e.mode === "multiply" ? 0.05 : 0,
          e.mode === "multiply" ? 10 : 100000,
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
    for (const key of ["maxHp", "atk", "rate", "heal"])
      num(
        c.initial.levelGrowth[key],
        "升级成长 " + key,
        0,
        key === "rate" ? 20 : 100000,
      );
  if (c.days.length < 1 || c.days.length > 100)
    fail("天数", "需要 1～100 天");
  const dayIds = new Set();
  // Static reachability prevents a valid-looking spawn that can never reach the objective.
  const reachable = new Set(["7,5"]),
    queue = [{ x: 7, y: 5 }];
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = queue[i].x + dx,
        y = queue[i].y + dy,
        key = `${x},${y}`;
      if (
        x >= 0 &&
        x < 15 &&
        y >= 0 &&
        y < 11 &&
        !obstacles.has(key) &&
        !reachable.has(key)
      ) {
        reachable.add(key);
        queue.push({ x, y });
      }
    }
  for (const [i, day] of c.days.entries()) {
    const dp = `第 ${i + 1} 天`;
    if (!isObject(day)) { fail(dp, "格式错误"); continue; }
    id(day.id, dp + "ID");
    if (dayIds.has(day.id)) fail(dp, "关卡 ID 重复");
    dayIds.add(day.id);
    str(day.name, dp + "名称", 80);
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
          total += row.count;
        }
      }
      num(total, p + "敌人总数", 1, 500, true);
    }
    }
    const p = dp, w = day;
    if (
      !Array.isArray(w.rewards) ||
      w.rewards.length < 1 ||
      w.rewards.length > 3
    )
      fail(p, "需要 1～3 个奖励包");
    else
      for (const pack of w.rewards) {
        if (!isObject(pack)) {
          fail(p, "奖励格式错误");
          continue;
        }
        str(pack.name, p + "奖励名称", 32);
        enumeration(pack.theme, p + "奖励类型", [
          "hero",
          "resource",
          "battle",
          "equipment",
        ]);
        inventory(pack.cards, p + "奖励");
        if (!Object.values(pack.cards || {}).some((n) => n > 0))
          fail(p, "奖励不能全部为空");
      }
  }
  if (JSON.stringify(c).length > 3500000)
    fail("配置大小", "超过 3.5 MB，请减少上传图片");
  return errors;
}
export function assertConfig(c) {
  c = migrateConfig(c);
  const errors = validateConfig(c);
  if (errors.length) throw new Error(errors.slice(0, 12).join("\n"));
  return clone(c);
}
