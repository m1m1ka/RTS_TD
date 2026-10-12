import { treeArt } from "../art.js";
import { obstacleKeys } from "../terrain.js";

export class TerrainEditor {
  constructor(root, getDay, onChange) {
    this.root = root;
    this.getDay = getDay;
    this.onChange = onChange;
    this.painting = false;
    this.stroke = null;
    this.treeURL = treeArt().toDataURL();
    root.addEventListener("click", (event) => {
      if (!event.target.closest("[data-terrain-toggle]")) return;
      this.painting = !this.painting;
      this.stop();
      this.updateMode();
    });
    root.addEventListener("contextmenu", (event) => {
      if (this.painting && event.target.closest(".terrain-grid")) event.preventDefault();
    });
    root.addEventListener("pointerdown", (event) => {
      const cell = event.target.closest("[data-terrain]");
      if (!this.painting || !cell || ![0, 2].includes(event.button)) return;
      event.preventDefault();
      const grid = cell.closest(".terrain-grid");
      this.stroke = { id: event.pointerId, erase: event.button === 2, last: null, grid };
      grid.setPointerCapture(event.pointerId);
      this.paintAt(cell);
    });
    root.addEventListener("pointermove", (event) => {
      if (!this.stroke || this.stroke.id !== event.pointerId) return;
      if (!(event.buttons & (this.stroke.erase ? 2 : 1))) { this.stop(); return; }
      event.preventDefault();
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-terrain]");
      if (cell && cell.closest(".terrain-grid") === this.stroke.grid) this.paintAt(cell);
      else this.stroke.last = null;
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      window.addEventListener(type, () => this.stop());
    window.addEventListener("blur", () => this.stop());
  }
  stop() {
    const old = this.stroke;
    this.stroke = null;
    if (old?.grid.hasPointerCapture(old.id)) old.grid.releasePointerCapture(old.id);
  }
  render(day) {
    this.stop();
    const trees = obstacleKeys(day);
    const gates = new Set(day.waves.flatMap((w) => w.spawns).map((p) => `${p.x},${p.y}`));
    return `<div class="terrain-toolbar"><button type="button" data-terrain-toggle aria-pressed="${this.painting}">${this.painting ? "完成绘制" : "绘制障碍"}</button><span data-terrain-count>${trees.size} 格树木</span></div><p class="hint">左键按住拖动种树，右键按住拖动清除。打卡机与当天所有出生点不可绘制。</p><div class="terrain-grid ${this.painting ? "painting" : ""}" style="--tree-art:url('${this.treeURL}')" role="group" aria-label="当天障碍地图">${Array.from({ length: 165 }, (_, i) => {
      const x = i % 15, y = Math.floor(i / 15), key = `${x},${y}`;
      const core = key === "7,5", gate = gates.has(key), tree = trees.has(key);
      return `<button type="button" data-terrain="${key}" class="${core ? "core" : gate ? "gate" : tree ? "tree" : ""}" aria-label="地图格 ${key}" aria-pressed="${tree}" aria-disabled="${core || gate}" title="(${key})${core ? " 打卡机" : gate ? " 出生点" : ""}">${core ? "✦" : gate ? "⚑" : ""}</button>`;
    }).join("")}</div>`;
  }
  updateMode() {
    const button = this.root.querySelector("[data-terrain-toggle]");
    if (!button) return;
    button.textContent = this.painting ? "完成绘制" : "绘制障碍";
    button.setAttribute("aria-pressed", this.painting);
    this.root.querySelector(".terrain-grid").classList.toggle("painting", this.painting);
  }
  paintAt(cell) {
    const day = this.getDay();
    if (!day || !this.stroke) return;
    const end = cell.dataset.terrain.split(",").map(Number);
    const start = this.stroke.last || end;
    const trees = obstacleKeys(day);
    const gates = new Set(day.waves.flatMap((w) => w.spawns).map((p) => `${p.x},${p.y}`));
    let [x, y] = start;
    const [tx, ty] = end, dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
    let error = dx + dy, changed = false;
    // Interpolate crossed cells so a fast drag cannot leave holes in a wall.
    for (;;) {
      const key = `${x},${y}`;
      if (key !== "7,5" && !gates.has(key) && trees.has(key) === this.stroke.erase) {
        if (this.stroke.erase) trees.delete(key); else trees.add(key);
        const button = this.root.querySelector(`[data-terrain="${key}"]`);
        button.classList.toggle("tree", !this.stroke.erase);
        button.setAttribute("aria-pressed", !this.stroke.erase);
        const spawnCell = this.root.querySelector(`[data-spawn="${key}"]`);
        if (spawnCell) {
          spawnCell.classList.toggle("blocked", !this.stroke.erase);
          spawnCell.disabled = !this.stroke.erase;
        }
        changed = true;
      }
      if (x === tx && y === ty) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
    this.stroke.last = end;
    if (changed) {
      day.obstacles = [...trees].map((key) => { const [x, y] = key.split(",").map(Number); return { x, y }; });
      this.root.querySelector("[data-terrain-count]").textContent = `${trees.size} 格树木`;
      this.onChange();
    }
  }
}
