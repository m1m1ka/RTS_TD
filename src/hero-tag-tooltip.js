import { HERO_TAGS } from "./hero-tags.js";
import "./hero-tag-tooltip.css";

export class HeroTagTooltip {
  constructor(game) {
    this.game = game;
    this.panel = document.createElement("div");
    this.panel.id = "hero-tag-tooltip";
    this.panel.className = "hero-tag-tooltip";
    this.panel.setAttribute("role", "tooltip");
    this.panel.setAttribute("popover", "manual");
    this.panel.hidden = true;
    document.body.append(this.panel);
    document.addEventListener("pointerover", e => {
      const card = e.target.closest?.("[data-hero-card]");
      if (e.pointerType !== "touch" && card && !card.contains(e.relatedTarget)) this.show(card);
    });
    document.addEventListener("pointerout", e => {
      if (this.anchor?.contains(e.target) && !this.anchor.contains(e.relatedTarget)) this.dismissTimer = setTimeout(() => this.hide(), 150);
    });
    this.panel.addEventListener("pointerenter", () => clearTimeout(this.dismissTimer));
    this.panel.addEventListener("pointerleave", () => this.hide());
    document.addEventListener("focusin", e => {
      const card = e.target.closest?.("[data-hero-card]");
      if (card) this.show(card);
    });
    document.addEventListener("focusout", e => { if (this.anchor?.contains(e.target)) this.hide(); });
    document.addEventListener("pointerdown", e => { if (!this.panel.contains(e.target)) this.hide(); }, true);
    document.addEventListener("keydown", e => { if (e.key === "Escape") this.hide(); });
    window.addEventListener("blur", () => this.hide());
    window.addEventListener("resize", () => this.hide());
    document.addEventListener("scroll", e => { if (!this.panel.contains(e.target)) this.hide(); }, true);
  }
  show(anchor) {
    this.hide();
    const card = this.game.config.cards[anchor.dataset.heroCard];
    if (card?.category !== "hero" || !card.tags?.length) return;
    for (const tag of card.tags) {
      if (!HERO_TAGS[tag]) continue;
      const section = document.createElement("section"), title = document.createElement("strong"), body = document.createElement("p");
      title.textContent = HERO_TAGS[tag];
      body.textContent = this.game.config.initial.heroTagDescriptions[tag];
      section.append(title, body); this.panel.append(section);
    }
    if (!this.panel.children.length) return;
    this.anchor = anchor;
    this.oldDescription = anchor.getAttribute("aria-describedby");
    this.oldTitle = anchor.getAttribute("title");
    anchor.removeAttribute("title"); // Avoid overlapping native browser tooltips.
    anchor.setAttribute("aria-describedby", [this.oldDescription, this.panel.id].filter(Boolean).join(" "));
    this.panel.hidden = false;
    // The top layer also places explanations above modal reward/shop dialogs.
    if (this.panel.showPopover) this.panel.showPopover();
    else (anchor.closest("dialog") || document.body).append(this.panel);
    const position = () => {
      if (!anchor.isConnected || !anchor.getClientRects().length || (anchor.closest("dialog") && !anchor.closest("dialog").open)) { this.hide(); return; }
      const rect = anchor.getBoundingClientRect(), box = this.panel.getBoundingClientRect();
      const left = Math.max(8, Math.min(innerWidth - box.width - 8, rect.left + (rect.width - box.width) / 2));
      let top = rect.top - box.height - 10;
      if (top < 8) top = Math.min(rect.bottom + 10, innerHeight - box.height - 8);
      this.panel.style.left = `${left}px`;
      this.panel.style.top = `${Math.max(8, top)}px`;
      this.frame = requestAnimationFrame(position);
    };
    position();
  }
  hide() {
    clearTimeout(this.dismissTimer);
    cancelAnimationFrame(this.frame);
    if (this.anchor) {
      if (this.oldDescription === null) this.anchor.removeAttribute("aria-describedby");
      else this.anchor.setAttribute("aria-describedby", this.oldDescription);
      if (this.oldTitle !== null) this.anchor.setAttribute("title", this.oldTitle);
    }
    this.anchor = null;
    if (this.panel.hidePopover && this.panel.matches(":popover-open")) this.panel.hidePopover();
    this.panel.hidden = true;
    this.panel.replaceChildren();
  }
}
