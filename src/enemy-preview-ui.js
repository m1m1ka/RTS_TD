import { upcomingLandings } from "./enemy-preview.js";
import { iconURL } from "./config/icons.js";
import "./enemy-preview.css";

export class EnemyPreviewUI {
  constructor(game, project) {
    this.game = game; this.project = project; this.items = []; this.elapsed = 1;
    this.root = document.createElement("div");
    this.root.className = "enemy-previews";
    this.root.setAttribute("aria-label", "即将登陆的敌人");
    this.tip = document.createElement("div");
    this.tip.className = "enemy-preview-tip"; this.tip.id = "enemy-preview-tip";
    this.tip.setAttribute("role", "tooltip"); this.tip.hidden = true;
    document.body.append(this.root, this.tip);
    document.addEventListener("keydown", e => { if (e.key === "Escape") this.hide(); });
    window.addEventListener("blur", () => this.hide());
  }
  hide() {
    this.anchor?.removeAttribute("aria-describedby");
    this.anchor = null; this.tip.hidden = true;
  }
  show(button, enemy) {
    this.hide(); this.anchor = button;
    const spec = this.game.config.enemies[enemy.type];
    const title = document.createElement("strong"), description = document.createElement("p");
    title.textContent = `${spec.name} × ${enemy.count}`;
    description.textContent = spec.description?.trim() || "暂无敌人类型描述";
    this.tip.replaceChildren(title, description);
    button.setAttribute("aria-describedby", this.tip.id);
    this.tip.hidden = false; this.positionTip();
  }
  positionTip() {
    if (!this.anchor) return;
    const a = this.anchor.getBoundingClientRect(), b = this.tip.getBoundingClientRect();
    this.tip.style.left = `${Math.max(8, Math.min(innerWidth - b.width - 8, a.x + a.width / 2 - b.width / 2))}px`;
    this.tip.style.top = `${Math.max(8, a.y - b.height - 10)}px`;
  }
  update(dt) {
    this.elapsed += dt;
    // Rebuild only when pending crews, terrain, or edited descriptions change.
    if (this.elapsed >= .1 || this.phase !== this.game.phase) {
      this.elapsed = 0; this.phase = this.game.phase;
      const groups = upcomingLandings(this.game);
      const signature = JSON.stringify(groups.map(g => [g, g.enemies.map(e => this.game.config.enemies[e.type])]));
      if (signature !== this.signature) {
        this.signature = signature; this.hide(); this.root.replaceChildren(); this.items = [];
        for (const group of groups) {
          const row = document.createElement("div"); row.className = "enemy-preview-group";
          row.dataset.landing = `${group.gate.x},${group.gate.y}`;
          // Side-shore icons extend horizontally out to sea, away from the landing tile.
          if (group.gate.dx) row.classList.add(group.gate.dx > 0 ? "left-shore" : "right-shore");
          for (const enemy of group.enemies) {
            const spec = this.game.config.enemies[enemy.type], button = document.createElement("button"), img = document.createElement("img");
            button.type = "button"; button.className = "enemy-preview-icon"; button.dataset.enemyPreview = enemy.type;
            button.setAttribute("aria-label", `即将登陆：${spec.name}，${enemy.count}名`);
            img.src = iconURL(spec.useIcon, true); img.alt = ""; img.draggable = false; button.append(img);
            button.addEventListener("pointerenter", () => this.show(button, enemy));
            button.addEventListener("pointerleave", () => this.hide());
            button.addEventListener("focus", () => this.show(button, enemy));
            button.addEventListener("blur", () => this.hide());
            row.append(button);
          }
          this.root.append(row); this.items.push({ row, gate: group.gate });
        }
      }
    }
    for (const { row, gate } of this.items) {
      const x = gate.x - gate.dx * 1.15, y = gate.y - gate.dy * 1.15;
      const p = this.project(x, y), next = this.project(x + 1, y);
      const size = Math.max(26, Math.min(48, Math.abs(next.x - p.x) * .65));
      row.style.setProperty("--preview-size", `${size}px`);
      row.style.left = `${p.x}px`; row.style.top = `${p.y}px`;
    }
    this.positionTip();
  }
}
