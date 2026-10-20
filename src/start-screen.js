import "./start-screen.css";

export class StartScreen {
  constructor({ icons, onReveal, onStart }) {
    this.element = document.getElementById("start-screen");
    this.veil = document.getElementById("scene-transition");
    this.start = document.getElementById("new-game");
    this.exit = document.getElementById("exit-game");
    this.status = document.getElementById("menu-status");
    this.state = "menu";
    this.showingOcean = true;
    this.onReveal = onReveal;
    this.onStart = onStart;
    this.hud = document.querySelector(".hud");
    this.arena = document.getElementById("arena");
    this.hud.inert = this.arena.inert = true;
    for (const img of this.element.querySelectorAll("[data-menu-icon]")) {
      img.src = icons[img.dataset.menuIcon];
    }
    this.start.onclick = () => this.begin();
    this.exit.onclick = () => {
      window.close();
      // Browsers can only close tabs they allow scripts to close.
      this.status.textContent = "请关闭此标签页以退出游戏";
    };
    window.addEventListener("keydown", event => {
      if (!this.blocking) return;
      event.stopImmediatePropagation();
      if (this.state !== "menu" || !["Tab", "Enter", "Space"].includes(event.code)) event.preventDefault();
    }, true);
    this.start.focus({ preventScroll: true });
  }
  get blocking() { return this.state !== "playing"; }
  async fade(from, to, duration) {
    const animation = this.veil.animate([{ opacity: from }, { opacity: to }], {
      duration, easing: "ease-in-out", fill: "forwards",
    });
    await animation.finished.catch(() => {});
    this.veil.style.opacity = String(to);
    animation.cancel();
  }
  async begin() {
    if (this.state !== "menu") return;
    this.state = "transition";
    this.start.disabled = this.exit.disabled = true;
    this.element.inert = true;
    this.veil.hidden = false;
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 600;
    await this.fade(0, 1, duration);
    this.showingOcean = false;
    this.element.hidden = true;
    document.body.classList.remove("at-title");
    this.onReveal();
    // Commit the first battlefield frame while the screen is fully covered.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await this.fade(1, 0, duration);
    this.veil.hidden = true;
    this.state = "playing";
    this.hud.inert = this.arena.inert = false;
    this.onStart();
    if (!document.querySelector("dialog[open]")) document.getElementById("start").focus({ preventScroll: true });
  }
}
