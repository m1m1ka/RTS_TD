// Install once without replacing the player's existing cards or starting hand.
export function migrateWorkshopContent(c) {
  if (c?.version !== 2 || c.workshopContentVersion !== undefined || !c.cards) return c;
  const tower = c.cards.tower || Object.values(c.cards).find(card => card?.category === "resource" && card.effects?.some(e => e.type === "summon"));
  if (tower?.unit && !c.cards.parts && Object.keys(c.cards).length < 100) {
    c.cards.parts = {
      ...structuredClone(tower), name: "零件", category: "resource", target: "ground",
      text: "在空地建设炮台 · 本场战斗结束消失", icon: "parts", temporary: true,
      effects: [{ type: "summon" }],
      unit: { ...structuredClone(tower.unit), levelGrowth: { maxHp: 40, atk: 6 } },
    };
  }
  c.workshopContentVersion = 1;
  return c;
}

export const workshopRules = {
  parts: {
    name: "零件生产", enabled: true,
    trigger: { event: "interval", scope: "any", radius: -1, interval: 10 },
    target: { kind: "self", radius: -1, count: 1 },
    effects: [{ type: "generateCard", pool: "selected", category: "resource", cards: ["parts"], count: 1 }],
  },
  engineering: {
    name: "工程改良", enabled: true,
    trigger: { event: "towerBuilt", scope: "any", radius: -1 },
    target: { kind: "eventTower", radius: -1, count: 1 },
    effects: [{ type: "ownerLevel", percent: 50 }],
  },
};
