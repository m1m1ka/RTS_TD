import assert from "node:assert/strict";
export function redeployHeroes(game) {
  for (const hero of [...game.heroReserve]) {
    const cells = [{ x: hero.x, y: hero.y }];
    for (let y = 1; y < 10; y++) for (let x = 1; x < 14; x++) cells.push({ x, y });
    const cell = cells.find(p => game.cardTarget(hero.cardId, p.x, p.y).valid);
    assert.ok(cell, "returned hero has a legal deployment position");
    assert.ok(game.playCard(hero.cardId, cell.x, cell.y));
  }
}
