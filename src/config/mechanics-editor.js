export function mechanicsEditor(unit, path, field) {
  const m = unit.mechanics || {};
  const toggle = (key,label) => `<label class="trigger-enable"><input type="checkbox" data-mechanic="${key}" data-unit-path="${path}" ${m[key] ? "checked" : ""}>${label}</label>`;
  return `<div class="level-growth"><h4>特殊机制 · 默认无</h4><div class="fields">
    ${toggle("immobile","部署后无法移动")}
    ${toggle("dormant","队友全部阵亡后苏醒")}
    ${toggle("deathsAsSacrifice","所有英雄死亡视为牺牲触发")}
    ${toggle("knockback","攻击附带击退")}
    ${m.knockback ? field("击退距离（格）",path+".mechanics.knockback.distance",{type:"number",min:1,max:24,step:1}) : ""}
    ${toggle("arrowReduction","减免敌方弓箭伤害")}
    ${m.arrowReduction ? field("弓箭减伤方式",path+".mechanics.arrowReduction.mode",{options:{percent:"百分比",fixed:"固定数值"}})+field(m.arrowReduction.mode === "percent" ? "弓箭伤害减免（%）" : "每次弓箭伤害减免",path+".mechanics.arrowReduction.value",{type:"number",min:0,max:m.arrowReduction.mode === "percent"?100:100000,step:"any"}) : ""}
  </div><p class="hint">禁移阻止手动移动、自动治疗追赶与给友军让位，仍可原地攻击或治疗。击退仅作用于普通攻击的主目标，斜角计 1 格，遇到障碍、单位或边界停止。弓与弩均计为箭矢；先结算通用减伤，再结算弓箭减伤，最低可降至 0。</p>
  ${m.deathsAsSacrifice ? '<p class="hint">被动机制：该英雄存活且在场时，全场英雄每次死亡（含资源牌销毁）均视为一次牺牲，可触发「英雄触发牺牲效果后」。死者没有牺牲规则也计入；已有规则照常执行后只通知一次，多名机制持有者不叠加次数。持有者自身死亡也计入，之后机制失效，复活后恢复。随从、炮台、敌人不计入。沉睡不关闭此被动，但沉睡英雄仍不能响应监听规则；不会补发过去的死亡。</p>' : ""}
  ${m.dormant ? '<p class="hint">沉睡时不能移动、攻击、治疗或触发英雄规则，但仍会受伤、接受治疗与增益。点击迎战后，其他已部署英雄全部阵亡或被销毁时苏醒；不统计炮台、随从或手牌。只有自己时立即苏醒。同天苏醒后不会因队友复活而再次沉睡，下一天重新判定；沉睡期间错过的整备、开战等事件不补发。</p>' : ""}</div>`;
}

export function enemyMechanicsEditor(unit, path, field) {
  const armor = unit.mechanics?.rangedReduction;
  return `<div class="level-growth"><h4>特殊机制 · 默认无</h4><div class="fields">
    <label class="trigger-enable"><input type="checkbox" data-mechanic="rangedReduction" data-unit-path="${path}" ${armor ? "checked" : ""}>额外抵挡远程英雄伤害</label>
    ${armor ? field("抵挡方式", path + ".mechanics.rangedReduction.mode", { options: { percent: "百分比", fixed: "固定数值" } }) +
      field(armor.mode === "percent" ? "远程伤害抵挡（%）" : "每次远程伤害抵挡", path + ".mechanics.rangedReduction.value", { type: "number", min: 0, max: armor.mode === "percent" ? 100 : 100000, step: "any" }) : ""}
    </div><p class="hint">抵挡弓箭、火枪、弩和法杖英雄的普通攻击及其溅射伤害。先结算通用减伤，再扣除此处的固定值或百分比，最低降至 0；实际抵挡伤害时显示「抵挡」。近战、战斗牌、随从和炮台伤害不受影响。</p></div>`;
}
