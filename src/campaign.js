export const startDayId = (config) => config.startDayId ?? config.days[0]?.id;
export function nextDayIds(config, id) {
  const index = config.days.findIndex((day) => day.id === id);
  if (index < 0) return [];
  const day = config.days[index];
  return day.next === undefined ? (config.days[index + 1] ? [config.days[index + 1].id] : []) : Array.isArray(day.next) ? day.next : [];
}
export function materializeRoutes(config) {
  const next = config.days.map((day) => [...nextDayIds(config, day.id)]);
  config.startDayId ??= config.days[0]?.id;
  config.days.forEach((day, i) => { day.next = next[i]; });
}
export function campaignLayout(config) {
  const ids = new Set(config.days.map((d) => d.id));
  const incoming = new Map(config.days.map((d) => [d.id, 0]));
  const depths = new Map(config.days.map((d) => [d.id, 0]));
  for (const day of config.days) for (const id of nextDayIds(config, day.id))
    if (ids.has(id)) incoming.set(id, incoming.get(id) + 1);
  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  for (let i = 0; i < queue.length; i++) for (const id of nextDayIds(config, queue[i])) {
    if (!ids.has(id)) continue;
    depths.set(id, Math.max(depths.get(id), depths.get(queue[i]) + 1));
    incoming.set(id, incoming.get(id) - 1);
    if (incoming.get(id) === 0) queue.push(id);
  }
  const layers = [];
  for (const day of config.days) (layers[depths.get(day.id)] ??= []).push(day.id);
  const rows = Math.max(1, ...layers.map((layer) => layer?.length || 0));
  const height = Math.max(270, rows * 130 + 70);
  return {
    width: Math.max(680, layers.length * 190 + 50), height,
    nodes: config.days.map((day) => {
      const depth = depths.get(day.id), layer = layers[depth];
      return { day, depth, x: 95 + depth * 190, y: height / 2 + (layer.indexOf(day.id) - (layer.length - 1) / 2) * 130 };
    }),
  };
}
export function campaignErrors(config) {
  const errors = [], ids = new Set(config.days.map((d) => d?.id));
  if (!ids.has(startDayId(config))) errors.push("路线起点不存在");
  for (const day of config.days) {
    if (!day || typeof day !== "object") continue;
    if (day.next !== undefined && (!Array.isArray(day.next) || day.next.length > 100)) {
      errors.push(`${day.name}：后续关卡必须为最多 100 个节点 ID`); continue;
    }
    const seen = new Set();
    for (const id of nextDayIds(config, day.id)) {
      if (!ids.has(id) || id === day.id || seen.has(id)) errors.push(`${day.name}：后续关卡不存在、重复或连接自身`);
      seen.add(id);
    }
  }
  if (errors.length) return errors;
  const colors = new Map();
  const visit = (id) => {
    if (colors.get(id) === 1) { errors.push("路线不能形成循环，请连接后续关卡"); return; }
    if (colors.get(id) === 2) return;
    colors.set(id, 1);
    for (const next of nextDayIds(config, id)) visit(next);
    colors.set(id, 2);
  };
  visit(startDayId(config));
  if (colors.size !== ids.size) errors.push("有节点无法从路线起点抵达，请补充连接或删除孤立节点");
  return [...new Set(errors)];
}
