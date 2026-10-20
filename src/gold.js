import { economySettings } from "./economy.js";
export const MINE_HP = 180;
export function victoryPayout(mines, config = {}) {
  const { victoryGold, mineGold } = economySettings(config), coins = [];
  const add = (position, amount, limit, start, spacing) => {
    const count = Math.min(amount, limit);
    for (let i = 0; i < count; i++) coins.push({ x: position.x, y: position.y, index: i, at: start + i * spacing,
      amount: Math.floor(amount / count) + (i < amount % count ? 1 : 0) });
  };
  add({ x: 7, y: 5 }, victoryGold, 10, 2.3, .28);
  const survivors = mines.filter((m) => m.hp > 0);
  for (const mine of survivors) add(mine, mineGold, 5, 3.7, .32);
  coins.sort((a, b) => a.at - b.at);
  return { elapsed: 0, paid: 0, coins, total: victoryGold + survivors.length * mineGold,
    duration: Math.max(survivors.length ? 5.5 : 4.8, (coins.at(-1)?.at || 0) + 1.2) };
}
