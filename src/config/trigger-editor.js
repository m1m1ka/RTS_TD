import { triggerEvents, triggerScopes, triggerTargets, triggerEffects, cardPlayCategories, randomStatLabels } from "./trigger-rules.js";
import { escapeHTML as esc, triggerStatLabels } from "./schema.js";
import { valueModes, statModes } from "../effect-values.js";
import { cardGenerationEditor } from "./card-generation-editor.js";

export function triggerRulesEditor(card, path, field, cards = {}) {
  const rules = card.triggerRules || [];
  const rows = rules.map((rule, i) => {
    const rp = `${path}.triggerRules.${i}`;
    const listener = ["heroBattleStart", "heroSacrifice"].includes(rule.trigger.event);
    const target = rule.target.kind;
    const effects = rule.effects.map((effect, j) => {
      const ep = `${rp}.effects.${j}`;
      let controls = "";
      if (effect.type === "refundCard") controls += field("返还概率（%）", ep + ".chance", { type: "number", min: 0, max: 100, step: "any" }) + '<p class="hint">成功使用资源牌或战斗牌后判定，返还原牌一张；每次用牌最多返还一张。返还不计为再次用牌，也不重复执行卡牌效果。</p>';
      if (effect.type === "randomStat") controls += Object.entries(randomStatLabels).map(([stat, label]) => field(label, ep + "." + stat, { type: "number", min: 0, max: ["lifeSteal", "critChance"].includes(stat) ? 100 : 100000, step: "any" })).join("") + '<p class="hint">五项属性等概率选中一项，每次只强化该项，永久保留。吸血、暴击率、暴击伤害填 1 表示增加 1 个百分点；基础暴击伤害 200%。生命强化增加上限，不额外治疗；吸血最高 95%，暴击率最高 100%。</p>';
      if (effect.type === "victoryGold") controls += field("额外金币数量", ep + ".value", {type:"number",min:1,max:999,step:1}) + '<p class="hint">搭配「胜利」触发，每次规则仅发放一次，不随目标数量翻倍。英雄必须活到胜利，金币在结算时从英雄位置弹出；可与固定胜利奖励和金矿奖励叠加。</p>';
      if (effect.type === "ownerLevel") controls += field("自身当前等级的百分比（%）", ep + ".percent", { type: "number", min: .01, max: 1000, step: "any" })
        + '<p class="hint">提升等级 = 触发此规则的英雄当前等级 × 比例，向下取整。例如 10 级、50% 提升 5 级；不足 1 级时不提升。炮台生命与攻击按照其自身等级成长公式计算。</p>';
      if (effect.type === "revive") controls += field("每位目标每天最多复活次数", ep + ".maxRevives", { type: "number", min: 1, max: 99, step: 1 })
        + field("复活生命（最大生命的 %）", ep + ".hpPercent", { type: "number", min: 1, max: 100, step: "any" })
        + '<p class="hint">牺牲时选择「自身」即可原地复活。其他目标选项会筛选阵亡英雄；格子被占时安置到最近空格。每位英雄的复活效果共用次数，换天重置，换波和保存配置不重置、不消耗此次数；波后不再自动复活。已存活或被永久销毁的英雄不会复活。</p>';
      if (effect.type === "generateCard") controls += cardGenerationEditor(effect, ep, cards, field);
      if (effect.type === "summonFollower") controls += field("生命比例（%）", ep + ".hpPercent", { type: "number", min: 1, max: 500, step: "any" })
        + field("攻击比例（%）", ep + ".atkPercent", { type: "number", min: 1, max: 500, step: "any" })
        + field("随从数量", ep + ".count", { type: "number", min: 1, max: 8, step: 1 })
        + '<p class="hint">在目标英雄相邻空格召唤小型分身，按召唤时的最大生命与攻击力计算，向上取整。继承外观、武器、攻速、射程与移速，延迟跟随和自动攻击，可在主人周围 3×3 格内手动移动；不继承装备特效、触发规则，不接受英雄牌效果。仅当前天有效；空格不足时只召唤可容纳数量，全场最多 32 个。</p>';
      const lifeSteal = effect.type === "stat" && effect.stat === "lifeSteal";
      const percent = effect.valueMode === "percent" || (effect.type === "stat" && effect.mode === "percent");
      if (effect.type === "heal") controls += field("数值类型", ep + ".valueMode", { options: valueModes });
      if (effect.type === "stat") controls += field("属性", ep + ".stat", { options: triggerStatLabels })
        + field("计算方式", ep + ".mode", { options: statModes });
      if (!["randomStat", "refundCard", "victoryGold", "ownerLevel", "revive", "triggerBattleStart", "triggerPreparation", "generateCard", "summonFollower"].includes(effect.type)) controls += field(percent ? "百分比（填 10 表示 10%）" : effect.mode === "multiply" ? "倍率（1.2 = +20%）" : lifeSteal ? "吸血率增加（0.1 = 10%）" : "数值", ep + ".value", {
        type: "number", min: effect.type === "heal" && percent ? .01 : effect.type === "level" || effect.type === "heal" ? 1 : effect.mode === "multiply" ? 0.05 : 0,
        max: percent ? effect.type === "heal" ? 100 : 10000 : effect.type === "level" ? 99 : effect.mode === "multiply" ? 10 : lifeSteal ? 0.95 : 100000,
        step: effect.type === "level" ? 1 : "any",
      });
      if (effect.type === "stat") controls += field("持续时间", ep + ".duration", { options: { day: "仅当前天", permanent: "永久保留" } });
      if (effect.type === "stat") controls += `<label class="trigger-enable"><input type="checkbox" data-path="${ep}.whileSourceAlive" ${effect.whileSourceAlive ? "checked" : ""}>英雄在场时生效</label><p class="hint">仅当施加此效果的英雄存活且在场时提供属性加成。来源死亡或离场立即失效，复活后恢复尚未到期的加成；其他英雄和装备提供的加成不受影响。治疗、升级、生成卡牌等即时效果不回滚。</p>`;
      if (lifeSteal) controls += '<p class="hint">按实际伤害回复生命，与装备吸血叠加，最高 95%。倍率作用于已有吸血率，0% 乘倍率仍为 0%。</p>';
      if (effect.type === "heal" && percent) controls += '<p class="hint">按每个目标触发时的最大生命计算，不会超过最大生命。</p>';
      if (effect.type === "triggerPreparation") controls += '<p class="hint">额外执行目标英雄全部已启用的「整备」规则，战斗中也可触发，不占用每日正常整备。同一次连锁中，每位英雄最多额外整备一次；没有整备规则的目标不产生效果。</p>';
      const select = `<select data-trigger-effect-type="${ep}" aria-label="后续效果">${Object.entries(triggerEffects).map(([key, spec]) => `<option value="${key}" ${key === effect.type ? "selected" : ""}>${spec.label}</option>`).join("")}</select>`;
      return `<div class="trigger-payload"><div class="effect-heading">${select}<button data-action="remove-trigger-effect" data-rule="${i}" data-index="${j}" class="icon-button" aria-label="移除后续效果">×</button></div><div class="fields">${controls || '<p class="hint">触发目标英雄的全部「开战」规则。同一次连锁中，每位英雄最多响应一次。</p>'}</div></div>`;
    }).join("");
    return `<div class="trigger-rule"><div class="effect-heading"><span class="effect-index">${i + 1}</span><label class="trigger-enable"><input type="checkbox" data-path="${rp}.enabled" ${rule.enabled ? "checked" : ""}>启用</label><button data-action="duplicate-trigger" data-index="${i}">复制</button><button data-action="trigger-up" data-index="${i}" ${i === 0 ? "disabled" : ""}>↑</button><button data-action="remove-trigger" data-index="${i}" class="icon-button" aria-label="移除触发规则">×</button></div>
      <div class="fields">${field("规则名称", rp + ".name")}${field("触发时机", rp + ".trigger.event", { options: triggerEvents })}${listener ? field("事件来源", rp + ".trigger.scope", { options: triggerScopes }) + field("监听距离（格，-1 为全场）", rp + ".trigger.radius", { type: "number", min: -1, max: 24, step: 1 }) : ""}
      ${rule.trigger.event === "interval" ? field("触发间隔（秒）", rp + ".trigger.interval", { type: "number", min: .1, max: 3600, step: "any" }) + '<p class="hint">点击迎战后开始累计；波间等待继续计时，换天重置。死亡停止生产并清空计时；复活或战斗中部署后重新累计。准备、商店与结算不生产。</p>' : ""}${rule.trigger.event === "towerBuilt" ? field("炮台建造监听距离（-1 为全场）", rp + ".trigger.radius", { type: "number", min: -1, max: 24, step: 1 }) + '<p class="hint">任意炮台资源牌成功建造后触发，包括零件。只有存活且在场的英雄响应；建造失败、已有炮台或更新配置不会触发。多个英雄的加成可以叠加。</p>' : ""}${field("作用目标", rp + ".target.kind", { options: Object.fromEntries(Object.entries(triggerTargets).filter(([key]) => key !== "eventTower" || rule.trigger.event === "towerBuilt")) })}${target !== "self" ? field("目标距离（格，-1 为全场）", rp + ".target.radius", { type: "number", min: -1, max: 24, step: 1 }) : ""}${["nearest", "selfAndNearest", "randomAllies"].includes(target) ? field(target === "randomAllies" ? "随机选取英雄数量（含自身）" : "最近英雄数量（不含自身）", rp + ".target.count", { type: "number", min: 1, max: 20, step: 1 }) : ""}</div>
      ${target === "randomAllies" ? '<p class="hint">每次触发随机选取指定数量的存活英雄，不重复；范围内人数不足时选取全部。同一规则的多个效果作用于同一组英雄。</p>' : ""}
      ${rule.trigger.event === "cardPlayed" ? `<div class="fields">${field("每使用几张牌触发", rp + ".trigger.every", { type: "number", min: 1, max: 999, step: 1 })}${field("计数的卡牌类型", rp + ".trigger.category", { options: cardPlayCategories })}</div><p class="hint">英雄在场且存活时计数，准备阶段与战斗中均有效；自身首次上场的牌不计数，重复英雄牌升级计数。无效出牌、购牌、生成与返还不计数。进度跨波次与关卡保留，死亡期间暂停；修改该规则后重新计数。</p>` : ""}
      ${target === "alliesWithFollowers" ? '<p class="hint">触发时选择范围内至少拥有一个存活随从的存活英雄，包含符合条件的自身。效果作用于英雄本人；随后随从死亡或移动不会重新筛选已施加的效果。</p>' : ""}
      ${rule.trigger.event === "heroSacrifice" ? '<p class="hint">某位英雄执行完本次已启用的「牺牲」规则后，存活的监听英雄响应一次；多条牺牲规则不会重复通知。若场上存在「所有英雄死亡视为牺牲触发」机制，没有启用牺牲规则的英雄死亡也会通知；随从死亡不通知。监听距离按牺牲发生的位置判断；「仅自身」需要先通过牺牲效果复活。「触发事件的英雄」指牺牲者，可配合复活效果救回尚未复活的英雄。</p>' : ""}
      ${rule.trigger.event === "sacrifice" ? '<p class="hint">自身每次死亡时触发一次，资源牌销毁英雄也会触发；随从死亡不触发主人规则。以死亡位置选择附近存活英雄。可给自身保留等级或属性效果，但治疗、升级附带回血不会复活自身；勾选「英雄在场时生效」的加成在来源死亡期间不生效。</p>' : ""}
      ${rule.trigger.event === "victory" ? '<p class="hint">仅本天最后一波获胜时触发一次，且自身必须在胜利瞬间存活。胜利结算保留当前状态；进入下一天时才复活、回血并清理当天增益；中途换波、失败、商店不会触发。跨天成长请选择永久属性加成或提升等级。</p>' : ""}
      <div class="trigger-payloads">${effects}</div><div class="add-row"><select data-trigger-effect-choice="${rp}" aria-label="添加哪种效果">${Object.entries(triggerEffects).map(([key, spec]) => `<option value="${key}">${esc(spec.label)}</option>`).join("")}</select><button data-action="add-trigger-effect" data-index="${i}">＋ 添加后续效果</button></div></div>`;
  }).join("");
  return `<p class="hint">整备：开战前部署英雄时触发；跨天保留的英雄进入下一战斗关卡时各触发一次。开战后上场不触发整备，移动、复活和保存配置不会重复触发。</p><p class="hint">点击「迎战」触发一次；自动切换波次不会再次开战。距离按格子计算，同距离按英雄入场顺序选择。监听开战时，额外触发也会被计入；升级永久保留，属性加成按持续时间结算。</p>${rows || '<p class="hint">还没有触发规则。</p>'}<button data-action="add-trigger">＋ 新增触发规则</button><div class="trigger-presets"><span>快速添加</span><button data-trigger-template="fiveCards">每 5 张牌获得随机牌</button><button data-trigger-template="cardGrowth">用牌随机永久强化</button><button data-trigger-template="cardRefund">资源／战斗牌概率返还</button><button data-trigger-template="victoryGold">胜利奖金</button><button data-trigger-template="parts">定时生产零件</button><button data-trigger-template="engineering">建造炮台升级</button><button data-trigger-template="preparation">整备召唤随从</button><button data-trigger-template="growth">开战升级</button><button data-trigger-template="rally">自身与近邻加攻速</button><button data-trigger-template="echo">额外触发近邻</button><button data-trigger-template="momentum">响应开战加移速</button></div>`;
}
