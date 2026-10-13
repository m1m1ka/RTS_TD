export const valueModes = { fixed: "固定值", percent: "百分比（目标最大生命）" };
export const statModes = { add: "固定值加成", percent: "百分比加成（当前属性）", multiply: "乘以倍率" };
export const effectAmount = (effect, target) =>
  effect.valueMode === "percent" ? target.maxHp * effect.value / 100 : effect.value;
