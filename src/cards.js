import { getConfig, subscribeConfig } from "./config/store.js";
export const cardTypes = {
  hero: "英雄",
  resource: "资源",
  battle: "战斗",
  equipment: "装备",
};
export let cards = getConfig().cards;
export let startingCards = getConfig().initial.cards;
subscribeConfig((config) => {
  cards = config.cards;
  startingCards = config.initial.cards;
});
export function rewardPacks(day) {
  return structuredClone(getConfig().days[day].rewards);
}
