import { generationCategories } from "../card-generation.js";
import { escapeHTML as esc } from "./schema.js";
export function cardGenerationEditor(effect, path, cards, field) {
  return field("生成来源", path + ".pool", { options: { category: "按卡牌类型随机", selected: "指定候选卡牌" } })
    + (effect.pool === "selected"
      ? `<div class="field wide"><span>候选卡牌（只选一张即固定生成）</span><div class="generation-candidates">${Object.entries(cards).map(([key, card]) => `<label><input type="checkbox" data-generation-path="${path}" data-generation-card="${key}" ${(effect.cards || []).includes(key) ? "checked" : ""}>${esc(card.name)} <small>${generationCategories[card.category]}</small></label>`).join("")}</div></div>`
      : field("卡牌类型", path + ".category", { options: generationCategories }))
    + field("生成张数", path + ".count", { type: "number", min: 1, max: 99, step: 1 })
    + '<p class="hint">每次触发／使用此效果生成一次，直接加入手牌，不随作用目标数量翻倍。每张独立等概率抽取，可重复；生成的牌不会自动使用。候选池为空时不生成。</p>';
}
