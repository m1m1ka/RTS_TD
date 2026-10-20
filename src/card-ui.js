import { heroRarityClass, heroRoleLabel } from "./hero-grades.js";
import { RewardUI } from "./reward-ui.js";
import { cards, cardTypes } from "./cards.js";
import { CardAim } from "./card-aim.js";
import { iconURL } from "./config/icons.js";
import { escapeHTML } from "./config/schema.js";
import { getConfigRevision } from "./config/store.js";
import { HeroTagTooltip } from "./hero-tag-tooltip.js";

export class CardUI {
  constructor({ game, onAim, onDrop, onSelect, canInteract }) {
    Object.assign(this, {
      game,
      onAim,
      onDrop,
      onSelect,
      canInteract,
    });
    this.activeKey = null;
    this.activeSlot = null;
    this.signature = "";
    this.tagTooltip = new HeroTagTooltip(game);
    this.drag = null;
    this.aim = new CardAim();
    this.hand = document.getElementById("hand");
    this.reward = document.getElementById("reward-dialog");
    document.getElementById("hand-prev").onclick = () =>
      this.hand.scrollBy({ left: -300, behavior: "smooth" });
    document.getElementById("hand-next").onclick = () =>
      this.hand.scrollBy({ left: 300, behavior: "smooth" });
    this.hand.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.hand.scrollLeft += e.deltaY || e.deltaX;
      },
      { passive: false },
    );
    this.hand.addEventListener("pointerdown", (e) => {
      const b = e.target.closest("[data-card]");
      if (!b || b.disabled || !this.canInteract() || e.button !== 0) return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      this.drag = {
        key: b.dataset.card,
        slot: b.dataset.handSlot,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        button: b,
        pointerId: e.pointerId,
      };
    });
    this.hand.addEventListener("pointermove", (e) => {
      const d = this.drag;
      if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
        d.moved = true;
        this.select(d.key, d.slot);
        d.button.classList.add("aiming");
      }
      if (d.moved) {
        d.pointer = { clientX: e.clientX, clientY: e.clientY };
        this.updateAim();
      }
    });
    this.hand.addEventListener("pointerup", (e) => {
      const d = this.drag;
      if (!d) return;
      this.endDrag();
      if (d.moved) {
        if (
          e.clientY <
            document.getElementById("card-hud").getBoundingClientRect().top &&
          this.canInteract()
        ) {
          this.onDrop(d.key, e, d.slot);
        }
        this.cancel();
      } else this.select(this.activeSlot === d.slot ? null : d.key, d.slot);
      this.render();
    });
    this.hand.addEventListener("pointercancel", () => this.cancel());
    this.hand.addEventListener("lostpointercapture", () => {
      if (this.drag) this.cancel();
    });
    window.addEventListener("blur", () => {
      if (this.drag) this.cancel();
    });
    window.addEventListener("resize", () => {
      if (this.drag) this.cancel();
    });
    this.hand.addEventListener("keydown", (e) => {
      const b = e.target.closest("[data-card]");
      if (b && !b.disabled && this.canInteract() && ["Enter", " "].includes(e.key)) {
        e.preventDefault();
        this.select(b.dataset.card, b.dataset.handSlot);
      }
    });
    this.rewardChoice = new RewardUI(game, () => { this.cancel(); this.render(); });
    this.render();
  }
  art(key) {
    const c = cards[key];
    return `<img src="${iconURL(c.icon, true)}" alt="" draggable="false">`;
  }
  select(key, slot = null) {
    if (key && this.hand.querySelector(`[data-hand-slot="${slot}"]`)?.disabled) return;
    this.activeKey = key;
    this.activeSlot = key ? slot || this.hand.querySelector(`[data-card="${key}"]`)?.dataset.handSlot : null;
    this.hand.querySelectorAll("[data-card]").forEach((b) => {
      const selected = b.dataset.handSlot === this.activeSlot;
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
    this.onSelect(key);
  }
  cancel() {
    this.endDrag();
    this.select(null);
    this.onAim(null);
  }
  endDrag() {
    const d = this.drag;
    this.drag = null;
    this.aim.hide();
    d?.button.classList.remove("aiming");
    if (d?.button.hasPointerCapture(d.pointerId))
      d.button.releasePointerCapture(d.pointerId);
  }
  updateAim() {
    const d = this.drag;
    if (!d?.moved || !d.pointer) return;
    const onField =
      d.pointer.clientY <
      document.getElementById("card-hud").getBoundingClientRect().top;
    const valid =
      this.onAim(d.pointer) === true && onField && this.canInteract();
    this.aim.update(d.button, d.pointer, valid);
  }
  render() {
    if (this.drag) {
      if (!this.canInteract()) this.cancel();
      else {
        this.updateAim();
        return;
      }
    }
    const skills = this.game.syncSkillCards();
    const sig = JSON.stringify(skills.map(c => [c.id, c.cardId, c.tier])) + getConfigRevision() + JSON.stringify([this.game.cards, this.game.heroReserve.map((h) => [h.cardId, h.level]), this.game.heroes.map(h => [h.cardId, h.hp > 0, h.destroyed])]);
    if (sig !== this.signature) {
      this.signature = sig;
      this.hand.innerHTML =
        Object.entries(this.game.cards)
          .filter(([, n]) => n > 0)
          .flatMap(([key, count]) => cards[key].category === "battle"
            ? skills.filter(c => c.cardId === key).map((skill, copy) => ({ key, count: 1, copy, skill }))
            : cards[key].category === "hero"
            ? Array.from({ length: count }, (_, copy) => ({ key, count: 1, copy }))
            : [{ key, count, copy: 0 }])
          .map(({ key: k, count: n, copy, skill }, i, hand) => {
            const c = this.game.cardDefinition(k, skill?.id);
            const slot = skill?.id || `${k}:${copy}`;
            const selected = this.activeSlot === slot;
            const deployed = c.category === "hero" && this.game.heroes.find(h => h.cardId === k && !h.destroyed);
            const reserve = this.game.heroReserve.filter(h => h.cardId === k)[copy];
            const heroHint = deployed ? (deployed.hp > 0 ? "对同名英雄使用 · 等级 +3" : "等待英雄复活后升级 +3") : "部署英雄 · 重复牌可升级 +3";
            const spread =
              hand.length < 2 ? 0 : (i / (hand.length - 1) - 0.5) * 2;
            const label =
              cardTypes[c.category] +
              "牌 · " + (c.temporary ? "临时" : {
                hero: `Lv.${this.game.heroReserve.find((h) => h.cardId === k)?.level ?? 1} · 部署`,
                resource: "消耗",
                battle: `${skill?.tier} 阶 · CD ${c.cooldown} 秒`,
                equipment: "装备",
              }[c.category]);
            const description = escapeHTML(deployed ? heroHint : c.text)
              .replace(/ · /g, "<br>")
              .replace(/([+]?\d+(?:%)?)/g, "<em>$1</em>");
            return `<button class="hand-card ${c.category} ${heroRarityClass(c)} ${selected ? "selected" : ""}" style="--tilt:${spread * 4}deg;--arc:${Math.abs(spread) * 7}px" ${c.category === "hero" ? `data-hero-card="${k}"` : ""} data-card="${k}" data-hand-slot="${slot}" aria-label="${escapeHTML(c.name)}，${escapeHTML(c.category === "hero" ? heroHint : c.text)}，${c.category === "hero" ? `第${copy + 1}张` : `持有${n}张`}" title="${escapeHTML(c.text)} · ${c.category === "hero" ? heroHint : `持有 ${n} 张`}" aria-pressed="${selected}">${["hero", "battle"].includes(c.category) ? "" : `<b class="card-count" aria-hidden="true">×${n}</b>`}<strong class="card-title">${escapeHTML(c.name)}</strong><div class="card-picture">${this.art(k)}${c.category === "hero" ? `<b class="hero-card-level">Lv.${reserve?.level ?? 1}</b>` : ""}</div><span class="card-kind">${c.category === "hero" ? heroRoleLabel(c) : label}</span><small class="card-description">${description}</small>${skill ? `<span class="skill-cooldown" hidden><b></b><small>冷却中</small></span>` : ""}<span class="card-flourish" aria-hidden="true">◆</span></button>`;
          })
          .join("") || '<span class="empty-hand">暂无卡牌</span>';
    }
    for (const copy of skills) {
      const button = this.hand.querySelector(`[data-hand-slot="${copy.id}"]`);
      if (!button) continue;
      const remaining = Math.max(0, copy.readyAt - this.game.time);
      const cooling = remaining > 1e-9;
      button.disabled = cooling;
      button.classList.toggle("cooling", cooling);
      button.style.setProperty("--cooldown-progress", `${Math.min(100, remaining / (copy.cooldown || 1) * 100)}%`);
      const overlay = button.querySelector(".skill-cooldown");
      overlay.hidden = !cooling;
      overlay.querySelector("b").textContent = `${Math.ceil(remaining)}s`;
      const card = this.game.cardDefinition(copy.cardId, copy.id);
      button.setAttribute("aria-label", `${card.name}，${copy.tier} 阶，${cooling ? `冷却剩余 ${Math.ceil(remaining)} 秒` : "可使用"}，${card.text}`);
      if (cooling && this.activeSlot === copy.id) this.cancel();
    }
    if (this.activeSlot && ![...this.hand.querySelectorAll("[data-hand-slot]")].some(b => b.dataset.handSlot === this.activeSlot)) this.cancel();
    const overflow = this.hand.scrollWidth > this.hand.clientWidth + 2;
    this.hand.classList.toggle("overflowing", overflow);
    for (const id of ["hand-prev", "hand-next"])
      document.getElementById(id).style.visibility = overflow
        ? "visible"
        : "hidden";
    if (this.game.phase === "reward") { if (!this.reward.open) this.cancel(); this.rewardChoice.update(); }
  }

  reset() {
    this.cancel();
    this.rewardChoice.reset();
    this.signature = "";
    this.render();
  }
}
