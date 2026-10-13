import { triggerEvents, triggerScopes, triggerTargets, triggerEffects } from "./trigger-rules.js";
import { escapeHTML as esc, triggerStatLabels } from "./schema.js";
import { valueModes, statModes } from "../effect-values.js";
import { cardGenerationEditor } from "./card-generation-editor.js";

export function triggerRulesEditor(card, path, field, cards = {}) {
  const rules = card.triggerRules || [];
  const rows = rules.map((rule, i) => {
    const rp = `${path}.triggerRules.${i}`;
    const listener = rule.trigger.event === "heroBattleStart";
    const target = rule.target.kind;
    const effects = rule.effects.map((effect, j) => {
      const ep = `${rp}.effects.${j}`;
      let controls = "";
      if (effect.type === "generateCard") controls += cardGenerationEditor(effect, ep, cards, field);
      const lifeSteal = effect.type === "stat" && effect.stat === "lifeSteal";
      const percent = effect.valueMode === "percent" || (effect.type === "stat" && effect.mode === "percent");
      if (effect.type === "heal") controls += field("数值类型", ep + ".valueMode", { options: valueModes });
      if (effect.type === "stat") controls += field("属性", ep + ".stat", { options: triggerStatLabels })
        + field("计算方式", ep + ".mode", { options: statModes });
      if (!["triggerBattleStart", "generateCard"].includes(effect.type)) controls += field(percent ? "百分比（填 10 表示 10%）" : effect.mode === "multiply" ? "倍率（1.2 = +20%）" : lifeSteal ? "吸血率增加（0.1 = 10%）" : "数值", ep + ".value", {
        type: "number", min: effect.type === "heal" && percent ? .01 : effect.type === "level" || effect.type === "heal" ? 1 : effect.mode === "multiply" ? 0.05 : 0,
        max: percent ? effect.type === "heal" ? 100 : 10000 : effect.type === "level" ? 99 : effect.mode === "multiply" ? 10 : lifeSteal ? 0.95 : 100000,
        step: effect.type === "level" ? 1 : "any",
      });
      if (effect.type === "stat") controls += field("持续时间", ep + ".duration", { options: { day: "仅当前天", permanent: "永久保留" } });
      if (lifeSteal) controls += '<p class="hint">按实际伤害回复生命，与装备吸血叠加，最高 95%。倍率作用于已有吸血率，0% 乘倍率仍为 0%。</p>';
      if (effect.type === "heal" && percent) controls += '<p class="hint">按每个目标触发时的最大生命计算，不会超过最大生命。</p>';
      const select = `<select data-trigger-effect-type="${ep}" aria-label="后续效果">${Object.entries(triggerEffects).map(([key, spec]) => `<option value="${key}" ${key === effect.type ? "selected" : ""}>${spec.label}</option>`).join("")}</select>`;
      return `<div class="trigger-payload"><div class="effect-heading">${select}<button data-action="remove-trigger-effect" data-rule="${i}" data-index="${j}" class="icon-button" aria-label="移除后续效果">×</button></div><div class="fields">${controls || '<p class="hint">触发目标英雄的全部「开战」规则。同一次连锁中，每位英雄最多响应一次。</p>'}</div></div>`;
    }).join("");
    return `<div class="trigger-rule"><div class="effect-heading"><span class="effect-index">${i + 1}</span><label class="trigger-enable"><input type="checkbox" data-path="${rp}.enabled" ${rule.enabled ? "checked" : ""}>启用</label><button data-action="duplicate-trigger" data-index="${i}">复制</button><button data-action="trigger-up" data-index="${i}" ${i === 0 ? "disabled" : ""}>↑</button><button data-action="remove-trigger" data-index="${i}" class="icon-button" aria-label="移除触发规则">×</button></div>
      <div class="fields">${field("规则名称", rp + ".name")}${field("触发时机", rp + ".trigger.event", { options: triggerEvents })}${listener ? field("事件来源", rp + ".trigger.scope", { options: triggerScopes }) + field("监听距离（格，-1 为全场）", rp + ".trigger.radius", { type: "number", min: -1, max: 24, step: 1 }) : ""}
      ${field("作用目标", rp + ".target.kind", { options: triggerTargets })}${target !== "self" ? field("目标距离（格，-1 为全场）", rp + ".target.radius", { type: "number", min: -1, max: 24, step: 1 }) : ""}${["nearest", "selfAndNearest", "randomAllies"].includes(target) ? field(target === "randomAllies" ? "随机选取英雄数量（含自身）" : "最近英雄数量（不含自身）", rp + ".target.count", { type: "number", min: 1, max: 20, step: 1 }) : ""}</div>
      ${target === "randomAllies" ? '<p class="hint">每次触发随机选取指定数量的存活英雄，不重复；范围内人数不足时选取全部。同一规则的多个效果作用于同一组英雄。</p>' : ""}
      <div class="trigger-payloads">${effects}</div><div class="add-row"><select data-trigger-effect-choice="${rp}" aria-label="添加哪种效果">${Object.entries(triggerEffects).map(([key, spec]) => `<option value="${key}">${esc(spec.label)}</option>`).join("")}</select><button data-action="add-trigger-effect" data-index="${i}">＋ 添加后续效果</button></div></div>`;
  }).join("");
  return `<p class="hint">点击「迎战」触发一次；自动切换波次不会再次开战。距离按格子计算，同距离按英雄入场顺序选择。监听开战时，额外触发也会被计入；升级永久保留，属性加成按持续时间结算。</p>${rows || '<p class="hint">还没有触发规则。</p>'}<button data-action="add-trigger">＋ 新增触发规则</button><div class="trigger-presets"><span>快速添加</span><button data-trigger-template="growth">开战升级</button><button data-trigger-template="rally">自身与近邻加攻速</button><button data-trigger-template="echo">额外触发近邻</button><button data-trigger-template="momentum">响应开战加移速</button></div>`;
}
