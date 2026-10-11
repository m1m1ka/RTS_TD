import "./editor.css";
import "../cards.css";
import {
  getConfig,
  saveConfig,
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
  skins,
  builtInIcons,
} from "./schema.js";
import { iconURL } from "./icons.js";
import { obstacles } from "../art.js";

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
      : `<input data-path="${path}" type="${type}" value="${esc(value)}" ${type === "number" ? `min="${min}" max="${max}" step="${step}"` : 'maxlength="80"'}>`;
  return `<label class="field ${wide ? "wide" : ""}"><span>${esc(label)}</span>${input}</label>`;
}
function unitFields(path) {
  return `<div class="fields">${field("动作模板", path + ".type", { options: Object.fromEntries(skins.map((s) => [s, s])) })}${field("独立武器", path + ".weapon", { options: weaponOptions })}${Object.entries(
    statLabels,
  )
    .map(([k, t]) =>
      field(t, path + "." + k, {
        type: "number",
        min: ["rate", "speed"].includes(k) ? 0.05 : k === "maxHp" ? 1 : 0,
        max: ["rate", "speed"].includes(k) ? 20 : k === "range" ? 24 : 1000000,
        step: k === "range" ? 1 : "any",
      }),
    )
    .join("")}</div>`;
}
function iconEditor(label, path, hint) {
  const value = get(path);
  return `<div class="icon-editor"><img src="${iconURL(value, true)}" alt="${esc(label)}"><div><b>${esc(label)}</b><small>${esc(hint)}</small><select data-icon-select="${path}"><option value="" ${!builtInIcons.includes(value) ? "selected" : ""} disabled>上传的图片</option>${builtInIcons.map((k) => `<option value="${k}" ${k === value ? "selected" : ""}>${k}</option>`).join("")}</select><label class="upload">上传图片<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${path}" hidden></label></div></div>`;
}
function panel(title, body, aside = "") {
  return `<section class="editor-panel"><div class="panel-title"><h3>${title}</h3>${aside}</div>${body}</section>`;
}
function inventory(path) {
  const value = get(path);
  return `<div class="inventory">${Object.entries(value)
    .map(
      ([key, n]) =>
        `<div class="inventory-row"><img src="${iconURL(draft.cards[key]?.icon, true)}" alt=""><span>${esc(draft.cards[key]?.name || key)}</span><input type="number" min="0" max="999" step="1" value="${n}" aria-label="${esc(draft.cards[key]?.name)}数量" data-path="${path}.${key}"><button class="icon-button" data-action="remove-inventory" data-path-value="${path}" data-key="${key}" title="移除">×</button></div>`,
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
        if (effect.type === "stat")
          controls +=
            field("属性", ep + ".stat", { options: statLabels }) +
            field("计算方式", ep + ".mode", {
              options: { add: "增加数值", multiply: "乘以倍率" },
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
            ["slow", "lifesteal", "mitigation", "splash"].includes(effect.type)
              ? "比例（0.25 = 25%）"
              : effect.type === "stat" && effect.mode === "multiply"
                ? "倍率（1.25 = +25%）"
                : "数值",
            ep + ".value",
            {
              type: "number",
              min: 0,
              step: effect.type === "level" ? 1 : "any",
            },
          );
        if ("radius" in effect)
          controls += field("作用半径（格）", ep + ".radius", {
            type: "number",
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
          )}</select><button class="icon-button" data-action="effect-up" data-index="${i}" ${i === 0 ? "disabled" : ""} title="上移效果">↑</button><button class="icon-button" data-action="remove-effect" data-index="${i}" title="移除效果">×</button></div><div class="fields">${controls || '<p class="hint">使用下方的炮台属性放置一个单位。</p>'}</div></div>`;
      })
      .join("") || '<p class="hint">英雄基础属性之外，可叠加额外效果。</p>'
  }</div><div class="add-row"><select id="new-effect">${Object.entries(
    effectTypes,
  )
    .filter(([, spec]) => spec.categories.includes(card.category))
    .map(([k, spec]) => `<option value="${k}">${spec.label}</option>`)
    .join(
      "",
    )}</select><button data-action="add-effect">＋ 叠加效果</button></div>`;
}
function preview(card) {
  return `<div class="preview-sticky"><div class="nav-caption">卡面预览</div><div class="hand-card ${card.category} config-preview"><b class="card-count"><span>×</span>1</b><strong class="card-title">${esc(card.name)}</strong><div class="card-picture"><img src="${iconURL(card.icon, true)}" alt=""></div><span class="card-kind">${types[card.category]}</span><small class="card-description">${esc(card.text).replace(/ · /g, "<br>")}</small><span class="card-flourish">◆</span></div><small>属性效果按列表顺序叠加，等级成长先计入基础属性。描述为独立展示文本。</small><div class="actual-preview"><img src="${iconURL(card.useIcon)}" alt="使用图标"><span>实际使用图标</span></div></div>`;
}
function entityList(items, kind) {
  return `<aside class="entity-list"><div class="entity-toolbar"><span>${items.length} 项</span><button data-action="add-${kind}">＋ 新增</button></div>${items.map(([key, item], i) => `<button class="entity ${String(selected) === String(key) ? "active" : ""}" data-select="${key}">${kind !== "day" ? `<img src="${iconURL(item.icon || item.useIcon, true)}" alt="">` : `<b class="wave-number">${Number(key) + 1}</b>`}<span>${esc(item.name)}<small>${kind === "day" ? `${item.waves.length} 波 · ${item.waves.reduce((n, w) => n + waveCount(w), 0)} 名敌人` : esc(key)}</small></span></button>`).join("")}</aside>`;
}
function renderCards() {
  const items = Object.entries(draft.cards).filter(
    ([, c]) => c.category === category,
  );
  if (!items.some(([k]) => k === selected)) selected = items[0]?.[0];
  const card = draft.cards[selected];
  return `<div class="category-tabs">${Object.entries(types)
    .map(
      ([k, t]) =>
        `<button data-category="${k}" class="${category === k ? "active" : ""}">${t}</button>`,
    )
    .join(
      "",
    )}</div><div class="editor-columns">${entityList(items, "card")}${card ? `<div class="entity-form"><div class="entity-title"><h2>${esc(card.name)}</h2><div><button data-action="duplicate-card">复制</button><button data-action="delete-card" class="danger">删除</button></div></div>${panel("基本信息", `<div class="fields">${field("名字", "cards." + selected + ".name")}${field("使用目标", "cards." + selected + ".target", { options: { hero: { ground: "空地" }, resource: { hero: "我方英雄", ground: "空地（放置炮台）" }, battle: { area: "范围位置", enemy: "敌方单位" }, equipment: { hero: "我方英雄" } }[category] })}${field("描述", "cards." + selected + ".text", { type: "textarea", wide: true })}</div><div class="icon-pair">${iconEditor("卡牌 icon", "cards." + selected + ".icon", "显示在手牌与奖励牌上")}${iconEditor("实际使用 icon", "cards." + selected + ".useIcon", "单位外观 / 装备标记 / 施放图标")}</div>`)}${category === "hero" ? panel("英雄属性", unitFields("cards." + selected + ".unit")) : ""}${category === "battle" ? panel("战斗表现", field("施法特效", "cards." + selected + ".visual", { options: { fireball: "火球爆环", lightning: "落雷", frost: "寒霜" } })) : ""}${panel("组合效果", effectsEditor(card, "cards." + selected))}${card.effects.some((e) => e.type === "summon") ? panel("炮台属性", unitFields("cards." + selected + ".unit")) : ""}</div><aside id="card-preview">${preview(card)}</aside>` : '<div class="empty-editor">该分类暂无卡牌，点击新增开始配置。</div>'}</div>`;
}
function renderInitial() {
  return `<div class="entity-title"><h2>初始默认配置</h2><span class="hint">每次开局的规则</span></div><div class="initial-layout"><div>${panel("核心与波后恢复", `<div class="fields">${field("每天第一波开始等待（秒）", "initial.firstWaveDelay", { type: "number", max: 3600 })}${field("核心初始生命", "initial.baseHp", { type: "number", min: 1 })}${field("波后治疗比例", "initial.waveHeal", { type: "number", max: 1 })}${field("阵亡英雄复活血量比例", "initial.reviveHp", { type: "number", min: 0.01, max: 1 })}</div>`)}${panel(
    "每提升一级的成长",
    `<div class="fields">${Object.entries({
      maxHp: "最大生命增加",
      atk: "攻击力增加",
      rate: "攻击速度增加",
      heal: "升级恢复生命",
    })
      .map(([k, t]) => field(t, "initial.levelGrowth." + k, { type: "number" }))
      .join("")}</div>`,
  )}</div>${panel("初始手牌", inventory("initial.cards"))}</div>`;
}
function renderEnemies() {
  const items = Object.entries(draft.enemies);
  if (!draft.enemies[selected]) selected = items[0]?.[0];
  const enemy = draft.enemies[selected];
  return `<div class="editor-columns two">${entityList(items, "enemy")}<div class="entity-form"><div class="entity-title"><h2>${esc(enemy.name)}</h2><div><button data-action="duplicate-enemy">复制</button><button data-action="delete-enemy" class="danger">删除</button></div></div>${panel("敌方单位", field("名字", "enemies." + selected + ".name") + iconEditor("单位 icon", "enemies." + selected + ".useIcon", "战场中的实际外观") + unitFields("enemies." + selected))}<p class="hint">波次中的生命与攻击倍率会叠加到这里的基础数值上。</p></div></div>`;
}
function spawnGrid(w) {
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
function renderWaves() {
  selected = Math.max(0, Math.min(Number(selected) || 0, draft.days.length - 1));
  const day = draft.days[selected], path = "days." + selected;
  waveSelected = Math.min(waveSelected, day.waves.length - 1);
  const w = day.waves[waveSelected], wp = path + ".waves." + waveSelected;
  const enemyOptions = Object.fromEntries(Object.entries(draft.enemies).map(([k, e]) => [k, e.name]));
  const dayButtons = '<button data-action="day-up">↑ 前移</button><button data-action="day-down">↓ 后移</button><button data-action="duplicate-day">复制天</button><button data-action="delete-day" class="danger">删除天</button>';
  const waveTabs = day.waves.map((wave, i) => '<button data-wave-select="' + i + '" class="' + (waveSelected === i ? 'active' : '') + '">第 ' + (i + 1) + ' 波<small>' + waveCount(wave) + ' 名敌人</small></button>').join('');
  const points = w.spawns.map((point, i) => {
    const pp = wp + '.spawns.' + i;
    const enemies = point.enemies.map((row, j) => '<div class="spawn-enemy-row">' + field('敌人类型', pp + '.enemies.' + j + '.type', { options: enemyOptions }) + field('数量', pp + '.enemies.' + j + '.count', { type: 'number', min: 1, max: 500, step: 1 }) + '<button data-action="remove-spawn-enemy" data-point="' + i + '" data-index="' + j + '" aria-label="移除敌人">×</button></div>').join('');
    return '<div class="spawn-editor"><div class="entity-title"><h3>出生点 ' + (i + 1) + ' · (' + point.x + ', ' + point.y + ')</h3><button data-action="remove-spawn" data-point="' + i + '" class="danger">移除</button></div><div class="fields">' + field('本波开始后延迟（秒）', pp + '.delay', { type: 'number', max: 3600 }) + field('逐个出兵间隔（秒）', pp + '.interval', { type: 'number', min: 0.1, max: 1200 }) + '</div>' + enemies + '<button data-action="add-spawn-enemy" data-point="' + i + '">＋ 添加敌人类型</button></div>';
  }).join('');
  const rewards = day.rewards.map((pack, i) => '<div class="reward-editor"><div class="fields">' + field('奖励包名称', path + '.rewards.' + i + '.name') + field('类型', path + '.rewards.' + i + '.theme', { options: types }) + '</div>' + inventory(path + '.rewards.' + i + '.cards') + '<button data-action="remove-pack" data-index="' + i + '" class="danger">移除此奖励包</button></div>').join('');
  return '<div class="editor-columns two">' + entityList(draft.days.map((d, i) => [i, d]), 'day') + '<div class="entity-form"><div class="entity-title"><h2>第 ' + (Number(selected) + 1) + ' 天</h2><div>' + dayButtons + '</div></div>'
    + panel('关卡', field('名称', path + '.name'))
    + panel('当天波次', '<div class="wave-tabs">' + waveTabs + '<button data-action="add-wave">＋ 新增波次</button></div><p class="hint">每波所有敌人出齐并被消灭后，才开始计算下一波的等待时间。最后一波结束后领取当天奖励。</p>')
    + panel('第 ' + (waveSelected + 1) + ' 波 · ' + waveCount(w) + ' 名敌人', '<div class="wave-actions"><button data-action="wave-up">↑ 前移</button><button data-action="wave-down">↓ 后移</button><button data-action="duplicate-wave">复制波次</button><button data-action="delete-wave" class="danger">删除波次</button></div><div class="fields">' + field('波次名称', wp + '.name') + (waveSelected === 0 ? '<p class="hint">第一波等待：' + draft.initial.firstWaveDelay + ' 秒（在「初始默认」修改，从开始当天起算）</p>' : field('上一波结束后等待（秒）', wp + '.startDelay', { type: 'number', max: 3600 })) + field('生命倍率', wp + '.hpScale', { type: 'number', min: 0.05, max: 100 }) + field('攻击倍率', wp + '.atkScale', { type: 'number', min: 0.05, max: 100 }) + '</div>')
    + panel('出生点与出兵配置', spawnGrid(w) + '<p class="hint">不同出生点独立计时，按各自列表顺序逐个出兵。出生格被占用时等待，不会转移出生点。</p>' + points)
    + '<p class="hint">保存后，尚未开始的波次使用新配置。已开始波次的出兵计划保持不变，避免重复刷怪；要立即替换本波请保存并重开。</p>'
    + panel('当天胜利奖励', rewards + (day.rewards.length < 3 ? '<button data-action="add-pack">＋ 添加奖励包</button>' : '')) + '</div></div>';
}
function render() {
  $("sections").innerHTML = Object.entries({
    cards: ["01", "卡牌配置"],
    initial: ["02", "初始默认"],
    enemies: ["03", "敌方单位"],
    waves: ["04", "天数与波次"],
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
  }[section]();
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
  const path = e.target.dataset.path;
  if (!path) return;
  set(
    path,
    e.target.type === "number" ? Number(e.target.value) : e.target.value,
  );
  if (section === "cards" && $("card-preview"))
    $("card-preview").innerHTML = preview(draft.cards[selected]);
  if (section === "waves") {
    const day = draft.days[selected];
    for (const tab of document.querySelectorAll("[data-wave-select]"))
      tab.querySelector("small").textContent = waveCount(day.waves[Number(tab.dataset.waveSelect)]) + " 名敌人";
    const total = document.querySelector(`[data-select="${selected}"] small`);
    if (total) total.textContent = `${day.waves.length} 波 · ${day.waves.reduce((n, w) => n + waveCount(w), 0)} 名敌人`;
    const headings = document.querySelectorAll(".entity-form > .editor-panel > .panel-title > h3");
    if (headings[2]) headings[2].textContent = `第 ${waveSelected + 1} 波 · ${waveCount(day.waves[waveSelected])} 名敌人`;
  }
});
$("config-name").oninput = (e) => {
  draft.name = e.target.value;
  markDirty();
};
$("editor").addEventListener("change", async (e) => {
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
  if (e.target.dataset.path?.endsWith(".mode")) render();
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
  if (b.dataset.waveSelect !== undefined) {
    waveSelected = Number(b.dataset.waveSelect);
    render();
    return;
  }
  if (b.dataset.spawn) {
    const [x, y] = b.dataset.spawn.split(",").map(Number),
      w = draft.days[selected].waves[waveSelected],
      i = w.spawns.findIndex((p) => p.x === x && p.y === y);
    if (i < 0) w.spawns.push({ x, y, delay: 0, interval: 1, enemies: [{ type: Object.keys(draft.enemies)[0], count: 1 }] });
    else w.spawns.splice(i, 1);
    markDirty();
    render();
    return;
  }
  const action = b.dataset.action;
  if (!action) return;
  const card = draft.cards[selected],
    day = draft.days[selected],
    w = day?.waves[waveSelected],
    i = Number(b.dataset.index);
  if (action === "add-card" || action === "duplicate-card") {
    const template =
        action === "duplicate-card"
          ? card
          : Object.values(DEFAULT_CONFIG.cards).find(
              (c) => c.category === category,
            ),
      id = freshId(category, draft.cards);
    draft.cards[id] = clone(template);
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
    for (const wave of draft.days)
      for (const pack of wave.rewards) delete pack.cards[selected];
    selected = "";
  }
  if (action === "add-effect") {
    const type = $("new-effect").value;
    card.effects.push({ type, ...clone(effectTypes[type].defaults) });
    ensureSummon(card);
  }
  if (action === "remove-effect") {
    card.effects.splice(i, 1);
    ensureSummon(card);
  }
  if (action === "effect-up" && i > 0)
    [card.effects[i - 1], card.effects[i]] = [
      card.effects[i],
      card.effects[i - 1],
    ];
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
    const item = clone(action === "duplicate-day" ? day : draft.days[0]);
    item.id = freshId("day", Object.fromEntries(draft.days.map((d) => [d.id, true])));
    item.name = action === "duplicate-day" ? day.name + " 副本" : "新的一天";
    draft.days.push(item);
    selected = draft.days.length - 1;
    waveSelected = 0;
  }
  if (action === "delete-day") {
    if (draft.days.length === 1) { message("至少保留一天。", true); return; }
    if (!confirm("删除这一天及其全部波次？")) return;
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
  if (action === "add-spawn-enemy") w.spawns[Number(b.dataset.point)].enemies.push({ type: Object.keys(draft.enemies)[0], count: 1 });
  if (action === "remove-spawn-enemy") w.spawns[Number(b.dataset.point)].enemies.splice(i, 1);
  if (action === "remove-spawn") w.spawns.splice(Number(b.dataset.point), 1);
  if (action === "add-pack") day.rewards.push({ name: "新奖励包", theme: "resource", cards: { [Object.keys(draft.cards)[0]]: 1 } });
  if (action === "remove-pack") day.rewards.splice(i, 1);
  markDirty();
  render();
});
function save(mode) {
  const errors = validateConfig(draft);
  if (errors.length) {
    message(errors.slice(0, 12).join("\n"), true);
    return;
  }
  if (conflict && !confirm("其他页面已保存了新版本。仍用当前草稿覆盖？"))
    return;
  try {
    saving = true;
    draft = saveConfig(draft, mode);
    dirty = false;
    conflict = false;
    $("save-state").textContent = "✓ 已保存并同步";
    $("save-state").className = "saved";
    message(
      mode === "restart"
        ? "已保存，打开的游戏已重新开局。"
        : "已保存至本机，并同步到打开的游戏。跨设备请导出配置文件。",
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
