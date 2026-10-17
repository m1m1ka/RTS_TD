import { heroRarityClass, heroGradeLabel } from "./hero-grades.js";
import { iconURL } from "./config/icons.js";
import { escapeHTML as esc } from "./config/schema.js";
import { cardTypes } from "./cards.js";
export class RewardUI {
  constructor(game, onDone) {
    Object.assign(this, { game, onDone, dialog: document.getElementById("reward-dialog"), signature: "", selected: new Set(), busy: false, token: 0 });
    this.dialog.addEventListener("cancel", e => e.preventDefault());
    this.dialog.addEventListener("click", e => {
      if (this.busy) return;
      const button = e.target.closest("[data-reward]");
      if (button) {
        const index = Number(button.dataset.reward);
        if (this.selected.has(index)) this.selected.delete(index);
        else if (this.selected.size < 2) this.selected.add(index);
        this.updateSelection();
      } else if (e.target.closest("[data-reward-confirm]")) this.claim();
    });
  }
  updateSelection() {
    for (const b of this.dialog.querySelectorAll("[data-reward]")) {
      const selected = this.selected.has(Number(b.dataset.reward));
      b.classList.toggle("picked", selected); b.setAttribute("aria-pressed", String(selected));
      b.classList.toggle("dimmed", !selected && this.selected.size === 2);
    }
    const confirm = this.dialog.querySelector("[data-reward-confirm]");
    confirm.disabled = this.selected.size !== 2 || this.busy;
    confirm.textContent = this.busy ? "收入囊中…" : `收下 ${this.selected.size} / 2`;
  }
  update() {
    if (this.game.phase !== "reward") return;
    const signature = JSON.stringify(this.game.rewardOptions.map(key => [key, this.game.config.cards[key]]));
    if (this.dialog.open && signature === this.signature) return;
    this.reset(); this.signature = signature;
    this.dialog.innerHTML = `<div class="reward-crest">✦</div><h2>挑选战利品</h2><p>五选二</p><div class="reward-draft">${this.game.rewardOptions.map((key, i) => {
      const card = this.game.config.cards[key];
      return `<div class="reward-deal" style="--deal:${i}"><button class="hand-card reward-card ${card.category} ${heroRarityClass(card)}" data-reward="${i}" aria-pressed="false" aria-label="${esc(card.name)}：${esc(card.text)}"><strong class="card-title">${esc(card.name)}</strong><div class="card-picture"><img src="${iconURL(card.icon, true)}" alt="" draggable="false"></div><span class="card-kind">${heroGradeLabel(card) || cardTypes[card.category] + "牌"}</span><small class="card-description">${esc(card.text)}</small><span class="reward-tick">✓</span><span class="card-flourish">◆</span></button></div>`;
    }).join("")}</div><button data-reward-confirm disabled>收下 0 / 2</button>`;
    this.dialog.showModal();
  }
  async claim() {
    if (this.busy || this.selected.size !== 2) return;
    this.busy = true; this.updateSelection();
    const token = ++this.token, selected = [...this.selected], reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animations = [...this.dialog.querySelectorAll(".reward-deal")].map((element, i) => {
      const chosen = this.selected.has(i), rect = element.getBoundingClientRect();
      return element.animate(chosen ? [
        { transform: "translateY(0) scale(1)", opacity: 1 },
        { transform: "translateY(-25px) scale(1.08)", opacity: 1, offset: .25 },
        { transform: `translate(${innerWidth / 2 - rect.x - rect.width / 2}px, ${innerHeight - rect.y}px) rotate(${i % 2 ? 12 : -12}deg) scale(.2)`, opacity: 0 },
      ] : [{ transform: "scale(1)", opacity: 1 }, { transform: `translateY(45px) rotate(${i % 2 ? 8 : -8}deg) scale(.75)`, opacity: 0 }], { duration: reduced ? 80 : chosen ? 680 : 300, easing: "cubic-bezier(.3,.05,.2,1)", fill: "forwards" });
    });
    await Promise.all(animations.map(a => a.finished.catch(() => {})));
    if (token !== this.token) return;
    if (this.game.chooseReward(selected)) { this.reset(); this.onDone(); }
    else { this.signature = ""; this.busy = false; this.update(); }
  }
  reset() {
    this.token++; this.busy = false; this.selected.clear(); this.signature = "";
    for (const animation of this.dialog.getAnimations({ subtree: true })) animation.cancel();
    this.dialog.close();
  }
}
