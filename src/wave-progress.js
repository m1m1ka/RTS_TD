import { waveCount } from "./config/migrate.js";

const sword = '<path d="M14 22V7l2-4 2 4v15z" fill="currentColor"/><path d="M16 7v15" fill="none" opacity=".35"/><path d="M11 22h10v3H11z" fill="#b69a62"/><path d="M14.5 25h3v5h-3z" fill="#93704b"/>';
const swords = `<svg viewBox="0 0 32 32" aria-hidden="true"><g stroke="#233326" stroke-width="1.4" stroke-linejoin="round"><g transform="rotate(-43 16 17)">${sword}</g><g transform="rotate(43 16 17)">${sword}</g></g></svg>`;
const flag = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 7c6-5 9 4 16-1l-2 12c-6 4-9-4-15 0z" fill="currentColor" stroke="#26332a" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 5 7 28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';

export class WaveProgress {
  constructor(element) {
    this.element = element;
    this.signature = "";
    this.focus = "";
  }
  update(game) {
    this.element.hidden = game.currentDay().kind === "shop";
    if (this.element.hidden) return;
    const waves = game.currentDay().waves, count = waves.length;
    const signature = JSON.stringify([game.day, waves.map((w) => w.id)]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.element.innerHTML = `<div class="wave-timeline" style="--timeline-width:${count * 44 + 32}px"><div class="wave-track"><div class="wave-progress-fill"></div>${waves.map((_, i) => `<span class="wave-node" style="left:${i / count * 100}%">${swords}<b>${i + 1}</b></span>`).join("")}<span class="wave-finish" style="left:100%">${flag}</span></div></div>`;
      this.nodes = [...this.element.querySelectorAll(".wave-node")];
      this.flag = this.element.querySelector(".wave-finish");
      this.fill = this.element.querySelector(".wave-progress-fill");
      this.focus = "";
    }
    const complete = ["victory", "reward", "route", "won"].includes(game.phase);
    const fighting = game.phase === "battle" || game.phase === "lost";
    const total = waveCount(game.currentWave());
    const remaining = game.enemies.filter((e) => e.hp > 0).length + game.spawnQueues.reduce((n, q) => n + q.types.length - q.spawned, 0);
    const fraction = fighting ? Math.max(0, Math.min(1, (total - remaining) / total)) : 0;
    const progress = complete ? count : game.wave + fraction;
    this.flag.classList.toggle("done", complete);
    this.flag.title = complete ? "当天通关" : "通关终点";
    this.flag.setAttribute("aria-label", complete ? "当天已通关" : "当天尚未通关");
    this.fill.style.width = `${progress / count * 100}%`;
    this.element.setAttribute("aria-valuemax", String(count));
    this.element.setAttribute("aria-valuenow", progress.toFixed(2));
    this.element.setAttribute("aria-valuetext", complete ? `当天 ${count} 波全部完成` : `第 ${game.wave + 1} 波，共 ${count} 波`);
    this.nodes.forEach((node, i) => {
      const state = complete || i < game.wave ? "done" : i === game.wave ? game.phase === "battle" ? "current" : game.phase === "lost" ? "failed" : "waiting" : "pending";
      node.className = "wave-node " + state;
      node.title = `第 ${i + 1} 波 · ${{ done: "已完成", current: "交战中", waiting: "待开始", failed: "失守", pending: "待开始" }[state]}`;
      node.setAttribute("aria-label", node.title);
    });
    const focus = signature + ":" + game.wave + ":" + complete;
    if (focus !== this.focus) {
      this.focus = focus;
      const target = complete ? this.flag : this.nodes[game.wave];
      this.element.scrollLeft = Math.max(0, target.offsetLeft + 16 - this.element.clientWidth / 2);
    }
  }
}
