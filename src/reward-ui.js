import { heroRarityClass, heroRoleLabel, heroGradeLabel } from "./hero-grades.js";
import { iconURL } from "./config/icons.js";
import { escapeHTML as esc } from "./config/schema.js";
import { cardTypes } from "./cards.js";
export class RewardUI {
  constructor(game, onDone) {
    Object.assign(this, { game, onDone, dialog: document.getElementById("reward-dialog"), signature: "", selected: new Set(), busy: false, token: 0 });
    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.dialog.addEventListener("cancel", e => e.preventDefault());
    this.dialog.addEventListener("click", e => {
      if (this.busy) return;
      const button = e.target.closest("[data-reward]");
      if (button) {
        const index = Number(button.dataset.reward);
        if (this.selected.has(index)) this.selected.delete(index);
        else if (this.pickCount === 1) { this.selected.clear(); this.selected.add(index); }
        else if (this.selected.size < this.pickCount) this.selected.add(index);
        this.updateSelection();
      } else if (e.target.closest("[data-reward-confirm]")) this.claim();
    });
  }
  get initial() { return this.game.phase === "initialDraft"; }
  get pickCount() { return this.initial ? 2 : 1; }
  get options() { return this.initial ? this.game.initialHandOptions : this.game.rewardOptions; }
  fit() {
    const content = this.dialog.querySelector(".reward-content");
    if (!this.dialog.open || !content) return;
    this.scale = Math.min(1, (this.dialog.clientHeight - 24) / Math.max(1, content.offsetHeight));
    content.style.transform = `scale(${this.scale})`;
  }
  updateSelection() {
    for (const b of this.dialog.querySelectorAll("[data-reward]")) {
      const selected = this.selected.has(Number(b.dataset.reward));
      b.classList.toggle("picked", selected); b.setAttribute("aria-pressed", String(selected));
      b.classList.toggle("dimmed", !selected && this.selected.size === this.pickCount);
    }
    const confirm = this.dialog.querySelector("[data-reward-confirm]");
    confirm.disabled = this.selected.size !== this.pickCount || this.busy;
    confirm.textContent = this.busy ? "收入囊中…" : `收下 ${this.selected.size} / ${this.pickCount}`;
  }
  update() {
    if (!["initialDraft", "reward"].includes(this.game.phase)) return;
    const signature = JSON.stringify([this.game.phase, this.initial ? this.game.initialDraftVersion : null, this.options.map(key => [key, this.game.config.cards[key]])]);
    if (this.dialog.open && signature === this.signature) return;
    this.reset(); this.signature = signature;
    this.dialog.classList.toggle("initial-hand-draft", this.initial);
    this.dialog.setAttribute("aria-label", this.initial ? "初始手牌五选二" : "卡牌奖励三选一");
    this.dialog.innerHTML = `<div class="reward-content"><header class="reward-heading"><h2>${this.initial ? "启程手牌" : "战利品"}</h2><p>${this.initial ? "五选二" : "三选一"}</p></header><div class="reward-draft">${this.options.map((key, i) => {
      const card = this.game.config.cards[key];
      return `<div class="reward-deal" style="--deal:${i}"><button class="hand-card reward-card ${card.category} ${heroRarityClass(card)}" ${card.category === "hero" ? `data-hero-card="${key}"` : ""} data-reward="${i}" aria-pressed="false" aria-label="${esc(card.name)}：${esc(card.text)}"><strong class="card-title">${esc(card.name)}</strong><div class="card-picture">${card.category === "hero" ? '<b class="hero-card-level">Lv.1</b>' : ""}<img src="${iconURL(card.icon, true)}" alt="" draggable="false"></div><span class="card-kind">${heroRoleLabel(card) || cardTypes[card.category] + "牌"}</span><small class="card-description">${esc(card.text)}</small><span class="reward-tick">✓</span><span class="card-flourish">◆</span></button></div>`;
    }).join("")}</div><button data-reward-confirm disabled>收下 0 / ${this.pickCount}</button></div>`;
    this.dialog.showModal();
    this.fit();
    this.resizeObserver.observe(this.dialog);
    this.resizeObserver.observe(this.dialog.querySelector(".reward-content"));
  }
  async claim() {
    if (this.busy || this.selected.size !== this.pickCount) return;
    const initial = this.initial, version = this.game.initialDraftVersion;
    this.busy = true; this.updateSelection();
    const token = ++this.token, selected = [...this.selected], reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animations = [...this.dialog.querySelectorAll(".reward-deal")].map((element, i) => {
      const chosen = this.selected.has(i), rect = element.getBoundingClientRect();
      return element.animate(chosen ? [
        { transform: "translateY(0) scale(1)", opacity: 1 },
        { transform: "translateY(-25px) scale(1.08)", opacity: 1, offset: .25 },
        { transform: `translate(${(innerWidth / 2 - rect.x - rect.width / 2) / this.scale}px, ${(innerHeight - rect.y) / this.scale}px) rotate(${i % 2 ? 12 : -12}deg) scale(.2)`, opacity: 0 },
      ] : [{ transform: "scale(1)", opacity: 1 }, { transform: `translateY(45px) rotate(${i % 2 ? 8 : -8}deg) scale(.75)`, opacity: 0 }], { duration: reduced ? 80 : chosen ? 680 : 300, easing: "cubic-bezier(.3,.05,.2,1)", fill: "forwards" });
    });
    await Promise.all(animations.map(a => a.finished.catch(() => {})));
    if (token !== this.token) return;
    if (initial ? this.game.chooseInitialHand(selected, version) : this.game.chooseReward(selected)) { this.reset(); this.onDone(); }
    else { this.signature = ""; this.busy = false; this.update(); }
  }
  reset() {
    this.resizeObserver.disconnect();
    this.token++; this.busy = false; this.selected.clear(); this.signature = "";
    for (const animation of this.dialog.getAnimations({ subtree: true })) animation.cancel();
    this.dialog.close();
  }
}
