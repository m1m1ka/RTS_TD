import { campaignLayout, nextDayIds } from "./campaign.js";
import { escapeHTML as esc } from "./config/schema.js";
import "./route-map.css";

export function routeGraph(config, { selected, available = [], completed = [], history = [], editor = false, adventure = false, chosen = null, layoutOverride = null, linkSource = null, selectedEdge = null } = {}) {
  const layout = layoutOverride || campaignLayout(config);
  const positions = new Map(layout.nodes.map((n) => [n.day.id, n]));
  const paths = [];
  for (const from of layout.nodes) for (const id of nextDayIds(config, from.day.id)) {
    const to = positions.get(id);
    if (!to) continue;
    const used = history.some((key, i) => key === from.day.id && history[i + 1] === id);
    const active = from.day.id === selected && available.includes(id);
    const curve = adventure
      ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
      : `M ${from.x + 27} ${from.y} C ${from.x + 95} ${from.y}, ${to.x - 95} ${to.y}, ${to.x - 27} ${to.y}`;
    const picked = selectedEdge?.[0] === from.day.id && selectedEdge?.[1] === id;
    paths.push(`<path class="${used ? "walked" : active ? "available" : ""} ${picked ? "edge-selected" : ""}" d="${curve}"/>${editor ? `<path class="route-edge-hit" data-route-from="${esc(from.day.id)}" data-route-to="${esc(id)}" d="${curve}"/>` : ""}`);
  }
  const stall = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 15h22v13H5z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M3 14 7 5h18l4 9v3H3z" fill="currentColor"/><path d="M12 28V19h8v9" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  const sword = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m6 3 17 19-3 3L3 6zM26 3 9 22l3 3L29 6z" fill="currentColor"/><path d="m17 24 7-7m-10 7-7-7m16 10 4-4M5 23l4 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  const graph = `<svg class="route-lines" width="${layout.width}" height="${layout.height}" aria-hidden="true">${paths.join("")}</svg>${layout.nodes.map(({ day, depth, x, y }) => {
    const done = completed.includes(day.id), active = available.includes(day.id), current = day.id === selected;
    const end = !nextDayIds(config, day.id).length;
    if (adventure) {
      const kind = day.kind === "shop" ? "商店" : "战斗";
      const overviewCurrent = current && !available.length;
      return `<button type="button" data-route-node="${esc(day.id)}" class="route-node ${done ? "done" : ""} ${active ? "available" : ""} ${current ? "current" : ""}" style="left:${x}px;top:${y}px" ${!active && !overviewCurrent ? "disabled" : ""} aria-label="${kind}${done ? "，已通过" : active ? "，进入下一关" : current ? "，返回战场" : "，未解锁"}"><span class="route-medal">${day.kind === "shop" ? stall : sword}</span><strong>${kind}</strong></button>`;
    }
    return `<button type="button" data-route-node="${esc(day.id)}" class="route-node ${done ? "done" : ""} ${active ? "available" : ""} ${current ? "current" : ""} ${day.id === chosen ? "chosen" : ""} ${editor ? "editable" : ""} ${editor && linkSource === day.id ? "link-source" : ""} ${editor && linkSource && depth === positions.get(linkSource)?.depth + 1 ? "link-target" : ""}" style="left:${x}px;top:${y}px" ${!editor && !active ? "disabled" : ""} ${adventure ? `aria-pressed="${day.id === chosen}"` : ""} aria-label="第 ${depth + 1} 天 ${esc(day.name)}${done ? " 已通过" : active ? " 可选择" : ""}"><span class="route-day">${adventure && current ? "当前 · " : ""}第 ${depth + 1} 天</span><span class="route-medal">${done ? "✓" : day.kind === "shop" ? stall : end ? "⚑" : sword}</span><strong>${esc(day.name)}</strong><small>${day.kind === "shop" ? "商店" : `${day.waves.length} 波敌袭`}${end ? " · 终点" : ""}</small></button>`;
  }).join("")}`;
  return `<div class="route-scroll" tabindex="0" aria-label="横向关卡路线"><div class="route-canvas" style="width:${layout.width}px;height:${layout.height}px">${adventure ? `<div class="route-graph" style="width:${layout.width}px;height:${layout.height}px">${graph}</div>` : graph}</div></div>`;
}

export class RouteMap {
  constructor(game, onChoose) {
    this.game = game;
    this.dialog = document.querySelector("#route-dialog");
    this.dialog.tabIndex = -1;
    this.signature = "";
    document.querySelector("#route-toggle")?.addEventListener("click", () => this.show());
    this.dialog.addEventListener("cancel", (event) => {
      if (this.game.phase === "route") event.preventDefault();
    });
    this.dialog.addEventListener("keydown", event => {
      const direction = { ArrowLeft: [-90, 0], ArrowRight: [90, 0], ArrowUp: [0, -90], ArrowDown: [0, 90] }[event.key];
      if (!direction) return;
      event.preventDefault();
      this.dialog.querySelector(".route-scroll")?.scrollBy({ left: direction[0], top: direction[1] });
    });
    this.dialog.addEventListener("click", (event) => {
      if (this.dragged) return;
      const button = event.target.closest("[data-route-node]");
      if (button && !button.disabled && this.game.phase === "route" && this.game.chooseDay(button.dataset.routeNode)) {
        this.dialog.close();
        onChoose();
      } else if (this.game.phase !== "route") {
        // The current node and empty background dismiss a read-only route overview.
        this.dialog.close();
      }
    });
    let drag = null;
    this.dialog.addEventListener("pointerdown", e => {
      this.dragged = false;
      const scroller = e.target.closest(".route-scroll");
      if (!scroller || e.target.closest("button") || e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, scroller };
      scroller.setPointerCapture(e.pointerId);
    });
    this.dialog.addEventListener("pointermove", e => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) this.dragged = true;
      drag.scroller.scrollLeft = drag.left + drag.x - e.clientX;
      drag.scroller.scrollTop = drag.top + drag.y - e.clientY;
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.dialog.addEventListener(type, () => drag = null);
    this.resizeObserver = new ResizeObserver(() => { if (this.dialog.open) this.centerMap(); });
    this.resizeObserver.observe(this.dialog);
  }
  centerMap() {
    const scroller = this.dialog.querySelector(".route-scroll"), graph = this.dialog.querySelector(".route-graph");
    if (!scroller || !graph) return;
    let targets = [...this.dialog.querySelectorAll(".route-node.available")];
    if (!targets.length) targets = [...this.dialog.querySelectorAll(".route-node.current")];
    if (!targets.length) return;
    // Half a viewport of spare space makes even the first/last column centerable.
    const canvas = graph.parentElement, w = scroller.clientWidth, h = scroller.clientHeight;
    canvas.style.width = `${graph.offsetWidth + w}px`;
    canvas.style.height = `${graph.offsetHeight + h}px`;
    graph.style.left = `${w / 2}px`;
    graph.style.top = `${h / 2}px`;
    const xs = targets.map(n => parseFloat(n.style.left)), ys = targets.map(n => parseFloat(n.style.top));
    scroller.scrollTo({ left: (Math.min(...xs) + Math.max(...xs)) / 2, top: (Math.min(...ys) + Math.max(...ys)) / 2, behavior: "instant" });
  }
  show() {
    this.signature = "";
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      this.centerMap();
      (this.dialog.querySelector(".route-node.available") || this.dialog.querySelector(".route-node.current"))?.focus({ preventScroll: true });
    });
  }
  render() {
    const game = this.game, selected = game.config.days[game.day].id;
    const available = game.phase === "route" ? game.nextDays() : [];
    const signature = JSON.stringify([game.config.days.map((d) => [d.id, d.name, d.next, d.waves.length, d.kind]), selected, available, game.completedDays, game.routeHistory]);
    if (this.signature === signature) return;
    this.signature = signature;
    this.dialog.innerHTML = routeGraph(game.config, { selected, available, completed: game.completedDays, history: game.routeHistory, adventure: true });
    if (this.dialog.open) this.centerMap();
  }
  update() {
    if (["won", "lost"].includes(this.game.phase) && this.dialog.open) this.dialog.close();
    if (this.game.phase === "route" && !this.dialog.open) this.show();
    else if (this.dialog.open) this.render();
  }
}
