import { reachableTerrain } from "./terrain.js";

export const copyMapLayout = layout => structuredClone({ obstacles: layout.obstacles || [], mines: layout.mines || [] });

export function mapLayoutErrors(layout, waves = []) {
  const errors = [], occupied = new Set(), mines = [];
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) return ["地图格式错误"];
  for (const [key, label, limit] of [["obstacles", "树木", 164], ["mines", "金矿", 163]]) {
    if (!Array.isArray(layout[key]) || layout[key].length > limit) { errors.push(`${label}需要最多 ${limit} 个格子坐标`); continue; }
    for (const cell of layout[key]) {
      if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.x > 14 || cell.y < 0 || cell.y > 10) {
        errors.push(`${label}坐标必须在 15 × 11 地图内`); continue;
      }
      const position = `${cell.x},${cell.y}`;
      if (position === "7,5" || occupied.has(position)) errors.push(`${label}不能占用核心或重复格子 (${position})`);
      occupied.add(position);
      if (key === "mines") {
        mines.push(cell);
        if (cell.maxHp !== undefined && (!Number.isInteger(cell.maxHp) || cell.maxHp < 1 || cell.maxHp > 100000)) errors.push("金矿生命必须为 1～100000 的整数");
      }
    }
  }
  const reachable = reachableTerrain(occupied);
  if (reachable.size < 2) errors.push("需要保留通往核心的道路");
  for (const { x, y } of mines) {
    if (![[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b]) => reachable.has(`${a},${b}`))) errors.push(`金矿 (${x},${y}) 需要可到达的相邻格子`);
  }
  for (const wave of waves) for (const spawn of wave.spawns || []) {
    if (!reachable.has(`${spawn.x},${spawn.y}`)) errors.push(`出生点 (${spawn.x},${spawn.y}) 被占用或无法到达核心`);
  }
  return [...new Set(errors)];
}

export function applyMapPreset(day, preset) {
  const errors = mapLayoutErrors(preset, day.waves || []);
  if (errors.length) throw new Error(errors.join("；"));
  Object.assign(day, copyMapLayout(preset));
}

export function migrateMapPresets(config) {
  if (config?.version !== 2 || config.mapPresets !== undefined) return config;
  config.mapPresets = { empty: { name: "空白地图", obstacles: [], mines: [] } };
  const signatures = new Set([JSON.stringify(copyMapLayout(config.mapPresets.empty))]);
  for (const day of Array.isArray(config.days) ? config.days : []) {
    if (!day || day.kind === "shop" || mapLayoutErrors(day).length) continue;
    const layout = copyMapLayout(day), signature = JSON.stringify(layout);
    if (signatures.has(signature) || Object.keys(config.mapPresets).length >= 100) continue;
    signatures.add(signature);
    config.mapPresets[`map_${signatures.size - 1}`] = { name: String(day.name || "已有地图").slice(0, 75) + " · 地图", ...layout };
  }
  return config;
}
