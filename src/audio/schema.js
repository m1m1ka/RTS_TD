export const AUDIO_EVENTS = {
  enemyHit: ["敌人受击", "单位", 60], enemyDeath: ["敌人死亡", "单位", 60],
  bowDraw: ["拉弓", "武器", 60], arrowHit: ["箭矢命中", "武器", 60],
  swordSwing: ["挥剑", "武器", 60], swordHit: ["剑命中", "武器", 60],
  magicHit: ["远程魔法球命中", "武器", 60],
  heroHit: ["英雄受击", "单位", 60], heroDeath: ["英雄死亡", "单位", 80],
  heroUpgrade: ["英雄升级", "英雄", 80], heroDeploy: ["放置英雄牌", "英雄", 30],
  victory: ["胜利", "战斗", 0], battleStart: ["点击开战", "战斗", 0],
};
export const audioExtensions = /\.(wav|mp3|ogg|m4a|aac|flac|webm)$/i;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_LIBRARY_BYTES = 200 * 1024 * 1024;
export const defaultAudioConfig = () => ({ version: 1, masterVolume: .8, assets: [], events: Object.fromEntries(Object.entries(AUDIO_EVENTS).map(([key, [, , cooldown]]) => [key, { sound: "", enabled: true, volume: 1, cooldown }])) });
const object = v => v && typeof v === "object" && !Array.isArray(v);
export function validateAudioConfig(c) {
  const errors = [], number = (n,min,max) => Number.isFinite(n) && n >= min && n <= max;
  if (!object(c) || c.version !== 1 || !Array.isArray(c.assets) || !object(c.events)) return ["音频配置格式或版本不支持"];
  if (!number(c.masterVolume,0,1)) errors.push("总音量须为 0～100%");
  if (c.assets.length > 500) errors.push("音效库最多 500 个文件");
  const ids = new Set(); let total = 0;
  for (const asset of c.assets) {
    if (!object(asset) || typeof asset.id !== "string" || !asset.id || asset.id.length > 600 || ids.has(asset.id)) { errors.push("音频 ID 无效或重复"); continue; }
    ids.add(asset.id);
    if (typeof asset.name !== "string" || !asset.name || asset.name.length > 300 || !audioExtensions.test(asset.name)) errors.push("不支持的音频文件名");
    if (typeof asset.path !== "string" || asset.path.length > 1000) errors.push("音频相对路径无效");
    if (!["local","project"].includes(asset.source)) errors.push("音频来源无效");
    if (!number(asset.size,1,MAX_AUDIO_BYTES)) errors.push("单个音效须小于 20 MB");
    total += asset.size || 0;
    if (asset.source === "project") {
      try {
        const url = decodeURIComponent(asset.url);
        if (!url.startsWith("/audio/") || url.includes("\\") || url.split("/").some(p=>p===".."||p===".") || /[?#\x00-\x1f]/.test(url)) errors.push("项目音效路径必须位于 public/audio 内");
      } catch { errors.push("项目音效路径无效"); }
    }
  }
  if (total > MAX_LIBRARY_BYTES) errors.push("音效库总大小不能超过 200 MB");
  for (const [key,[label]] of Object.entries(AUDIO_EVENTS)) {
    const event = c.events[key];
    if (!object(event) || typeof event.enabled !== "boolean" || typeof event.sound !== "string" || (event.sound && !ids.has(event.sound))) { errors.push(`${label}：请绑定有效的音效`); continue; }
    if (!number(event.volume,0,1) || !number(event.cooldown,0,5000)) errors.push(`${label}：音量须为 0～100%，最短间隔须为 0～5000 毫秒`);
  }
  return errors;
}
export function assertAudioConfig(c) {
  const errors = validateAudioConfig(c);
  if (errors.length) throw new Error(errors.slice(0,8).join("\n"));
  return structuredClone(c);
}
export function audioEventsFor(event) {
  const hero = event.unit?.side === "hero" && event.unit.level > 0;
  if (event.type === "hit" || event.type === "death") {
    const side = event.unit?.side === "enemy" ? "enemy" : hero ? "hero" : null;
    return side ? [side + (event.type === "hit" ? "Hit" : "Death")] : [];
  }
  if (event.type === "attack") return event.kind === "arrow" ? ["bowDraw"] : event.kind === "slash" ? ["swordSwing"] : [];
  if (event.type === "impact" && !event.missed) return ({ arrow:["arrowHit"], slash:["swordHit"], orb:["magicHit"] })[event.kind] || [];
  if (event.type === "upgrade" && hero) return ["heroUpgrade"];
  if (event.type === "deploy" && hero) return ["heroDeploy"];
  if (event.type === "victory") return ["victory"];
  if (event.type === "day") return ["battleStart"];
  return [];
}
