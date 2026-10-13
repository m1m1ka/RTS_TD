import { treeArt, mineArt } from "../art.js";
import { obstacleKeys } from "../terrain.js";

export class TerrainEditor {
  constructor(root, getDay, onChange) {
    this.root = root;
    this.getDay = getDay;
    this.onChange = onChange;
    this.painting = false;
    this.stroke = null;
    this.treeURL = treeArt().toDataURL();
    this.mineURL = mineArt().toDataURL();
    this.brush = "tree";
    this.mineHp = 180;
    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-terrain-brush]")) this.brush = event.target.value;
      if (event.target.matches("[data-mine-hp]")) this.mineHp = Math.max(1, Math.min(100000, Math.round(Number(event.target.value) || 180)));
    });
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
    const mines = new Set((day.mines || []).map((m) => `${m.x},${m.y}`));
    const gates = new Set(day.waves.flatMap((w) => w.spawns).map((p) => `${p.x},${p.y}`));
    return `<div class="terrain-toolbar"><button type="button" data-terrain-toggle aria-pressed="${this.painting}">${this.painting ? "完成绘制" : "绘制障碍"}</button><select data-terrain-brush aria-label="地图画笔"><option value="tree" ${this.brush === "tree" ? "selected" : ""}>树木</option><option value="mine" ${this.brush === "mine" ? "selected" : ""}>金矿</option></select><label>金矿生命 <input data-mine-hp type="number" min="1" max="100000" value="${this.mineHp}"></label><span data-terrain-count>${trees.size} 格树木 · ${mines.size} 座金矿</span></div><p class="hint">左键按住绘制，右键按住清除。金矿存活至当天胜利可额外获得 2 金币；生命值用于接下来绘制的金矿。打卡机与出生点不可绘制。</p><div class="terrain-grid ${this.painting ? "painting" : ""}" style="--tree-art:url('${this.treeURL}');--mine-art:url('${this.mineURL}')" role="group" aria-label="当天障碍地图">${Array.from({ length: 165 }, (_, i) => {
      const x = i % 15, y = Math.floor(i / 15), key = `${x},${y}`;
      const core = key === "7,5", gate = gates.has(key), tree = trees.has(key), mine = mines.has(key);
      return `<button type="button" data-terrain="${key}" class="${core ? "core" : gate ? "gate" : tree ? "tree" : mine ? "mine" : ""}" aria-label="地图格 ${key}" aria-pressed="${tree || mine}" aria-disabled="${core || gate}" title="(${key})${core ? " 打卡机" : gate ? " 出生点" : mine ? ` 金矿 · ${day.mines.find(m => m.x === x && m.y === y).maxHp ?? 180} 生命` : ""}">${core ? "✦" : gate ? "⚑" : ""}</button>`;
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
    const mines = new Map((day.mines || []).map((m) => [`${m.x},${m.y}`, m]));
    const gates = new Set(day.waves.flatMap((w) => w.spawns).map((p) => `${p.x},${p.y}`));
    let [x, y] = start;
    const [tx, ty] = end, dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
    let error = dx + dy, changed = false;
    // Interpolate crossed cells so a fast drag cannot leave holes in a wall.
    for (;;) {
      const key = `${x},${y}`;
      if (key !== "7,5" && !gates.has(key)) {
        const before = JSON.stringify([trees.has(key), mines.get(key)]);
        trees.delete(key); mines.delete(key);
        if (!this.stroke.erase) {
          if (this.brush === "mine") mines.set(key, { x, y, maxHp: this.mineHp });
          else trees.add(key);
        }
        const button = this.root.querySelector(`[data-terrain="${key}"]`);
        button.classList.toggle("tree", trees.has(key));
        button.classList.toggle("mine", mines.has(key));
        button.setAttribute("aria-pressed", !this.stroke.erase);
        const spawnCell = this.root.querySelector(`[data-spawn="${key}"]`);
        if (spawnCell) {
          spawnCell.classList.toggle("blocked", !this.stroke.erase);
          spawnCell.disabled = !this.stroke.erase;
        }
        changed ||= before !== JSON.stringify([trees.has(key), mines.get(key)]);
      }
      if (x === tx && y === ty) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
    this.stroke.last = end;
    if (changed) {
      day.obstacles = [...trees].map((key) => { const [x, y] = key.split(",").map(Number); return { x, y }; });
      day.mines = [...mines.values()];
      this.root.querySelector("[data-terrain-count]").textContent = `${trees.size} 格树木 · ${mines.size} 座金矿`;
      this.onChange();
    }
  }
}
