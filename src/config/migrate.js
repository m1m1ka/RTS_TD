// Version 1 stored each level as a wave. Preserve each level as a day.
export function migrateConfig(value) {
  const c = structuredClone(value);
  if (c?.version !== 1) return c;
  if (!Array.isArray(c.waves) || !c.initial) throw new Error("旧配置缺少关卡或初始规则");
  c.version = 2;
  c.initial.firstWaveDelay = 0.5;
  c.days = c.waves.map((w, day) => {
    if (!Array.isArray(w?.spawns) || !w.spawns.length || !Array.isArray(w.types) || !w.types.length || !Number.isInteger(w.count) || w.count < 1 || w.count > 500)
      throw new Error(`旧配置第 ${day + 1} 关的出兵规则无效`);
    const spawns = w.spawns.map((p, i) => ({
      ...p, delay: i * w.interval, interval: w.interval * w.spawns.length, enemies: [],
    }));
    for (let i = 0; i < w.count; i++) {
      const type = w.finalEnemy && i === w.count - 1 ? w.finalEnemy : w.types[i % w.types.length];
      const rows = spawns[i % spawns.length].enemies;
      const last = rows.at(-1);
      if (last?.type === type) last.count++;
      else rows.push({ type, count: 1 });
    }
    return {
      id: w.id, name: w.name, desc: w.desc || "", rewards: w.rewards,
      waves: [{ id: "wave_1", name: "第一波", startDelay: 0, hpScale: w.hpScale, atkScale: w.atkScale,
        spawns: spawns.filter((p) => p.enemies.length) }],
    };
  });
  delete c.waves;
  return c;
}
export const waveCount = (wave) => wave.spawns.reduce(
  (sum, p) => sum + p.enemies.reduce((n, e) => n + e.count, 0), 0,
);
