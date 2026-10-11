import { cards, cardTypes } from "./cards.js";
import { CardAim } from "./card-aim.js";
import { iconURL } from "./config/icons.js";
import { escapeHTML } from "./config/schema.js";
import { getConfigRevision } from "./config/store.js";

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
    this.signature = "";
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
      if (!b || !this.canInteract() || e.button !== 0) return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      this.drag = {
        key: b.dataset.card,
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
        this.select(d.key);
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
          if (this.onDrop(d.key, e)) this.cancel();
        }
        this.onAim(null);
      } else this.select(this.activeKey === d.key ? null : d.key);
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
      if (b && ["Enter", " "].includes(e.key)) {
        e.preventDefault();
        this.select(b.dataset.card);
      }
    });
    this.reward.addEventListener("cancel", (e) => e.preventDefault());
    this.reward.addEventListener("click", (e) => {
      const b = e.target.closest("[data-reward]");
      if (b && this.game.chooseReward(Number(b.dataset.reward))) {
        this.reward.close();
        this.cancel();
        this.render();
      }
    });
    this.render();
  }
  art(key) {
    const c = cards[key];
    return `<img src="${iconURL(c.icon, true)}" alt="" draggable="false">`;
  }
  select(key) {
    this.activeKey = key;
    this.hand.querySelectorAll("[data-card]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.card === key);
      b.setAttribute("aria-pressed", String(b.dataset.card === key));
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
    const sig = getConfigRevision() + JSON.stringify(this.game.cards);
    if (sig !== this.signature) {
      this.signature = sig;
      this.hand.innerHTML =
        Object.entries(this.game.cards)
          .filter(([, n]) => n > 0)
          .map(([k, n], i, hand) => {
            const c = cards[k];
            const spread =
              hand.length < 2 ? 0 : (i / (hand.length - 1) - 0.5) * 2;
            const label =
              cardTypes[c.category] +
              "牌 · " +
              {
                hero: "部署",
                resource: "消耗",
                battle: "消耗",
                equipment: "装备",
              }[c.category];
            const description = escapeHTML(c.text)
              .replace(/ · /g, "<br>")
              .replace(/([+]?\d+(?:%)?)/g, "<em>$1</em>");
            return `<button class="hand-card ${c.category} ${this.activeKey === k ? "selected" : ""}" style="--tilt:${spread * 4}deg;--arc:${Math.abs(spread) * 7}px" data-card="${k}" aria-label="${escapeHTML(c.name)}，${escapeHTML(c.text)}，持有${n}张" title="${escapeHTML(c.text)} · 持有 ${n} 张" aria-pressed="${this.activeKey === k}"><b class="card-count" aria-hidden="true"><span>×</span>${n}</b><strong class="card-title">${escapeHTML(c.name)}</strong><div class="card-picture">${this.art(k)}</div><span class="card-kind">${label}</span><small class="card-description">${description}</small><span class="card-flourish" aria-hidden="true">◆</span></button>`;
          })
          .join("") || '<span class="empty-hand">暂无卡牌</span>';
    }
    document.getElementById("cards-total").textContent = Object.values(
      this.game.cards,
    ).reduce((a, b) => a + b, 0);
    const overflow = this.hand.scrollWidth > this.hand.clientWidth + 2;
    this.hand.classList.toggle("overflowing", overflow);
    for (const id of ["hand-prev", "hand-next"])
      document.getElementById(id).style.visibility = overflow
        ? "visible"
        : "hidden";
    if (this.game.phase === "reward" && !this.reward.open) {
      this.cancel();
      this.reward.innerHTML = `<div class="reward-crest">✦</div><h2>守住了！</h2><p>选择一组补给</p><div class="reward-packs">${this.game.rewardOptions
        .map(
          (p, i) =>
            `<button class="reward-pack ${p.theme}" data-reward="${i}"><span class="pack-seal">${["⇧", "ϟ", "✦"][i]}</span><h3>${escapeHTML(p.name)}</h3><div class="pack-cards">${Object.entries(
              p.cards,
            )
              .map(
                ([k, n]) =>
                  `<div class="pack-card ${cards[k].category}">${this.art(k)}<span>${escapeHTML(cards[k].name)}</span><b>×${n}</b></div>`,
              )
              .join(
                "",
              )}</div><span class="pack-claim">收下这组</span></button>`,
        )
        .join("")}</div>`;
      this.reward.showModal();
    }
  }
  reset() {
    this.cancel();
    this.reward.close();
    this.signature = "";
    this.render();
  }
}
