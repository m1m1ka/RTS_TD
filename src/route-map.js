import { campaignLayout, nextDayIds } from "./campaign.js";
import { escapeHTML as esc } from "./config/schema.js";
import "./route-map.css";

export function routeGraph(config, { selected, available = [], completed = [], history = [], editor = false } = {}) {
  const layout = campaignLayout(config), positions = new Map(layout.nodes.map((n) => [n.day.id, n]));
  const paths = [];
  for (const from of layout.nodes) for (const id of nextDayIds(config, from.day.id)) {
    const to = positions.get(id);
    if (!to) continue;
    const used = history.some((key, i) => key === from.day.id && history[i + 1] === id);
    const active = from.day.id === selected && available.includes(id);
    paths.push(`<path class="${used ? "walked" : active ? "available" : ""}" d="M ${from.x + 27} ${from.y} C ${from.x + 95} ${from.y}, ${to.x - 95} ${to.y}, ${to.x - 27} ${to.y}"/>`);
  }
  const stall = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 15h22v13H5z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M3 14 7 5h18l4 9v3H3z" fill="currentColor"/><path d="M12 28V19h8v9" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  const sword = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m6 3 17 19-3 3L3 6zM26 3 9 22l3 3L29 6z" fill="currentColor"/><path d="m17 24 7-7m-10 7-7-7m16 10 4-4M5 23l4 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  return `<div class="route-scroll" tabindex="0" aria-label="横向关卡路线"><div class="route-canvas" style="width:${layout.width}px;height:${layout.height}px"><svg class="route-lines" width="${layout.width}" height="${layout.height}" aria-hidden="true">${paths.join("")}</svg>${layout.nodes.map(({ day, depth, x, y }) => {
    const done = completed.includes(day.id), active = available.includes(day.id), current = day.id === selected;
    const end = !nextDayIds(config, day.id).length;
    return `<button type="button" data-route-node="${esc(day.id)}" class="route-node ${done ? "done" : ""} ${active ? "available" : ""} ${current ? "current" : ""} ${editor ? "editable" : ""}" style="left:${x}px;top:${y}px" ${!editor && !active ? "disabled" : ""} aria-label="第 ${depth + 1} 天 ${esc(day.name)}${done ? " 已通过" : active ? " 可选择" : ""}"><span class="route-day">第 ${depth + 1} 天</span><span class="route-medal">${done ? "✓" : day.kind === "shop" ? stall : end ? "⚑" : sword}</span><strong>${esc(day.name)}</strong><small>${day.kind === "shop" ? "商店" : `${day.waves.length} 波`}${end ? " · 终点" : ""}</small></button>`;
  }).join("")}</div></div>`;
}

export class RouteMap {
  constructor(game, onChoose) {
    this.game = game;
    this.dialog = document.querySelector("#route-dialog");
    this.signature = "";
    document.querySelector("#route-toggle").onclick = () => this.show();
    this.dialog.addEventListener("cancel", (event) => {
      if (this.game.phase === "route") event.preventDefault();
    });
    this.dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-route-close]")) this.dialog.close();
      const button = event.target.closest("[data-route-node]");
      if (button && this.game.chooseDay(button.dataset.routeNode)) {
        this.dialog.close();
        onChoose();
      }
    });
  }
  show() {
    this.signature = "";
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    requestAnimationFrame(() => {
      const target = this.dialog.querySelector(".route-node.available") || this.dialog.querySelector(".route-node.current");
      target?.scrollIntoView({ block: "center", inline: "center" });
    });
  }
  render() {
    const game = this.game, selected = game.config.days[game.day].id;
    const available = game.phase === "route" ? game.nextDays() : [];
    const signature = JSON.stringify([game.config.days.map((d) => [d.id, d.name, d.next, d.waves.length, d.kind]), selected, available, game.completedDays, game.routeHistory]);
    if (this.signature === signature) return;
    this.signature = signature;
    this.dialog.innerHTML = `<div class="route-heading"><span class="route-emblem">⚑</span><h2>${game.phase === "route" ? "选择明日路线" : "远征路线"}</h2>${game.phase === "route" ? "" : '<button type="button" data-route-close aria-label="返回战场">×</button>'}</div>${routeGraph(game.config, { selected, available, completed: game.completedDays, history: game.routeHistory })}`;
  }
  update() {
    if (["won", "lost"].includes(this.game.phase) && this.dialog.open) this.dialog.close();
    if (this.game.phase === "route" && !this.dialog.open) this.show();
    else if (this.dialog.open) this.render();
  }
}
