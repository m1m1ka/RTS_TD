import { campaignLayout, nextDayIds } from "./campaign.js";
import { escapeHTML as esc } from "./config/schema.js";
import "./route-map.css";

function mapScenery(layout) {
  const trees = [];
  for (let x = 30; x < layout.width; x += 57) for (let y = 30; y < layout.height; y += 67) {
    const px = x + Math.sin(x + y) * 22, py = y + Math.cos(x - y) * 18;
    if (layout.nodes.some(n => Math.abs(n.x - px) < 95 && Math.abs(n.y - py) < 120)) continue;
    trees.push(`<use href="#route-pine" x="${px}" y="${py}" width="36" height="48" opacity="${.2 + (Math.sin(x * y) + 1) * .12}"/>`);
  }
  return `<svg class="route-landscape" width="${layout.width}" height="${layout.height}" aria-hidden="true"><defs><symbol id="route-pine" viewBox="0 0 36 48"><path d="M18 0 4 21h7L0 36h15v12h6V36h15L25 21h7Z" fill="currentColor"/><path d="M18 5v29M18 23l-7 9" fill="none" stroke="#b2c29a" stroke-opacity=".22"/></symbol></defs><path class="map-river" d="M ${layout.width * .4} -20 Q ${layout.width * .6} 100 ${layout.width * .48} 230 T ${layout.width * .62} ${layout.height + 40}"/>${trees.join("")}<text x="${layout.width * .25}" y="${layout.height - 36}" class="map-region">低语林地</text><text x="${layout.width * .74}" y="65" class="map-region">暮色边境</text></svg>`;
}
export function routeGraph(config, { selected, available = [], completed = [], history = [], editor = false, adventure = false, chosen = null } = {}) {
  let layout = campaignLayout(config);
  if (adventure) {
    const height = Math.max(480, layout.height * 1.35);
    layout = { width: layout.width * 1.15, height, nodes: layout.nodes.map(n => ({ ...n, x: n.x * 1.15, y: height / 2 + (n.y - layout.height / 2) * 1.35 + Math.sin(n.depth * 1.8) * 54 })) };
  }
  const positions = new Map(layout.nodes.map((n) => [n.day.id, n]));
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
  return `<div class="route-scroll" tabindex="0" aria-label="横向关卡路线"><div class="route-canvas" style="width:${layout.width}px;height:${layout.height}px">${adventure ? mapScenery(layout) : ""}<svg class="route-lines" width="${layout.width}" height="${layout.height}" aria-hidden="true">${paths.join("")}</svg>${layout.nodes.map(({ day, depth, x, y }) => {
    const done = completed.includes(day.id), active = available.includes(day.id), current = day.id === selected;
    const end = !nextDayIds(config, day.id).length;
    return `<button type="button" data-route-node="${esc(day.id)}" class="route-node ${done ? "done" : ""} ${active ? "available" : ""} ${current ? "current" : ""} ${day.id === chosen ? "chosen" : ""} ${editor ? "editable" : ""}" style="left:${x}px;top:${y}px" ${!editor && !active ? "disabled" : ""} ${adventure ? `aria-pressed="${day.id === chosen}"` : ""} aria-label="第 ${depth + 1} 天 ${esc(day.name)}${done ? " 已通过" : active ? " 可选择" : ""}"><span class="route-day">${adventure && current ? "目前所在 · " : ""}第 ${depth + 1} 天</span><span class="route-medal">${done ? "✓" : day.kind === "shop" ? stall : end ? "⚑" : sword}</span><strong>${esc(day.name)}</strong><small>${day.kind === "shop" ? "商店" : `${day.waves.length} 波`}${end ? " · 终点" : ""}</small></button>`;
  }).join("")}</div></div>`;
}

export class RouteMap {
  constructor(game, onChoose) {
    this.game = game;
    this.dialog = document.querySelector("#route-dialog");
    this.dialog.tabIndex = -1;
    this.signature = "";
    this.chosen = null;
    document.querySelector("#route-toggle").onclick = () => this.show();
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
      if (event.target.closest("[data-route-close]")) this.dialog.close();
      const button = event.target.closest("[data-route-node]");
      if (button && !button.disabled) {
        this.chosen = button.dataset.routeNode;
        this.updateChoice();
      }
      if (event.target.closest("[data-route-depart]") && this.chosen && this.game.chooseDay(this.chosen)) {
        this.dialog.close();
        this.chosen = null;
        onChoose();
      }
    });
    let drag = null;
    this.dialog.addEventListener("pointerdown", e => {
      const scroller = e.target.closest(".route-scroll");
      if (!scroller || e.target.closest("button") || e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, scroller };
      scroller.setPointerCapture(e.pointerId);
    });
    this.dialog.addEventListener("pointermove", e => {
      if (!drag) return;
      drag.scroller.scrollLeft = drag.left + drag.x - e.clientX;
      drag.scroller.scrollTop = drag.top + drag.y - e.clientY;
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.dialog.addEventListener(type, () => drag = null);
    this.resizeObserver = new ResizeObserver(() => { if (this.dialog.open) this.centerMap(); });
    this.resizeObserver.observe(this.dialog);
  }
  centerMap() {
    const target = this.dialog.querySelector(".route-node.chosen") || this.dialog.querySelector(".route-node.available") || this.dialog.querySelector(".route-node.current");
    target?.scrollIntoView({ block: "center", inline: "center" });
  }
  updateChoice() {
    const day = this.game.config.days.find(d => d.id === this.chosen);
    for (const node of this.dialog.querySelectorAll("[data-route-node]")) {
      const chosen = node.dataset.routeNode === this.chosen;
      node.classList.toggle("chosen", chosen); node.setAttribute("aria-pressed", String(chosen));
    }
    const title = this.dialog.querySelector("[data-route-choice]"), subtitle = this.dialog.querySelector("[data-route-detail]");
    if (title) title.textContent = day?.name || "下一站，去往何处？";
    if (subtitle) subtitle.textContent = day ? day.kind === "shop" ? "林间商店 · 补充行囊，整装再出发" : `${day.waves.length} 波敌袭 · 守住核心，赢取战利品` : "选择闪光的路标，继续你的远征";
    const button = this.dialog.querySelector("[data-route-depart]");
    if (button) { button.disabled = !day; button.textContent = day?.kind === "shop" ? "前往商店 →" : "踏上征途 →"; }
  }
  show() {
    this.signature = "";
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.focus({ preventScroll: true });
    requestAnimationFrame(() => this.centerMap());
  }
  render() {
    const game = this.game, selected = game.config.days[game.day].id;
    const available = game.phase === "route" ? game.nextDays() : [];
    if (!available.includes(this.chosen)) this.chosen = null;
    const signature = JSON.stringify([game.config.days.map((d) => [d.id, d.name, d.next, d.waves.length, d.kind]), selected, available, game.completedDays, game.routeHistory]);
    if (this.signature === signature) return;
    this.signature = signature;
    this.dialog.innerHTML = `<div class="expedition-screen"><header class="expedition-heading"><div><span class="expedition-eyebrow">THE FOREST CAMPAIGN · 森林远征</span><h2>${game.phase === "route" ? "前路未尽" : "远征舆图"}</h2><p>${game.phase === "route" ? "循着林间的路标，选择下一段旅程。" : "每一步，都离归途更近。"}</p></div><div class="expedition-progress"><span>已通过</span><strong>${game.completedDays.length}</strong><span>处营地</span></div>${game.phase === "route" ? "" : '<button type="button" class="expedition-close" data-route-close aria-label="返回战场">返回战场 ×</button>'}</header><div class="expedition-map"><div class="map-compass" aria-hidden="true"><span>N</span>✥</div>${routeGraph(game.config, { selected, available, completed: game.completedDays, history: game.routeHistory, adventure: true, chosen: this.chosen })}<div class="map-legend"><span>● 已踏足</span><span>◉ 可前往</span><span>◇ 未探索</span></div></div><footer class="expedition-footer">${game.phase === "route" ? '<div class="expedition-destination"><span>下一站</span><h3 data-route-choice></h3><p data-route-detail></p></div><button type="button" data-route-depart disabled>踏上征途 →</button>' : '<p class="expedition-overview">守住今天，再启程去往远方。</p>'}<span class="map-pan-hint">拖动地图探索 · 方向键移动视野</span></footer></div>`;
    this.updateChoice();
  }
  update() {
    if (["won", "lost"].includes(this.game.phase) && this.dialog.open) this.dialog.close();
    if (this.game.phase === "route" && !this.dialog.open) this.show();
    else if (this.dialog.open) this.render();
  }
}
