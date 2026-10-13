export const obstacleKeys = (day) => new Set((day?.obstacles || []).map(({ x, y }) => `${x},${y}`));

export function reachableTerrain(blocked) {
  const seen = new Set(["7,5"]), queue = [{ x: 7, y: 5 }];
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = queue[i].x + dx, y = queue[i].y + dy, key = `${x},${y}`;
      if (x < 0 || x >= 15 || y < 0 || y >= 11 || blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  return seen;
}

export function migrateTerrain(c) {
  if (c?.version === 2 && Array.isArray(c.days))
    for (const day of c.days)
      if (day && typeof day === "object") {
        if (day.obstacles === undefined) day.obstacles = [];
        if (day.mines === undefined) day.mines = [];
      }
  return c;
}
