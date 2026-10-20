import { debugGenerateCard, debugLevelHero, debugJumpToDay } from "./debug-actions.js";
import { escapeHTML as esc } from "./config/schema.js";
import { cardTypes } from "./cards.js";
import "./debug-console.css";

export class DebugConsole {
  constructor(game, onChange, onOpen, onJump = () => {}) {
    Object.assign(this, { game, onChange, onOpen });
    this.dialog = document.createElement("dialog");
    this.dialog.id = "debug-console";
    this.dialog.setAttribute("aria-label", "测试控制台");
    this.dialog.innerHTML = `<header><h2>测试控制台</h2><button type="button" data-debug-close aria-label="关闭测试控制台">×</button></header>
      <p class="debug-note">F2 开关 · 打开时暂停战斗 · 操作仅影响本局，不改初始配置</p>
      <section><h3>生成卡牌</h3><label>卡牌<select id="debug-card"></select></label>
        <label>数量<input id="debug-card-count" type="number" min="1" max="99" step="1" value="1"></label>
        <button type="button" data-debug-generate>生成到手牌</button></section>
      <section><h3>英雄升级</h3><label>已部署英雄<select id="debug-hero"></select></label>
        <label>提升等级<input id="debug-levels" type="number" min="1" max="999" step="1" value="1"></label>
        <button type="button" data-debug-level>提升等级</button></section>
      <section><h3>跳转关卡</h3><label>指定关卡<select id="debug-day"></select></label>
        <button type="button" data-debug-jump>跳转到此关</button>
        <p class="debug-note">保留金币、手牌和英雄成长；重置当前战斗，不发放跳过关卡的奖励。</p></section>
      <section><h3>CRT 画面</h3>
        <label>扫描线密度（每 100 像素）<output id="debug-density-value">33.3</output><input id="debug-density" type="range" min="5" max="50" step=".1" value="33.3"></label>
        <label>扫描线宽度（像素）<output id="debug-width-value">1</output><input id="debug-width" type="range" min=".1" max="3" step=".1" value="1"></label>
        <label>扫描线强度<output id="debug-opacity-value">0.137</output><input id="debug-opacity" type="range" min="0" max=".5" step=".001" value=".137"></label>
        <button type="button" data-debug-reset-crt>恢复默认画面</button></section>
      <p id="debug-result" role="status"></p>`;
    document.body.append(this.dialog);
    document.getElementById("debug-toggle")?.addEventListener("click", () => this.toggle());
    document.addEventListener("keydown", e => {
      if (e.code !== "F2") return;
      e.preventDefault(); this.toggle();
    }, true);
    this.dialog.addEventListener("click", e => {
      if (e.target.closest("[data-debug-jump]")) {
        if (debugJumpToDay(game, this.$("debug-day").value)) {
          this.dialog.close(); onJump(); onChange();
        } else this.result("关卡不存在，请重新选择。");
      }
      if (e.target.closest("[data-debug-close]")) this.dialog.close();
      if (e.target.closest("[data-debug-generate]")) {
        const key = this.$("debug-card").value;
        const ok = debugGenerateCard(game, key, Number(this.$("debug-card-count").value));
        this.result(ok ? `已获得 ${game.config.cards[key].name}` : "请选择有效卡牌和数量（1～99，持有上限 999）。");
        if (ok) onChange();
      }
      if (e.target.closest("[data-debug-level]")) {
        const ok = debugLevelHero(game, Number(this.$("debug-hero").value), Number(this.$("debug-levels").value));
        this.result(ok ? "等级与阶数已更新" : "请选择已部署英雄；提升等级为 1～999，总等级不超过 9999。");
        if (ok) { this.refresh(); onChange(); }
      }
      if (e.target.closest("[data-debug-reset-crt]")) {
        for (const [key, value] of [["density",33.3],["width",1],["opacity",.137]]) this.$("debug-"+key).value = value;
        for (const name of ["period","width","opacity"]) document.documentElement.style.removeProperty("--crt-scan-"+name);
        this.updateLabels(); this.result("已恢复默认 CRT 参数");
      }
    });
    this.dialog.addEventListener("input", e => {
      if (!["debug-density","debug-width","debug-opacity"].includes(e.target.id)) return;
      const period = 100 / Number(this.$("debug-density").value);
      const width = Math.min(Number(this.$("debug-width").value), period * .9);
      this.$("debug-width").value = width.toFixed(1);
      const style = document.documentElement.style;
      style.setProperty("--crt-scan-period", period+"px");
      style.setProperty("--crt-scan-width", width+"px");
      style.setProperty("--crt-scan-opacity", this.$("debug-opacity").value);
      this.updateLabels();
    });
  }
  $(id) { return this.dialog.querySelector("#"+id); }
  result(text) { this.$("debug-result").textContent = text; }
  updateLabels() { for (const key of ["density","width","opacity"]) this.$(`debug-${key}-value`).textContent = this.$("debug-"+key).value; }
  refresh() {
    const day = this.$("debug-day");
    day.innerHTML = this.game.config.days.map((d, i) => `<option value="${esc(d.id)}">${i + 1} · ${d.kind === "shop" ? "商店" : "战斗"} · ${esc(d.name || d.id)} (${esc(d.id)})</option>`).join("");
    day.value = this.game.config.days[this.game.day].id;
    const card = this.$("debug-card"), hero = this.$("debug-hero"), oldCard = card.value, oldHero = hero.value;
    card.innerHTML = Object.entries(this.game.config.cards).map(([key,c]) => `<option value="${esc(key)}">${esc(c.name)} · ${cardTypes[c.category]} · ${esc(key)}</option>`).join("");
    if (this.game.config.cards[oldCard]) card.value = oldCard;
    const heroes = this.game.heroes.filter(h => !h.destroyed);
    hero.innerHTML = heroes.length ? heroes.map(h => `<option value="${h.id}">${esc(h.name)} · Lv.${h.level} · ${h.rank || 0} 阶${h.hp <= 0 ? " · 阵亡" : ""}</option>`).join("") : '<option value="">暂无已部署英雄</option>';
    if (heroes.some(h => String(h.id) === oldHero)) hero.value = oldHero;
    this.dialog.querySelector("[data-debug-level]").disabled = !heroes.length;
  }
  toggle() {
    if (this.dialog.open) { this.dialog.close(); return; }
    this.onOpen(); this.refresh(); this.result(""); this.dialog.showModal();
  }
}
