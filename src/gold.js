export const MINE_HP = 180;
export function victoryPayout(mines) {
  const coins = Array.from({ length: 4 }, (_, i) => ({ x: 7, y: 5, index: i, at: 2.3 + i * 0.28 }));
  const survivors = mines.filter((m) => m.hp > 0);
  for (let i = 0; i < 2; i++)
    for (const mine of survivors) coins.push({ x: mine.x, y: mine.y, index: i, at: 3.7 + i * 0.32 });
  return { elapsed: 0, paid: 0, coins, total: coins.length, duration: survivors.length ? 5.5 : 4.8 };
}
