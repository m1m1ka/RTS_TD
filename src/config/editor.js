import { RouteGraphEditor } from "./route-editor.js";
import { defaultSkillTiers, skillEffectText } from "../skill-cards.js";
import { DEFAULT_HERO_RANK_LEVELS, isRankValuePath } from "../hero-ranks.js";
import "../retro-theme.css";
import { heroRarityClass, heroRoleLabel, heroGradeLabel, heroRarities, heroRoles, heroStatFields, applyHeroStatPreset, syncHeroStatPresets } from "../hero-grades.js";
import { copyMapLayout, mapLayoutErrors, applyMapPreset } from "../map-presets.js";
import "./editor.css";
import "../cards.css";
import { workshopRules } from "./workshop-content.js";
import { mechanicsEditor, enemyMechanicsEditor } from "./mechanics-editor.js";
import { combatBehaviors, healingTargets } from "../healing-behavior.js";
import {
  getConfig,
  saveConfig,
  savesToProject,
  subscribeConfig,
  configLoadError,
} from "./store.js";
import { migrateConfig, waveCount } from "./migrate.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import {
  clone,
  validateConfig,
  escapeHTML as esc,
  effectTypes,
  statLabels,
  weaponOptions,
  builtInIcons,
} from "./schema.js";
import { iconURL } from "./icons.js";
import { attackModuleOptions, damagingModuleOptions, selectAttackModule } from "../attack-modules.js";
import { obstacleKeys } from "../terrain.js";
import { TerrainEditor } from "./terrain-editor.js";
import { nextDayIds, materializeRoutes } from "../campaign.js";
import { routeGraph } from "../route-map.js";
import { triggerRulesEditor } from "./trigger-editor.js";
import { newTriggerRule, defaultHeroRules, triggerEffects, cardPlayRules } from "./trigger-rules.js";
import { levelStats } from "../level-stats.js";
import { heroPresets, lookLabel, createPresetCard, presetById } from "../hero-presets.js";
import { pirateLooks, piratePresets } from "../marine-content.js";
import { valueModes, statModes } from "../effect-values.js";
import { cardGenerationEditor } from "./card-generation-editor.js";
import { setGenerationCandidates, pruneGenerationCandidates } from "../card-generation.js";
import { economySettings } from "../economy.js";
import { HERO_TAGS, inferHeroTags } from "../hero-tags.js";
import { RESOURCE_CARDS } from "../resource-effects.js";

const $ = (id) => document.getElementById(id),
  types = {
    hero: "英雄牌",
    resource: "资源牌",
    battle: "战斗牌",
    equipment: "装备牌",
  };
let draft = clone(getConfig()),
  dirty = false,
  conflict = false,
  saving = false,
  section = "cards",
  category = "hero",
  selected = "hero_blue",
  waveSelected = 0;
const routeEditor = new RouteGraphEditor($("editor"), () => draft, markDirty, render, message);
const get = (path) => path.split(".").reduce((v, k) => v?.[k], draft);
function set(path, value) {
  const parts = path.split("."),
    key = parts.pop();
  let object = draft;
  for (const p of parts) object = object[p];
  object[key] = value;
  markDirty();
}
function markDirty() {
  dirty = true;
  $("save-state").textContent = "● 未保存";
  $("save-state").className = "dirty";
}
function message(text, error = false) {
  $("config-message").hidden = !text;
  $("config-message").textContent = text;
  $("config-message").className = error ? "error" : "success";
}
const terrainEditor = new TerrainEditor($("editor"), () => section === "waves" ? draft.days[selected] : section === "maps" ? draft.mapPresets[selected] : null, markDirty);
function field(
  label,
  path,
  {
    type = "text",
    min = 0,
    max = 1000000,
    step = "any",
    options,
    wide = false,
    disabled = false,
  } = {},
) {
  const value = get(path) ?? "";
  let input = options
    ? `<select data-path="${path}">${Object.entries(options)
        .map(
          ([v, t]) =>
            `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`,
        )
        .join("")}</select>`
    : type === "textarea"
      ? `<textarea data-path="${path}" rows="2" maxlength="180">${esc(value)}</textarea>`
      : `<input data-path="${path}" type="${type}" value="${esc(value)}" ${disabled ? "disabled" : ""} ${type === "number" ? `min="${min}" max="${max}" step="${step}"` : 'maxlength="80"'}>`;
  const parts = path.split("."), card = parts[0] === "cards" && draft.cards[parts[1]];
  const ranked = type === "number" && card?.category === "hero" && isRankValuePath(parts.slice(2).join("."));
  const base = `<label class="field ${wide ? "wide" : ""}"><span>${esc(label)}${ranked ? " · 0 阶" : ""}</span>${input}</label>`;
  if (!ranked) return base;
  const key = parts.pop(), owner = get(parts.join("."));
  return `<div class="rank-field ${wide ? "wide" : ""}">${base}<details class="rank-values" open><summary>1～3 阶数值</summary><div>${[1, 2, 3].map(rank =>
    `<label class="field"><span>${rank} 阶</span><input type="number" data-rank-value="${path}" data-rank-index="${rank}" aria-label="${esc(label)} ${rank} 阶" value="${owner?.rankValues?.[rank]?.[key] ?? ""}" placeholder="${value}" title="留空沿用 0 阶数值" min="${min}" max="${max}" step="${step}"></label>`).join("")}</div></details></div>`;
}
function heroRankEditor(card) {
  card.rankDescriptions ??= {};
  card.rankLevels ??= [...DEFAULT_HERO_RANK_LEVELS];
  return panel("英雄升阶 · 0 → 3 阶", `${[0,1,2,3].map(rank => field(`${rank} 阶描述（留空使用基本描述）`, `cards.${selected}.rankDescriptions.${rank}`, {type:"textarea",wide:true})).join("")}<p class="hint">初始为 0 阶，等级达到下方门槛自动升阶，最高 3 阶。门槛须递增；阶数随当前等级计算，交换或失去等级后也会重新计算。</p><div class="fields">${[1, 2, 3].map(rank => field(`达到 ${rank} 阶所需等级`, `cards.${selected}.rankLevels.${rank - 1}`, { type: "number", min: 2, max: 9999, step: 1 })).join("")}</div><p class="hint">在下方效果、触发机制、治疗及特殊机制的数字旁分别填写 1～3 阶数值；留空沿用 0 阶。各阶填写最终值，互不叠加。常驻效果升阶后立即更新；已触发的永久／当天增益保留原值，下次触发使用新阶数。升阶不会额外触发整备、开战或补发奖励。</p>`);
}
function unitFields(path) {
  const hero = path.startsWith("cards.") && draft.cards[path.split(".")[1]]?.category === "hero";
  const healing = hero && get(path + ".combatBehavior") === "heal";
  const behavior = hero ? `<div class="fields">${field("战斗行为", path + ".combatBehavior", { options: combatBehaviors })}${healing ? field("治疗对象", path + ".healing.targets", { options: healingTargets }) + field("治疗量类型", path + ".healing.valueMode", { options: { fixed: "固定生命值", percent: "目标最大生命值百分比" } }) + field(get(path + ".healing.valueMode") === "percent" ? "每次治疗（最大生命的 %）" : "每次治疗生命值", path + ".healing.value", { type: "number", min: get(path + ".healing.valueMode") === "percent" ? .01 : 1, max: get(path + ".healing.valueMode") === "percent" ? 100 : 100000, step: "any" }) : ""}</div>${healing ? '<p class="hint">战斗中全图寻找最近的受伤队友，走入治疗距离后自动治疗。斜角为 1 格；不治疗自身、阵亡单位、核心或金矿，不攻击敌人。治疗不暴击，最多回到满血。手动移动优先，到达后重新选择目标。治疗速度、距离使用原攻速和射程属性，增益与装备仍有效。</p>' : ""}` : "";
  return `${behavior}${hero ? mechanicsEditor(get(path),path,field) : path.startsWith("enemies.") ? enemyMechanicsEditor(get(path),path,field) : ""}<p class="hint">攻击模组决定攻击动作、武器与弹道；选择治疗模组会自动治疗受伤友军，目标显示绿色光环与十字特效。外观由「实际使用 icon」配置，装备可覆盖武器。</p><div class="fields">${field("攻击模组", path + ".attackModule", { options: hero ? attackModuleOptions : damagingModuleOptions })}${Object.entries(
    statLabels,
  )
    .map(([k, t]) =>
      field(healing && k === "rate" ? "治疗速度（次/秒）" : healing && k === "range" ? "治疗距离（格）" : ["maxHp", "atk"].includes(k) ? t + "（1 级基础值）" : t, path + "." + k, {
        type: "number",
        min: ["rate", "speed"].includes(k) ? 0.05 : k === "maxHp" ? 1 : 0,
        max: k === "critChance" ? 100 : ["rate", "speed"].includes(k) ? 20 : k === "range" ? 24 : 1000000,
        step: k === "range" ? 1 : "any",
      }),
    )
    .join("")}</div><div class="level-growth"><h4>等级成长 · 一次函数</h4><p class="hint">属性 = 1 级基础值 + 每级增量 ×（等级 − 1）。装备和其他增益在此基础上计算。</p><div class="fields">${field("生命值每级增加", path + ".levelGrowth.maxHp", { type: "number", max: 100000, step: "any" })}${field("攻击力每级增加", path + ".levelGrowth.atk", { type: "number", max: 100000, step: "any" })}</div><div data-growth-preview="${path}">${growthPreview(path)}</div></div>`;
}
function growthPreview(path) {
  const unit = get(path);
  const number = (value) => Number.isFinite(value) ? String(Number(value.toFixed(2))) : "—";
  return `<p class="growth-formula">生命 = ${number(unit.maxHp)} + ${number(unit.levelGrowth?.maxHp ?? 0)} ×（等级 − 1）<br>攻击 = ${number(unit.atk)} + ${number(unit.levelGrowth?.atk ?? 0)} ×（等级 − 1）</p><table class="growth-preview"><thead><tr><th>等级</th><th>生命值</th><th>攻击力</th></tr></thead><tbody>${[1, 5, 10].map((level) => {
    const stats = levelStats(unit, level);
    return `<tr><td>Lv.${level}</td><td>${number(stats.maxHp)}</td><td>${number(stats.atk)}</td></tr>`;
  }).join("")}</tbody></table>`;
}
function iconEditor(label, path, hint) {
  const value = get(path);
  return `<div class="icon-editor"><img src="${iconURL(value, true)}" alt="${esc(label)}"><div><b>${esc(label)}</b><small>${esc(hint)}</small><select data-icon-select="${path}"><option value="" ${!builtInIcons.includes(value) ? "selected" : ""} disabled>上传的图片</option>${builtInIcons.map((k) => `<option value="${k}" ${k === value ? "selected" : ""}>${esc(RESOURCE_CARDS[k]?.name || lookLabel(k))}</option>`).join("")}</select><label class="upload">上传图片<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${path}" hidden></label></div></div>`;
}
function panel(title, body, aside = "") {
  return `<section class="editor-panel"><div class="panel-title"><h3>${title}</h3>${aside}</div>${body}</section>`;
}
function presetLibrary() {
  const group = (title, presets) => `<h4 class="hero-preset-title">${title}</h4><div class="hero-preset-grid">${presets.map(p => `<button type="button" data-hero-preset="${p.id}" title="以${p.name}为模板创建可编辑的英雄牌"><img src="${iconURL(p.id, true)}" alt="${p.name}" draggable="false"><strong>${p.name}</strong><small>${p.role}</small></button>`).join("")}</div>`;
  return `<details class="hero-preset-library"><summary>英雄形象图鉴 <small>${heroPresets.length} 个预设 · 点击创建英雄牌</small></summary>${group("齿轮工坊", heroPresets.filter(p => p.theme === "workshop"))}${group("血誓与狂怒", heroPresets.filter(p => p.theme === "blood"))}${group("中世纪军团", heroPresets.filter(p => p.theme === "medieval"))}${group("林地冒险者", heroPresets.filter(p => !p.theme))}</details>`;
}
function inventory(path) {
  const value = get(path);
  const label = path.startsWith("rewardPools.") ? "权重" : "数量";
  return `<div class="inventory">${Object.entries(value)
    .map(
      ([key, n]) =>
        `<div class="inventory-row"><img src="${iconURL(draft.cards[key]?.icon, true)}" alt=""><span>${esc(draft.cards[key]?.name || key)}</span><input type="number" min="0" max="999" step="1" value="${n}" aria-label="${esc(draft.cards[key]?.name)}${label}" data-path="${path}.${key}"><button class="icon-button" data-action="remove-inventory" data-path-value="${path}" data-key="${key}" title="移除">×</button></div>`,
    )
    .join(
      "",
    )}</div><div class="add-row"><select data-inventory-choice="${path}">${Object.keys(
    draft.cards,
  )
    .filter((k) => !(k in value))
    .map(
      (k) =>
        `<option value="${k}">${esc(draft.cards[k].name)} · ${types[draft.cards[k].category]}</option>`,
    )
    .join(
      "",
    )}</select><button data-action="add-inventory" data-path-value="${path}">＋ 添加卡牌</button></div>`;
}
function effectsEditor(card, path) {
  return `<div class="effect-list">${
    card.effects
      .map((effect, i) => {
        const ep = path + ".effects." + i;
        let controls = "";
        if (effect.type === "battleStart") controls += '<p class="hint">立即触发目标英雄的一次开战，并通知相关监听规则；不会开始新一天或重置波次。</p>';
        if (effect.type === "sacrifice") controls += '<p class="hint">永久销毁目标及其装备，将全部等级随机转赠范围内另一位存活英雄。</p>';
        if (effect.type === "drainLevels") controls += field("总吸取上限（级）", ep + ".limit", { type: "number", min: 1, max: 999, step: 1 }) + field("每位英雄最多贡献（级）", ep + ".perHero", { type: "number", min: 1, max: 999, step: 1 }) + '<p class="hint">按距离从近到远吸取，捐出者至少保留 1 级。</p>';
        if (effect.type === "generateCard") controls += cardGenerationEditor(effect, ep, draft.cards, field);
        const percent = effect.valueMode === "percent" || (effect.type === "stat" && effect.mode === "percent");
        if (["heal", "damage"].includes(effect.type)) controls += field("数值类型", ep + ".valueMode", { options: valueModes });
        if (effect.type === "stat")
          controls +=
            field("属性", ep + ".stat", { options: statLabels }) +
            field("计算方式", ep + ".mode", {
              options: statModes,
            });
        if (effect.type === "weapon")
          controls +=
            field("武器", ep + ".weapon", { options: weaponOptions }) +
            field("最小射程", ep + ".range", {
              type: "number",
              max: 24,
              step: 1,
            });
        if ("value" in effect)
          controls += field(
            percent ? "百分比（填 10 表示 10%）" : ["slow", "lifesteal", "mitigation", "splash"].includes(effect.type)
              ? "比例（0.25 = 25%）"
              : effect.type === "stat" && effect.mode === "multiply"
                ? "倍率（1.25 = +25%）"
                : "数值",
            ep + ".value",
            {
              type: "number",
              min: percent && ["heal", "damage"].includes(effect.type) ? .01 : 0,
              max: percent ? ["heal", "damage"].includes(effect.type) ? 100 : 10000 : 100000,
              step: effect.type === "level" ? 1 : "any",
            },
          );
        if ("radius" in effect)
          controls += field(["swapLevels", "sacrifice", "drainLevels"].includes(effect.type) ? "作用半径（格，-1 为全场）" : "作用半径（格）", ep + ".radius", {
            type: "number",
            min: ["swapLevels", "sacrifice", "drainLevels"].includes(effect.type) ? -1 : 0,
            max: 24,
            step: 1,
          });
        if ("duration" in effect)
          controls += field("持续秒数", ep + ".duration", {
            type: "number",
            min: 0.1,
            max: 120,
          });
        return `<div class="effect-row"><div class="effect-heading"><span class="effect-index">${i + 1}</span><select data-effect-type="${ep}">${Object.entries(
          effectTypes,
        )
          .filter(([, spec]) => spec.categories.includes(card.category))
          .map(
            ([k, spec]) =>
              `<option value="${k}" ${k === effect.type ? "selected" : ""}>${spec.label}</option>`,
          )
          .join(
            "",
          )}</select><button class="icon-button" data-action="effect-up" data-effect-owner="${path}" data-index="${i}" ${i === 0 ? "disabled" : ""} title="上移效果">↑</button><button class="icon-button" data-action="remove-effect" data-effect-owner="${path}" data-index="${i}" title="移除效果">×</button></div><div class="fields">${controls || '<p class="hint">使用下方的炮台属性放置一个单位。</p>'}</div></div>`;
      })
      .join("") || '<p class="hint">英雄基础属性之外，可叠加额外效果。</p>'
  }</div><div class="add-row"><select id="${path.includes(".skillTiers.") ? "new-effect-" + path : "new-effect"}" data-effect-choice="${path}">${Object.entries(
    effectTypes,
  )
    .filter(([, spec]) => spec.categories.includes(card.category))
    .map(([k, spec]) => `<option value="${k}">${spec.label}</option>`)
    .join(
      "",
    )}</select><button data-action="add-effect" data-effect-owner="${path}">＋ 叠加效果</button></div>`;
}
function skillEditor(card) {
  const path = "cards." + selected;
  return panel("技能冷却与合成", '<p class="hint">每张战斗牌独立冷却，不会消耗。商店中 3 张同名同阶牌合成下一阶；所有阶级的数值独立设置。合成保留材料最长的剩余冷却。</p>' +
    field("1 阶冷却（秒）", path + ".cooldown", { type: "number", min: .1, max: 3600, step: .1 }) +
    card.skillTiers.map((tier, i) => {
      const tp = path + ".skillTiers." + i;
      return panel(`${i + 2} 阶技能`, field("冷却（秒）", tp + ".cooldown", { type: "number", min: .1, max: 3600, step: .1 }) +
        effectsEditor({ ...card, effects: tier.effects }, tp) + `<p class="hint">预览：${esc(skillEffectText(tier))}</p>`);
    }).join("") + `<div class="add-row"><button data-action="add-skill-tier" ${card.skillTiers.length >= 9 ? "disabled" : ""}>＋ 新增阶级</button><button data-action="remove-skill-tier" ${!card.skillTiers.length ? "disabled" : ""}>移除最高阶</button></div>`);
}
function preview(card) {
  return `<div class="preview-sticky"><div class="nav-caption">卡面预览</div><div class="hand-card ${card.category} ${heroRarityClass(card)} config-preview">${["hero", "battle"].includes(card.category) ? "" : '<b class="card-count">×1</b>'}<strong class="card-title">${esc(card.name)}</strong><div class="card-picture">${card.category === "hero" ? '<b class="hero-card-level">Lv.1</b>' : ""}<img src="${iconURL(card.icon, true)}" alt=""></div><span class="card-kind">${heroRoleLabel(card) || types[card.category]}${card.temporary ? " · 临时" : ""}</span><small class="card-description">${esc(card.text).replace(/ · /g, "<br>")}</small><span class="card-flourish">◆</span></div><small>属性效果按列表顺序叠加，等级成长先计入基础属性。描述为独立展示文本。</small><div class="actual-preview"><img src="${iconURL(card.useIcon)}" alt="使用图标"><span>实际使用图标</span></div></div>`;
}
function entityList(items, kind) {
  const depths = kind === "day" ? new Map(routeEditor.options().layoutOverride.nodes.map((node) => [node.day.id, node.depth + 1])) : null;
  return `<aside class="entity-list"><div class="entity-toolbar"><span>${items.length} 项</span><button data-action="add-${kind}">＋ 新增</button></div>${items.map(([key, item], i) => `<button class="entity ${String(selected) === String(key) ? "active" : ""}" data-select="${key}">${kind !== "day" ? `<img src="${iconURL(item.icon || item.useIcon, true)}" alt="">` : `<b class="wave-number">${depths.get(item.id)}</b>`}<span>${esc(item.name)}<small>${kind === "day" ? (item.kind === "shop" ? "商店" : `${item.waves.length} 波 · ${item.waves.reduce((n, w) => n + waveCount(w), 0)} 名敌人`) : esc(key)}</small></span></button>`).join("")}</aside>`;
}
function renderCards() {
  const items = Object.entries(draft.cards).filter(
    ([, c]) => c.category === category,
  );
  if (!items.some(([k]) => k === selected)) selected = items[0]?.[0];
  const card = draft.cards[selected];
  return `${category === "hero" ? presetLibrary() : ""}<div class="category-tabs">${Object.entries(types)
    .map(
      ([k, t]) =>
        `<button data-category="${k}" class="${category === k ? "active" : ""}">${t}</button>`,
    )
    .join(
      "",
    )}</div><div class="editor-columns">${entityList(items, "card")}${card ? `<div class="entity-form"><div class="entity-title"><h2>${esc(card.name)}</h2><div><button data-action="duplicate-card">复制</button><button data-action="delete-card" class="danger">删除</button></div></div>${panel("基本信息", `<div class="fields">${field("名字", "cards." + selected + ".name")}${field("使用目标", "cards." + selected + ".target", { options: { hero: { ground: "空地" }, resource: { any: "\u6218\u573a\u4efb\u610f\u4f4d\u7f6e", hero: "我方英雄", ground: "空地（放置炮台）" }, battle: { area: "范围位置", enemy: "敌方单位", hero: "我方英雄（治疗）" }, equipment: { hero: "我方英雄" } }[category] })}${field("描述", "cards." + selected + ".text", { type: "textarea", wide: true })}<label class="trigger-enable"><input type="checkbox" data-path="cards.${selected}.temporary" ${card.temporary ? "checked" : ""}>临时牌（本场战斗结束清除）</label></div><div class="icon-pair">${iconEditor("卡牌 icon", "cards." + selected + ".icon", "显示在手牌与奖励牌上")}${iconEditor("实际使用 icon", "cards." + selected + ".useIcon", "单位外观 / 装备标记 / 施放图标")}</div>`)}${category === "hero" ? heroGradeEditor(card) + heroTagsEditor(card) + heroRankEditor(card) + panel("英雄属性", unitFields("cards." + selected + ".unit")) : ""}${category === "battle" ? panel("战斗表现", field("施法特效", "cards." + selected + ".visual", { options: { fireball: "火球爆环", lightning: "落雷", frost: "寒霜" } })) : ""}${panel(category === "battle" ? "1 阶效果" : "组合效果", effectsEditor(card, "cards." + selected))}${category === "battle" ? skillEditor(card) : ""}${card.effects.some((e) => e.type === "summon") ? panel("炮台属性", unitFields("cards." + selected + ".unit")) : ""}</div><aside id="card-preview">${preview(card)}</aside>` : '<div class="empty-editor">该分类暂无卡牌，点击新增开始配置。</div>'}</div>`;
}
function heroGradeEditor(card) {
  const path = "cards." + selected;
  return panel("英雄品质与定位", `<div class="fields">${field("品质", path + ".rarity", { options: heroRarities })}${field("定位", path + ".role", { options: heroRoles })}${field("数值来源", path + ".statSource", { options: { preset: "跟随品质与定位预设", custom: "单独配置" } })}</div><p class="hint">选择品质或定位会自动套用对应预设，覆盖基础属性与等级成长；外观、攻击模组、治疗行为和技能保持不变。预设可在「初始默认」中修改。套用后可直接微调基础属性与成长值；修改任一预设参数会自动切换为「单独配置」，保留其余已填入数值。重新选择「跟随品质与定位预设」可再次套用。</p>`);
}
function heroPresetsEditor() {
  return panel("英雄基础数值预设", `<p class="hint">按品质与定位设置 1 级基础属性和每级成长。修改后会同步到所有选择「跟随品质与定位预设」的英雄，保存后生效；单独配置的英雄不受影响。</p><div class="hero-stat-presets">${Object.entries(heroRarities).map(([rarity, label]) => `<details class="hero-stat-tier rarity-${rarity}" ${rarity === "common" ? "open" : ""}><summary>${label}<small>5 种定位</small></summary>${Object.entries(heroRoles).map(([role, title]) => `<section class="hero-role-preset"><h4>${label} · ${title}</h4><div class="fields">${Object.entries(heroStatFields).map(([key, spec]) => field(spec.label, `initial.heroStatPresets.${rarity}.${role}.${key}`, { type: "number", ...spec })).join("")}</div></section>`).join("")}</details>`).join("")}</div>`);
}
function renderInitial() {
  return `<div class="entity-title"><h2>初始默认配置</h2><span class="hint">每次开局的规则</span></div><div class="initial-layout"><div>${panel("核心与换天恢复", `<div class="fields">${field("每天第一波开始等待（秒）", "initial.firstWaveDelay", { type: "number", max: 3600 })}${field("核心初始生命", "initial.baseHp", { type: "number", min: 1 })}${field("返场英雄复活血量比例", "initial.reviveHp", { type: "number", min: 0.01, max: 1 })}</div><p class="hint">每波结束不会自动复活、回血或清除当天状态；进入下一天时英雄复活并恢复满血、清除当天临时加成。治疗与复活技能照常生效。</p>`)}${panel("海盗乘船登岸", `<div class="fields">${field("船航行速度（格 / 秒）", "initial.boatSpeed", { type: "number", min: .1, max: 20, step: .1 })}${field("登岸击退距离（格）", "initial.landingKnockback", { type: "number", min: 0, max: 10, step: 1 })}</div><p class="hint">每个出生点的一批敌人同乘一艘船，船宽 1 格、长 4 格，沿航向设 4 个站位；超过 4 人时在站位上站肩叠起。出生延迟控制启航时间，逐个出兵间隔控制登岸间隔。船上可按格子距离交战；可从正前方及沿岸两侧各一格登岸，优先正前方，有英雄时先击退；正前方无法使用时再尝试两侧空位或击退挡路英雄，遇障碍停止；三格都无法登陆时留船交战。0 格关闭击退；内陆出生点投影到最近的可达海岸。保存后立即生效。</p>`)}${panel(
    "通用升级规则",
    `<div class="fields">${Object.entries({
      heal: "升级恢复生命",
    })
      .map(([k, t]) => field(t, "initial.levelGrowth." + k, { type: "number" }))
      .join("")}</div><p class="hint">生命值与攻击力的等级公式在各英雄、敌人的属性中分别配置。</p>`,
  )}</div>${panel("初始手牌", inventory("initial.cards"))}</div>${economyEditor()}${tagDescriptionsEditor()}${heroPresetsEditor()}`;
}
function economyEditor() {
  const labels = {
    commonHeroSellPrice: "普通英雄出售价格", rareHeroSellPrice: "稀有英雄出售价格", epicHeroSellPrice: "史诗英雄出售价格",
    battleSellPrice: "战斗牌出售价格", resourceSellPrice: "资源牌出售价格", equipmentSellPrice: "装备牌出售价格",
    commonHeroPrice: "普通英雄价格", rareHeroPrice: "稀有英雄价格", epicHeroPrice: "史诗英雄价格",
    heroPackPrice: "英雄卡包价格", resourcePackPrice: "资源卡包价格", equipmentPackPrice: "装备卡包价格",
    refreshCost: "首次刷新费用", refreshIncrease: "每次刷新额外增加费用",
    mineGold: "每座存活金矿的胜利金币", victoryGold: "每场胜利固定金币",
  };
  return panel("商店与金币收益", `<div class="fields">${Object.entries(labels).map(([key, label]) =>
    field(label + "（金币）", `initial.economy.${key}`, { type: "number", min: 0, max: 999, step: 1 })).join("")}</div>
    <p class="hint">刷新费用 = 首次费用 + 本店已成功刷新次数 × 递增费用。进入下一家商店重置次数；递增为 0 时不涨价。每场战斗关卡最后一波获胜后发放固定金币，再按存活金矿数量追加收益；中途换波、失败与商店不发放。金币数量可设为 0。商店节点默认使用这里的价格，也可单独覆盖。</p>`);
}
function heroTagsEditor(card) {
  card.tags ??= inferHeroTags(card);
  return panel("英雄词条", `<div class="fields">${Object.entries(HERO_TAGS).map(([tag, label]) =>
    `<label class="trigger-enable"><input type="checkbox" data-hero-tag="${tag}" ${card.tags.includes(tag) ? "checked" : ""}>${label}</label>`).join("")}</div><p class="hint">玩家悬停此英雄卡牌时显示勾选词条的说明。词条只用于解释，不会添加或改变英雄效果；文案在「初始默认 → 英雄词条说明」中统一配置。</p>`);
}
function tagDescriptionsEditor() {
  return panel("英雄词条说明", `<p class="hint">悬停英雄卡牌时，在卡牌上方显示半透明黑底白字说明。仅显示该英雄勾选的词条；每项最多 180 字。</p><div class="fields">${Object.entries(HERO_TAGS).map(([tag, label]) => field(label + "说明", `initial.heroTagDescriptions.${tag}`, { type: "textarea", wide: true })).join("")}</div>`);
}
function renderEnemies() {
  const items = Object.entries(draft.enemies);
  if (!draft.enemies[selected]) selected = items[0]?.[0];
  const enemy = draft.enemies[selected];
  const library = `<details class="hero-preset-library"><summary>海盗形象图鉴 <small>6 种预设 · 点击创建敌方单位</small></summary><div class="hero-preset-grid">${Object.entries(pirateLooks).map(([id, name]) => `<button type="button" data-enemy-preset="${id}"><img src="${iconURL(id, true)}" alt="${name}" draggable="false"><strong>${name}</strong><small>创建可编辑预设</small></button>`).join("")}</div></details>`;
  return `${library}<div class="editor-columns two">${entityList(items, "enemy")}<div class="entity-form"><div class="entity-title"><h2>${esc(enemy.name)}</h2><div><button data-action="duplicate-enemy">复制</button><button data-action="delete-enemy" class="danger">删除</button></div></div>${panel("敌方单位", field("名字", "enemies." + selected + ".name") + field("敌人类型描述（登陆预告）", "enemies." + selected + ".description", { type: "textarea", wide: true }) + iconEditor("单位 icon", "enemies." + selected + ".useIcon", "战场中的实际外观") + unitFields("enemies." + selected))}<p class="hint">波次中的生命与攻击倍率会叠加到这里的基础数值上。</p></div></div>`;
}
function spawnGrid(w) {
  const obstacles = obstacleKeys(draft.days[selected]);
  for (const mine of draft.days[selected].mines || []) obstacles.add(`${mine.x},${mine.y}`);
  return `<div class="grid-legend"><span>点击切换出生点</span><span>✦ 核心　■ 障碍　● 出生点</span></div><div class="spawn-grid">${Array.from(
    { length: 165 },
    (_, i) => {
      const x = i % 15,
        y = Math.floor(i / 15),
        blocked = obstacles.has(x + "," + y),
        base = x === 7 && y === 5,
        active = w.spawns.some((p) => p.x === x && p.y === y);
      return `<button data-spawn="${x},${y}" class="${blocked ? "blocked" : base ? "core" : active ? "spawn" : ""}" ${blocked || base ? "disabled" : ""} title="X ${x}, Y ${y}" aria-label="出生点 ${x},${y}" aria-pressed="${active}">${base ? "✦" : active ? "●" : x === 0 || y === 0 ? `${x},${y}` : ""}</button>`;
    },
  ).join(
    "",
  )}</div><div class="spawn-coordinates">${w.spawns.map((p) => `<span>(${p.x}, ${p.y})</span>`).join("")}</div>`;
}
function mapPresetPicker() {
  return `<div class="map-preset-controls"><label class="field"><span>套用地图预设</span><select data-map-preset><option value="">选择预设，替换当前地图</option>${Object.entries(draft.mapPresets).map(([id, preset]) => `<option value="${esc(id)}">${esc(preset.name)} · ${preset.obstacles.length} 树木 / ${preset.mines.length} 金矿</option>`).join("")}</select></label><button type="button" data-action="capture-map">将当前地图存为预设</button></div><p class="hint">套用树木、金矿位置及金矿生命；波次和出生点保持当前关卡的配置。套用后的地图可独立修改，不随预设后续编辑变化。</p>`;
}
function renderMapPresets() {
  if (!draft.mapPresets[selected]) selected = Object.keys(draft.mapPresets)[0];
  const preset = draft.mapPresets[selected];
  return `<div class="entity-title"><h2>地图预设</h2><span class="hint">保存布局，在不同关卡重复使用</span></div><div class="editor-columns two">${entityList(Object.entries(draft.mapPresets).map(([key, item]) => [key, { ...item, icon: "base" }]), "map")}${preset ? `<div class="entity-form"><div class="entity-title"><h2>${esc(preset.name)}</h2><div><button data-action="duplicate-map">复制预设</button><button data-action="delete-map" class="danger">删除预设</button></div></div>${panel("地图信息", field("名称", `mapPresets.${selected}.name`) + '<p class="hint">预设保存树木与金矿布局。出生点、波次、敌人及奖励在各关卡中单独配置；也可在关卡地图中点击「将当前地图存为预设」。</p>')}${panel("地图布局 · 15 × 11", terrainEditor.render(preset))}</div>` : '<div class="empty-editor">暂无地图预设，点击新增绘制地图，或从关卡保存现有地图。</div>'}</div>`;
}
function renderWaves() {
  selected = Math.max(0, Math.min(Number(selected) || 0, draft.days.length - 1));
  const day = draft.days[selected], path = "days." + selected;
  waveSelected = Math.max(0, Math.min(waveSelected, day.waves.length - 1));
  const w = day.waves[waveSelected] || DEFAULT_CONFIG.days[0].waves[0], wp = path + ".waves." + waveSelected;
  const enemyOptions = Object.fromEntries(Object.entries(draft.enemies).map(([k, e]) => [k, e.name]));
  const dayButtons = '<button data-action="day-up">↑ 前移</button><button data-action="day-down">↓ 后移</button><button data-action="duplicate-day">复制天</button><button data-action="delete-day" class="danger">删除天</button>';
  const waveTabs = day.waves.map((wave, i) => '<button data-wave-select="' + i + '" class="' + (waveSelected === i ? 'active' : '') + '">第 ' + (i + 1) + ' 波<small>' + waveCount(wave) + ' 名敌人</small></button>').join('');
  const points = w.spawns.map((point, i) => {
    const pp = wp + '.spawns.' + i;
    const enemies = point.enemies.map((row, j) => '<div class="spawn-enemy-row">' + field('敌人类型', pp + '.enemies.' + j + '.type', { options: enemyOptions }) + field('等级', pp + '.enemies.' + j + '.level', { type: 'number', min: 1, max: 999, step: 1 }) + field('数量', pp + '.enemies.' + j + '.count', { type: 'number', min: 1, max: 500, step: 1 }) + '<button data-action="remove-spawn-enemy" data-point="' + i + '" data-index="' + j + '" aria-label="移除敌人">×</button></div>').join('');
    return '<div class="spawn-editor"><div class="entity-title"><h3>出生点 ' + (i + 1) + ' · (' + point.x + ', ' + point.y + ')</h3><button data-action="remove-spawn" data-point="' + i + '" class="danger">移除</button></div><div class="fields">' + field('本波开始后延迟（秒）', pp + '.delay', { type: 'number', max: 3600 }) + field('逐个出兵间隔（秒）', pp + '.interval', { type: 'number', min: 0.1, max: 1200 }) + '</div>' + enemies + '<button data-action="add-spawn-enemy" data-point="' + i + '">＋ 添加敌人类型</button></div>';
  }).join('');
  const successors = nextDayIds(draft, day.id);
  const connections = '<div class="route-links">' + draft.days.filter((d) => d.id !== day.id).map((d) => `<label class="route-link-option"><input type="checkbox" data-next-day="${esc(d.id)}" ${successors.includes(d.id) ? "checked" : ""}>${esc(d.name)}</label>`).join('') + '</div><p class="hint">勾选多个节点形成分支；不同分支可连接同一节点汇合。没有后续连接的节点为终点。</p>';
  const depth = routeEditor.options().layoutOverride.nodes.find((node) => node.day.id === day.id).depth + 1;
  return '<div class="campaign-editor">' + panel('关卡路线 · 点击节点编辑', field('路线起点', 'startDayId', { options: Object.fromEntries(draft.days.map((d) => [d.id, d.name])) }) + routeGraph(draft, { selected: day.id, available: successors, editor: true, ...routeEditor.options() }) + '<p class="hint">点击连线选中，再右键该线删除；右键节点开始连线，点击下一天的亮起节点完成连接；Esc 取消。编辑时列位置保持不变，保存前所有节点需从起点可达。</p>') + '</div><div class="editor-columns two">' + entityList(draft.days.map((d, i) => [i, d]), 'day') + '<div class="entity-form"><div class="entity-title"><h2>第 ' + depth + ' 天 · ' + esc(day.name) + '</h2><div>' + dayButtons + '</div></div>'
    + panel('关卡', field('名称', path + '.name') + field('节点类型', path + '.kind', { options: { battle: '战斗', shop: '商店' } }))
    + panel('后续路线', connections)
    + (day.kind === 'shop' ? shopSettings(path) : panel('当天地图 · 树木与金矿', mapPresetPicker() + terrainEditor.render(day))
    + panel('当天波次', '<div class="wave-tabs">' + waveTabs + '<button data-action="add-wave">＋ 新增波次</button></div><p class="hint">每波所有敌人出齐并被消灭后，才开始计算下一波的等待时间。最后一波结束后领取当天奖励。</p>')
    + panel('第 ' + (waveSelected + 1) + ' 波 · ' + waveCount(w) + ' 名敌人', '<div class="wave-actions"><button data-action="wave-up">↑ 前移</button><button data-action="wave-down">↓ 后移</button><button data-action="duplicate-wave">复制波次</button><button data-action="delete-wave" class="danger">删除波次</button></div><div class="fields">' + field('波次名称', wp + '.name') + (waveSelected === 0 ? '<p class="hint">第一波等待：' + draft.initial.firstWaveDelay + ' 秒（在「初始默认」修改，从开始当天起算）</p>' : field('上一波结束后等待（秒）', wp + '.startDelay', { type: 'number', max: 3600 })) + field('生命倍率', wp + '.hpScale', { type: 'number', min: 0.05, max: 100 }) + field('攻击倍率', wp + '.atkScale', { type: 'number', min: 0.05, max: 100 }) + '</div>')
    + panel('出生点与出兵配置', spawnGrid(w) + '<p class="hint">不同出生点独立计时，按各自列表顺序逐个出兵。出生格被占用时等待，不会转移出生点。</p>' + points)
    + '<p class="hint">保存后，尚未开始的波次使用新配置。已开始波次的出兵计划保持不变，避免重复刷怪；要立即替换本波请保存并重开。</p>'
    + rewardSettings(path)) + '</div></div>';
}
function shopSettings(path) {
  const shop = get(path + ".shop"), defaults = economySettings(draft);
  if (!shop.useDefaults) {
    shop.heroPrices ??= Object.fromEntries(["common", "rare", "epic"].map(r => [r, shop.heroPrice ?? defaults[r + "HeroPrice"]]));
    for (const key of ["refreshCost", "refreshIncrease", "heroPackPrice", "resourcePackPrice", "equipmentPackPrice"]) shop[key] ??= defaults[key];
  }
  const labels = { "heroPrices.common": "普通英雄价格", "heroPrices.rare": "稀有英雄价格", "heroPrices.epic": "史诗英雄价格", refreshCost: "首次刷新费用", refreshIncrease: "每次刷新额外增加费用", heroPackPrice: "英雄卡包", resourcePackPrice: "资源卡包", equipmentPackPrice: "装备卡包" };
  return panel("旅行商店", `<div class="fields">${Object.entries({hero:"英雄商品",heroPack:"英雄卡包",resourcePack:"资源卡包",equipmentPack:"装备卡包"}).map(([key,label]) => field(label + "奖励池", path + ".shop." + key + "Pool", {options:{"":"全部同类卡牌",...Object.fromEntries(Object.entries(draft.rewardPools).map(([id,pool])=>[id,pool.name]))}})).join("")}</div><p class="hint">直接复用奖励池中的卡牌和权重，自动筛选对应类别。未选择时使用全部同类卡牌。</p><p class="hint">英雄按品质标价；刷新仅更新英雄商品，卡包每包限购一次、拆包三选一。刷新次数在每次进入新的商店时归零。</p><label class="trigger-enable"><input type="checkbox" data-path="${path}.shop.useDefaults" ${shop.useDefaults ? "checked" : ""}>使用「初始默认」中的商店价格</label>` +
    (shop.useDefaults ? '<p class="hint">修改「初始默认 → 商店与金币收益」即可统一调整。取消勾选可单独配置此商店。</p>' : '<div class="fields">' + Object.entries(labels).map(([key,label]) => field(label + "（金币）", path + ".shop." + key, { type: "number", min: 0, max: 999, step: 1 })).join("") + '</div>'));
}
function rewardSettings(path) {
  return panel("当天胜利奖励 · 三选一", field("奖励池", path + ".rewardPool", { options: Object.fromEntries(Object.entries(draft.rewardPools).map(([key, pool]) => [key, pool.name])) }) + '<p class="hint">在「奖励池」页面编辑卡牌与权重；本关胜利后展示三张，选择一张收入手牌。</p>');
}
function renderPools() {
  if (!draft.rewardPools[selected]) selected = Object.keys(draft.rewardPools)[0];
  const pool = draft.rewardPools[selected];
  return `<div class="editor-columns two">${entityList(Object.entries(draft.rewardPools).map(([key,p]) => [key,{...p,icon:"training"}]),"pool")}<div class="entity-form"><div class="entity-title"><h2>${esc(pool.name)}</h2><div><button data-action="duplicate-pool">复制</button><button data-action="delete-pool" class="danger">删除</button></div></div>${panel("卡牌奖励池", field("名称", `rewardPools.${selected}.name`) + '<p class="hint">下方数字是抽取权重，越大越容易出现；0 表示停用。每次三选一，同次优先不重复，池中不足三种时才允许重复补足。</p>' + inventory(`rewardPools.${selected}.cards`))}</div></div>`;
}
function render() {
  $("sections").innerHTML = Object.entries({
    cards: ["01", "卡牌配置"],
    initial: ["02", "初始默认"],
    enemies: ["03", "敌方单位"],
    waves: ["04", "关卡路线"],
    pools: ["05", "奖励池"],
    maps: ["06", "地图预设"],
  })
    .map(
      ([k, [n, t]]) =>
        `<button data-section="${k}" class="${section === k ? "active" : ""}"><span>${n}</span>${t}</button>`,
    )
    .join("");
  $("config-name").value = draft.name;
  $("editor").innerHTML = {
    cards: renderCards,
    initial: renderInitial,
    enemies: renderEnemies,
    waves: renderWaves,
    pools: renderPools,
    maps: renderMapPresets,
  }[section]();
  if (section === "cards" && draft.cards[selected]?.category === "hero") {
    document.querySelector(".entity-form").insertAdjacentHTML("beforeend",
      panel("触发机制", triggerRulesEditor(draft.cards[selected], "cards." + selected, field, draft.cards)));
  }
}
function freshId(prefix, object) {
  let i = 1;
  while (Object.hasOwn(object, prefix + "_" + i)) i++;
  return prefix + "_" + i;
}
function ensureSummon(card) {
  if (card.effects.some((e) => e.type === "summon")) {
    card.target = "ground";
    card.unit ??= clone(DEFAULT_CONFIG.cards.tower.unit);
  } else if (card.category === "resource" && card.target === "ground")
    card.target = "hero";
}
$("editor").addEventListener("input", (e) => {
  if (e.target.dataset.rankValue) {
    const parts = e.target.dataset.rankValue.split("."), key = parts.pop(), owner = get(parts.join("."));
    const rank = e.target.dataset.rankIndex;
    if (e.target.value === "") {
      if (owner.rankValues?.[rank]) {
        delete owner.rankValues[rank][key];
        if (!Object.keys(owner.rankValues[rank]).length) delete owner.rankValues[rank];
        if (!Object.keys(owner.rankValues).length) delete owner.rankValues;
      }
    } else {
      owner.rankValues ??= {};
      owner.rankValues[rank] ??= {};
      owner.rankValues[rank][key] = Number(e.target.value);
    }
    markDirty(); return;
  }
  const path = e.target.dataset.path;
  if (!path) return;
  set(
    path,
    e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value,
  );
  const unitPath = /^cards\.([^.]+)\.unit\.(.+)$/.exec(path);
  if (unitPath && draft.cards[unitPath[1]]?.category === "hero" && Object.hasOwn(heroStatFields, unitPath[2])) {
    draft.cards[unitPath[1]].statSource = "custom";
    const source = document.querySelector('[data-path="cards.' + unitPath[1] + '.statSource"]');
    if (source) source.value = "custom";
  }
  if (path.startsWith("initial.heroStatPresets.")) syncHeroStatPresets(draft);
  for (const input of document.querySelectorAll("[data-rank-value]"))
    if (input.dataset.rankValue === path) input.placeholder = e.target.value;
  for (const element of document.querySelectorAll("[data-growth-preview]"))
    element.innerHTML = growthPreview(element.dataset.growthPreview);
  if (section === "cards" && $("card-preview"))
    $("card-preview").innerHTML = preview(draft.cards[selected]);
  if (section === "waves") {
    const day = draft.days[selected];
    for (const tab of document.querySelectorAll("[data-wave-select]"))
      tab.querySelector("small").textContent = waveCount(day.waves[Number(tab.dataset.waveSelect)]) + " 名敌人";
    const total = document.querySelector(`[data-select="${selected}"] small`);
    if (total) total.textContent = day.kind === "shop" ? "商店" : `${day.waves.length} 波 · ${day.waves.reduce((n, w) => n + waveCount(w), 0)} 名敌人`;
    const heading = document.querySelector(".wave-actions")?.closest(".editor-panel").querySelector("h3");
    if (heading) heading.textContent = `第 ${waveSelected + 1} 波 · ${waveCount(day.waves[waveSelected])} 名敌人`;
  }
});
$("config-name").oninput = (e) => {
  draft.name = e.target.value;
  markDirty();
};
$("editor").addEventListener("change", async (e) => {
  if (e.target.dataset.heroTag) {
    draft.cards[selected].tags = [...document.querySelectorAll("[data-hero-tag]:checked")].map(input => input.dataset.heroTag);
    markDirty(); return;
  }
  if (e.target.matches("[data-map-preset]")) {
    const preset = draft.mapPresets[e.target.value];
    if (!preset) return;
    try {
      applyMapPreset(draft.days[selected], preset);
      markDirty(); render();
      message(`已套用「${preset.name}」。可继续调整当前关卡的地图，保存后生效。`);
    } catch (error) {
      e.target.value = "";
      message("无法套用地图预设：" + error.message, true);
    }
    return;
  }
  const gradePath = e.target.dataset.path;
  if (gradePath?.endsWith(".shop.useDefaults")) { render(); return; }
  if (gradePath?.startsWith("cards.") && [".rarity", ".role", ".statSource"].some(suffix => gradePath.endsWith(suffix))) {
    const card = draft.cards[gradePath.split(".")[1]];
    set(gradePath, e.target.value);
    if (!gradePath.endsWith(".statSource")) card.statSource = "preset";
    if (card.statSource === "preset") applyHeroStatPreset(card, draft.initial.heroStatPresets);
    render(); return;
  }
  if (e.target.dataset.mechanic) {
    const unit = get(e.target.dataset.unitPath), key = e.target.dataset.mechanic;
    unit.mechanics ??= {};
    if (e.target.checked) unit.mechanics[key] = key === "knockback" ? {distance:1} : ["arrowReduction", "rangedReduction"].includes(key) ? {mode:"percent",value:50} : true;
    else delete unit.mechanics[key];
    if (!Object.keys(unit.mechanics).length) delete unit.mechanics;
    markDirty(); render(); return;
  }
  if (e.target.dataset.path?.endsWith(".combatBehavior")) {
    const unit = get(e.target.dataset.path.replace(/\.combatBehavior$/, ""));
    if (unit.combatBehavior === "heal") selectAttackModule(unit, "heal");
    else if (unit.attackModule === "heal") selectAttackModule(unit, "staff");
    render(); return;
  }
  if (e.target.dataset.path?.endsWith(".attackModule")) {
    const unit = get(e.target.dataset.path.replace(/\.attackModule$/, ""));
    selectAttackModule(unit, e.target.value);
    markDirty(); render(); return;
  }
  if (e.target.dataset.path?.endsWith(".kind") && section === "waves") {
    const day = draft.days[selected];
    if (day.kind === "shop") day.shop ??= { useDefaults: true };
    else {
      if (!day.waves.length) day.waves = clone(DEFAULT_CONFIG.days[0].waves);
      day.rewardPool ??= Object.keys(draft.rewardPools)[0];
    }
    render(); return;
  }
  if (e.target.dataset.generationCard) {
    const path = e.target.dataset.generationPath, effect = get(path);
    const checked = [...document.querySelectorAll(`[data-generation-path="${path}"]:checked`)].map(input => input.dataset.generationCard);
    setGenerationCandidates(effect, checked, draft.cards);
    markDirty(); return;
  }
  if (e.target.dataset.path?.endsWith(".pool")) {
    const effect = get(e.target.dataset.path.slice(0, -5));
    if (effect?.type === "generateCard") setGenerationCandidates(effect, effect.cards || [], draft.cards);
  }
  if (e.target.dataset.nextDay) {
    materializeRoutes(draft);
    const day = draft.days[selected], id = e.target.dataset.nextDay;
    day.next = e.target.checked ? [...new Set([...day.next, id])] : day.next.filter((next) => next !== id);
    routeEditor.config = null;
    markDirty();
    render();
    return;
  }
  if (e.target.dataset.path === "startDayId") { render(); return; }
  if (e.target.dataset.triggerEffectType) {
    const type = e.target.value;
    set(e.target.dataset.triggerEffectType, { type, ...clone(triggerEffects[type].defaults) });
    render();
    return;
  }
  if (e.target.dataset.path?.includes(".triggerRules.") && e.target.tagName === "SELECT") {
    if (e.target.dataset.path.endsWith(".trigger.event")) {
      const rule = get(e.target.dataset.path.replace(/\.trigger\.event$/, ""));
      if (rule.trigger.event === "interval") rule.trigger.interval ??= 10;
      if (rule.trigger.event === "cardPlayed") { rule.trigger.every ??= 1; rule.trigger.category ??= "all"; }
      if (rule.trigger.event === "towerBuilt") rule.target.kind = "eventTower";
      else if (rule.target.kind === "eventTower") rule.target.kind = "self";
    }
    render();
    return;
  }
  const path = e.target.dataset.iconSelect;
  if (path) {
    set(path, e.target.value);
    render();
  }
  if (e.target.dataset.effectType) {
    const ep = e.target.dataset.effectType,
      type = e.target.value;
    set(ep, { type, ...clone(effectTypes[type].defaults) });
    ensureSummon(draft.cards[selected]);
    render();
  }
  if ([".mode", ".valueMode", ".pool"].some(suffix => e.target.dataset.path?.endsWith(suffix))) render();
  const upload = e.target.dataset.upload;
  if (upload) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("请选择不超过 5 MB 的 PNG、JPEG 或 WebP");
      const img = await createImageBitmap(file),
        scale = Math.min(1, 256 / Math.max(img.width, img.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      img.close();
      set(upload, canvas.toDataURL("image/png"));
      render();
      message("图片已嵌入草稿，将随配置文件一起导出。");
    } catch (error) {
      message(error.message, true);
    }
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.enemyPreset && piratePresets[b.dataset.enemyPreset]) {
    if (Object.keys(draft.enemies).length >= 50) { message("最多配置 50 种敌人", true); return; }
    const id = freshId(b.dataset.enemyPreset, draft.enemies);
    draft.enemies[id] = clone(piratePresets[b.dataset.enemyPreset]);
    selected = id;
    markDirty(); render(); return;
  }
  if (b.dataset.heroPreset && presetById[b.dataset.heroPreset]) {
    if (Object.keys(draft.cards).length >= 100) { message("最多配置 100 张卡牌", true); return; }
    const id = freshId("hero_" + b.dataset.heroPreset, draft.cards);
    draft.cards[id] = createPresetCard(b.dataset.heroPreset);
    draft.cards[id].statSource = "preset";
    applyHeroStatPreset(draft.cards[id], draft.initial.heroStatPresets);
    selected = id;
    markDirty(); render(); return;
  }
  if (b.dataset.triggerTemplate) {
    const templates = {
      ...cardPlayRules,
      victoryGold: { ...newTriggerRule(), name:"胜利奖金", trigger:{event:"victory",scope:"any",radius:-1}, effects:[{type:"victoryGold",value:2}] },
      ...workshopRules,
      preparation: { ...newTriggerRule(), name: "整备随从", trigger: { event: "preparation", scope: "any", radius: -1 }, effects: [{ type: "summonFollower", hpPercent: 50, atkPercent: 50, count: 1 }] },
      growth: defaultHeroRules("hero_blue")[0], momentum: defaultHeroRules("hero_blue")[1],
      rally: defaultHeroRules("hero_green")[0], echo: defaultHeroRules("hero_purple")[0],
    };
    (draft.cards[selected].triggerRules ??= []).push(clone(templates[b.dataset.triggerTemplate]));
    markDirty(); render(); return;
  }
  if (b.dataset.section) {
    section = b.dataset.section;
    selected =
      section === "cards" ? "hero_blue" : section === "enemies" ? "grunt" : 0;
    render();
    return;
  }
  if (b.dataset.category) {
    category = b.dataset.category;
    selected = "";
    render();
    return;
  }
  if (b.dataset.select !== undefined) {
    selected = b.dataset.select;
    waveSelected = 0;
    render();
    return;
  }
  if (b.dataset.routeNode) {
    selected = draft.days.findIndex((day) => day.id === b.dataset.routeNode);
    waveSelected = 0;
    render();
    return;
  }
  if (b.dataset.waveSelect !== undefined) {
    waveSelected = Number(b.dataset.waveSelect);
    render();
    return;
  }
  if (b.dataset.spawn) {
    const [x, y] = b.dataset.spawn.split(",").map(Number),
      w = draft.days[selected].waves[waveSelected],
      i = w.spawns.findIndex((p) => p.x === x && p.y === y);
    if (i < 0) w.spawns.push({ x, y, delay: 0, interval: 1, enemies: [{ type: Object.keys(draft.enemies)[0], count: 1, level: 1 }] });
    else w.spawns.splice(i, 1);
    markDirty();
    render();
    return;
  }
  const action = b.dataset.action;
  if (!action) return;
  if (["add-map", "duplicate-map", "capture-map"].includes(action)) {
    if (Object.keys(draft.mapPresets).length >= 100) { message("最多保存 100 个地图预设", true); return; }
    const source = action === "capture-map" ? draft.days[selected] : action === "duplicate-map" ? draft.mapPresets[selected] : { obstacles: [], mines: [] };
    const errors = mapLayoutErrors(source);
    if (errors.length) { message(errors.join("；"), true); return; }
    const id = freshId("map", draft.mapPresets);
    draft.mapPresets[id] = { name: action === "add-map" ? "新地图" : String(source.name).slice(0, 75) + (action === "capture-map" ? " · 地图" : " 副本"), ...copyMapLayout(source) };
    section = "maps"; selected = id;
    markDirty(); render();
    if (action === "capture-map") message("当前地图已存为预设草稿，可重命名后保存；其他关卡可直接选用。");
    return;
  }
  if (action === "delete-map") {
    delete draft.mapPresets[selected];
    selected = Object.keys(draft.mapPresets)[0];
    markDirty(); render();
    message("已删除预设草稿；已经套用的关卡保留原地图。保存后生效。");
    return;
  }
  const card = draft.cards[selected],
    day = draft.days[selected],
    w = day?.waves[waveSelected],
    i = Number(b.dataset.index);
  if (action === "add-trigger") (card.triggerRules ??= []).push(newTriggerRule());
  if (action === "duplicate-trigger") card.triggerRules.splice(i + 1, 0, clone(card.triggerRules[i]));
  if (action === "remove-trigger") card.triggerRules.splice(i, 1);
  if (action === "trigger-up" && i > 0)
    [card.triggerRules[i - 1], card.triggerRules[i]] = [card.triggerRules[i], card.triggerRules[i - 1]];
  if (action === "add-trigger-effect") {
    const rp = `cards.${selected}.triggerRules.${i}`;
    const type = document.querySelector(`[data-trigger-effect-choice="${rp}"]`).value;
    card.triggerRules[i].effects.push({ type, ...clone(triggerEffects[type].defaults) });
  }
  if (action === "remove-trigger-effect") card.triggerRules[Number(b.dataset.rule)].effects.splice(i, 1);
  if (action === "add-card" || action === "duplicate-card") {
    const template =
        action === "duplicate-card"
          ? card
          : Object.values(DEFAULT_CONFIG.cards).find(
              (c) => c.category === category,
            ),
      id = freshId(category, draft.cards);
    draft.cards[id] = clone(template);
    if (action === "add-card" && category === "hero") {
      draft.cards[id].statSource = "preset";
      applyHeroStatPreset(draft.cards[id], draft.initial.heroStatPresets);
    }
    draft.cards[id].name =
      action === "duplicate-card"
        ? template.name + " 副本"
        : "新" + types[category];
    selected = id;
  }
  if (action === "delete-card") {
    if (!confirm("删除此卡牌，并从初始手牌和所有奖励中移除？")) return;
    delete draft.cards[selected];
    delete draft.initial.cards[selected];
    for (const pool of Object.values(draft.rewardPools)) delete pool.cards[selected];
    pruneGenerationCandidates(draft);
    selected = "";
  }
  if (action === "add-effect") {
    const owner = get(b.dataset.effectOwner);
    const type = document.querySelector(`[data-effect-choice="${b.dataset.effectOwner}"]`).value;
    owner.effects.push({ type, ...clone(effectTypes[type].defaults) });
    ensureSummon(card);
  }
  if (action === "add-pool" || action === "duplicate-pool") {
    const id = freshId("pool", draft.rewardPools);
    draft.rewardPools[id] = action === "duplicate-pool" ? clone(draft.rewardPools[selected]) : { name: "新奖励池", cards: Object.fromEntries(Object.keys(draft.cards).slice(0,5).map(key => [key,1])) };
    if (action === "duplicate-pool") draft.rewardPools[id].name += " 副本";
    selected = id;
  }
  if (action === "delete-pool") {
    if (draft.days.some(day => day.rewardPool === selected || ["hero", "heroPack", "resourcePack", "equipmentPack"].some(key => day.shop?.[key + "Pool"] === selected))) { message("此奖励池被关卡引用，请先为关卡更换奖励池。", true); return; }
    if (Object.keys(draft.rewardPools).length === 1) { message("至少保留一个奖励池。", true); return; }
    delete draft.rewardPools[selected]; selected = Object.keys(draft.rewardPools)[0];
  }
  if (action === "remove-effect") {
    get(b.dataset.effectOwner).effects.splice(i, 1);
    ensureSummon(card);
  }
  if (action === "effect-up" && i > 0) {
    const effects = get(b.dataset.effectOwner).effects;
    [effects[i - 1], effects[i]] = [effects[i], effects[i - 1]];
  }
  if (action === "add-skill-tier" && card.skillTiers.length < 9) {
    const previous = card.skillTiers.at(-1) || card;
    card.skillTiers.push(defaultSkillTiers(previous)[0]);
  }
  if (action === "remove-skill-tier") card.skillTiers.pop();
  if (action === "add-inventory") {
    const path = b.dataset.pathValue,
      key = document.querySelector(`[data-inventory-choice="${path}"]`).value;
    if (key) get(path)[key] = 1;
  }
  if (action === "remove-inventory")
    delete get(b.dataset.pathValue)[b.dataset.key];
  if (action === "add-enemy" || action === "duplicate-enemy") {
    const id = freshId("enemy", draft.enemies),
      template =
        action === "duplicate-enemy"
          ? draft.enemies[selected]
          : DEFAULT_CONFIG.enemies.grunt;
    draft.enemies[id] = clone(template);
    draft.enemies[id].name =
      action === "duplicate-enemy" ? template.name + " 副本" : "新敌人";
    selected = id;
  }
  if (action === "delete-enemy") {
    if (
      draft.days.some((d) => d.waves.some((w) => w.spawns.some((p) => p.enemies.some((e) => e.type === selected))))
    ) {
      message("此敌人仍被波次引用，请先修改对应波次。", true);
      return;
    }
    if (Object.keys(draft.enemies).length === 1) {
      message("至少保留一种敌人。", true);
      return;
    }
    if (!confirm("删除此敌人？")) return;
    delete draft.enemies[selected];
    selected = "";
  }
  if (action === "add-day" || action === "duplicate-day") {
    materializeRoutes(draft);
    const item = clone(action === "duplicate-day" ? day : draft.days[0]);
    item.id = freshId("day", Object.fromEntries(draft.days.map((d) => [d.id, true])));
    item.name = action === "duplicate-day" ? day.name + " 副本" : "新的一天";
    item.next = action === "duplicate-day" ? [...day.next] : [];
    if (day) day.next.push(item.id);
    draft.days.push(item);
    selected = draft.days.length - 1;
    waveSelected = 0;
  }
  if (action === "delete-day") {
    if (draft.days.length === 1) { message("至少保留一天。", true); return; }
    if (!confirm("删除这一天及其全部波次？")) return;
    materializeRoutes(draft);
    for (const node of draft.days) if (node.next.includes(day.id))
      node.next = [...new Set(node.next.flatMap((id) => id === day.id ? day.next : [id]))];
    if (draft.startDayId === day.id) draft.startDayId = day.next[0] || draft.days.find((d) => d !== day)?.id;
    draft.days.splice(Number(selected), 1);
    selected = Math.min(Number(selected), draft.days.length - 1);
    waveSelected = 0;
  }
  if (action === "day-up" || action === "day-down") {
    const from = Number(selected), to = from + (action === "day-up" ? -1 : 1);
    if (to >= 0 && to < draft.days.length) {
      [draft.days[from], draft.days[to]] = [draft.days[to], draft.days[from]];
      selected = to;
    }
  }
  if (action === "add-wave" || action === "duplicate-wave") {
    const item = clone(action === "duplicate-wave" ? w : day.waves[0]);
    item.id = freshId("wave", Object.fromEntries(day.waves.map((v) => [v.id, true])));
    item.name = action === "duplicate-wave" ? w.name + " 副本" : "新波次";
    if (action === "add-wave") item.startDelay = 5;
    day.waves.push(item);
    waveSelected = day.waves.length - 1;
  }
  if (action === "delete-wave") {
    if (day.waves.length === 1) { message("每天至少保留一波。", true); return; }
    if (!confirm("删除此波次？")) return;
    day.waves.splice(waveSelected, 1);
    waveSelected = Math.min(waveSelected, day.waves.length - 1);
  }
  if (action === "wave-up" || action === "wave-down") {
    const to = waveSelected + (action === "wave-up" ? -1 : 1);
    if (to >= 0 && to < day.waves.length) {
      [day.waves[waveSelected], day.waves[to]] = [day.waves[to], day.waves[waveSelected]];
      waveSelected = to;
    }
  }
  if (action === "add-spawn-enemy") w.spawns[Number(b.dataset.point)].enemies.push({ type: Object.keys(draft.enemies)[0], count: 1, level: 1 });
  if (action === "remove-spawn-enemy") w.spawns[Number(b.dataset.point)].enemies.splice(i, 1);
  if (action === "remove-spawn") w.spawns.splice(Number(b.dataset.point), 1);
  markDirty();
  render();
});
async function save(mode) {
  if (saving) return;
  const errors = validateConfig(draft);
  if (errors.length) {
    message(errors.slice(0, 12).join("\n"), true);
    return;
  }
  if (conflict && !confirm("其他页面已保存了新版本。仍用当前草稿覆盖？"))
    return;
  try {
    saving = true;
    draft = await saveConfig(draft, mode);
    dirty = false;
    conflict = false;
    $("save-state").textContent = "✓ 已保存并同步";
    $("save-state").className = "saved";
    message(
      mode === "restart"
        ? "已保存，打开的游戏已重新开局。"
        : savesToProject() ? "已写入 public/config/game.json 并同步游戏。提交并推送后，其他设备拉取即可获得配置。" : "已保存至本机并同步游戏。静态部署无法写入仓库，请导出后在本地配置页导入保存。",
    );
  } catch (error) {
    message(
      "保存失败：" + error.message + "\n可先导出配置文件保留草稿。",
      true,
    );
  } finally {
    saving = false;
  }
}
$("save-config").onclick = () => save("live");
$("save-restart").onclick = () => save("restart");
$("export-config").onclick = () => {
  const errors = validateConfig(draft);
  if (errors.length) {
    message(errors.slice(0, 12).join("\n"), true);
    return;
  }
  const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "friday-defense-config.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message("已导出完整配置（含图片）。在另一台设备导入并保存即可生效。");
};
$("import-config").onclick = () => $("import-file").click();
$("import-file").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5000000) throw new Error("配置文件超过 5 MB");
    const value = migrateConfig(JSON.parse(await file.text())),
      errors = validateConfig(value);
    if (errors.length) throw new Error(errors.slice(0, 12).join("\n"));
    if (dirty && !confirm("导入文件将替换未保存草稿，继续？")) return;
    draft = clone(value);
    markDirty();
    selected = "";
    render();
    message("导入成功。点击「保存并同步」应用，或「保存并重开」开始新局。");
  } catch (error) {
    message("导入失败，原草稿已保留：" + error.message, true);
  } finally {
    e.target.value = "";
  }
};
$("restore-defaults").onclick = () => {
  if (!confirm("将草稿恢复为默认规则？保存前不会影响游戏。")) return;
  draft = clone(DEFAULT_CONFIG);
  markDirty();
  selected = "";
  render();
  message("默认规则已载入草稿，保存后应用。");
};
subscribeConfig((config) => {
  if (saving) return;
  if (dirty) {
    conflict = true;
    message(
      "其他页面已保存新配置。当前未保存草稿仍保留，保存时将询问是否覆盖。",
      true,
    );
  } else {
    draft = clone(config);
    render();
    $("save-state").textContent = "✓ 已同步最新配置";
  }
});
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
render();
if (configLoadError) message(configLoadError, true);
