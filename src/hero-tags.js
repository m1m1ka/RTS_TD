export const HERO_TAGS = { battleStart: "开战", preparation: "整备", sacrifice: "牺牲", parts: "零件", follower: "随从" };
export const DEFAULT_TAG_DESCRIPTIONS = {
  battleStart: "点击迎战时触发英雄的开战效果；同一天自动切换波次不会再次触发。",
  preparation: "迎战前部署英雄时触发，每位英雄每天一次；下一天重新部署后可再次触发。",
  sacrifice: "英雄死亡或被永久销毁时触发牺牲效果。具体效果以英雄描述为准。",
  parts: "零件是一种临时资源牌，可在空地上建造炮台；未使用的零件在本场战斗结束后清除。",
  follower: "英雄召唤的协战单位，会跟随所属英雄移动并自动攻击敌人。生命值和攻击力按召唤效果继承英雄属性，不拥有英雄的词条触发效果。",
};
export function inferHeroTags(card) {
  const rules = (card.triggerRules || []).filter(r => r.enabled);
  const effects = [...(card.effects || []), ...rules.flatMap(r => r.effects || [])];
  return Object.keys(HERO_TAGS).filter(tag => tag === "parts"
    ? effects.some(e => e.type === "generateCard" && e.pool === "selected" && e.cards?.includes("parts"))
    : tag === "follower" ? effects.some(e => e.type === "summonFollower")
      : rules.some(r => r.trigger?.event === tag));
}
export function migrateHeroTags(config) {
  if (config?.version !== 2 || !config.initial || !config.cards) return config;
  config.initial.heroTagDescriptions ??= { ...DEFAULT_TAG_DESCRIPTIONS };
  if (typeof config.initial.heroTagDescriptions === "object" && !Array.isArray(config.initial.heroTagDescriptions))
    for (const [tag, text] of Object.entries(DEFAULT_TAG_DESCRIPTIONS))
      config.initial.heroTagDescriptions[tag] ??= text;
  for (const card of Object.values(config.cards))
    if (card?.category === "hero") card.tags ??= inferHeroTags(card);
  return config;
}
