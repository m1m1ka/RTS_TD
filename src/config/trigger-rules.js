import { generationDefaults } from "../card-generation.js";
// Event, source filter, target selection and payload are independent registries.
export const triggerEvents = {
  cardPlayed: "每使用 X 张牌后",
  interval: "战斗中每隔 X 秒",
  towerBuilt: "建设炮台时",
  preparation: "整备（开战前上场）",
  sacrifice: "牺牲（自身死亡时）",
  victory: "胜利（存活至本天战斗胜利）",
  battleStart: "开战（点击迎战）",
  heroBattleStart: "英雄触发开战效果后",
  heroSacrifice: "英雄触发牺牲效果后",
};
export const triggerScopes = { any: "任意英雄（含自身）", self: "仅自身", others: "其他英雄" };
export const triggerTargets = {
  eventTower: "本次建造的炮台",
  self: "自身", nearest: "最近的其他英雄", selfAndNearest: "自身 + 最近的其他英雄",
  allAllies: "范围内所有英雄（含自身）", eventHero: "触发事件的英雄",
  randomAllies: "范围内随机英雄（含自身）",
  alliesWithFollowers: "范围内所有拥有随从的英雄",
};
export const triggerEffects = {
  randomStat: { label: "随机一项永久强化", defaults: { maxHp: 20, atk: 2, lifeSteal: 1, critChance: 1, critDamage: 5 } },
  refundCard: { label: "概率返还本次使用的牌", defaults: { chance: 20 } },
  victoryGold: { label: "胜利后额外获得金币", defaults: { value: 2 } },
  ownerLevel: { label: "按自身等级比例提升目标等级", defaults: { percent: 50 } },
  revive: { label: "复活", defaults: { maxRevives: 1, hpPercent: 50 } },
  summonFollower: { label: "召唤随从分身", defaults: { hpPercent: 50, atkPercent: 50, count: 1 } },
  generateCard: { label: "生成卡牌", defaults: generationDefaults },
  level: { label: "提升等级", defaults: { value: 1 } },
  heal: { label: "恢复生命", defaults: { value: 50 } },
  stat: { label: "属性加成", defaults: { stat: "rate", mode: "add", value: 0.2, duration: "day" } },
  triggerBattleStart: { label: "额外触发一次开战效果", defaults: {} },
  triggerPreparation: { label: "额外触发一次整备效果", defaults: {} },
};
export const newTriggerRule = () => ({
  name: "开战成长", enabled: true,
  trigger: { event: "battleStart", scope: "any", radius: -1, interval: 10 },
  target: { kind: "self", radius: -1, count: 1 },
  effects: [{ type: "level", value: 1 }],
});
export const cardPlayCategories = { all: "任意牌", resourceBattle: "资源牌和战斗牌", hero: "英雄牌", resource: "资源牌", battle: "战斗牌", equipment: "装备牌" };
export const randomStatLabels = { maxHp: "最大生命增加", atk: "攻击力增加", lifeSteal: "吸血增加（百分点）", critChance: "暴击率增加（百分点）", critDamage: "暴击伤害增加（百分点）" };
export const cardPlayRules = {
  fiveCards: { ...newTriggerRule(), name: "五牌馈赠", trigger: { event: "cardPlayed", scope: "any", radius: -1, every: 5, category: "all" }, effects: [{ type: "generateCard", ...generationDefaults, category: "all" }] },
  cardGrowth: { ...newTriggerRule(), name: "用牌成长", trigger: { event: "cardPlayed", scope: "any", radius: -1, every: 1, category: "all" }, effects: [{ type: "randomStat", ...triggerEffects.randomStat.defaults }] },
  cardRefund: { ...newTriggerRule(), name: "灵感返还", trigger: { event: "cardPlayed", scope: "any", radius: -1, every: 1, category: "resourceBattle" }, effects: [{ type: "refundCard", ...triggerEffects.refundCard.defaults }] },
};
export function defaultHeroRules(key) {
  const rule = newTriggerRule();
  if (key === "hero_blue") return [rule, {
    ...newTriggerRule(), name: "越战越勇",
    trigger: { event: "heroBattleStart", scope: "any", radius: -1 },
    effects: [{ type: "stat", stat: "speed", mode: "add", value: 0.5, duration: "day" }],
  }];
  if (key === "hero_green") return [{
    ...rule, name: "并肩作战", target: { kind: "selfAndNearest", radius: -1, count: 1 },
    effects: [{ type: "stat", stat: "rate", mode: "add", value: 0.2, duration: "day" }],
  }];
  if (key === "hero_purple") return [{
    ...rule, name: "战意回响", target: { kind: "nearest", radius: -1, count: 1 },
    effects: [{ type: "triggerBattleStart" }],
  }];
  return [];
}
export function migrateHeroRules(c) {
  if (c?.version === 2 && c.cards && typeof c.cards === "object")
    for (const [key, card] of Object.entries(c.cards))
      if (card?.category === "hero" && card.triggerRules === undefined)
        card.triggerRules = defaultHeroRules(key);
  return c;
}
