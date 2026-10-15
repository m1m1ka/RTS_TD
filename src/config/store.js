import { DEFAULT_CONFIG } from "./defaults.js";
import { assertConfig, clone } from "./schema.js";
import { ProjectConfigSync } from "./project-sync.js";
export const CONFIG_KEY = "friday-defense-config-v1";
const project = new ProjectConfigSync("game", CONFIG_KEY);
export const savesToProject = () => project.writable;
const listeners = new Set();
let current = clone(DEFAULT_CONFIG),
  revision = 0;
export let configLoadError = "";
if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) current = assertConfig(JSON.parse(saved));
  } catch (e) {
    configLoadError = "已保存的配置无法读取，暂用默认规则：" + e.message;
  }
  try {
    current = assertConfig(await project.load(current));
    localStorage.setItem(CONFIG_KEY, JSON.stringify(current));
    project.markLoaded();
  } catch (e) { configLoadError = "项目配置读取失败，保留本机配置：" + e.message; }
  window.addEventListener("storage", (e) => {
    if (e.key === CONFIG_KEY + "-restart") {
      for (const fn of listeners) fn(current, "restart");
      return;
    }
    if (e.key !== CONFIG_KEY || !e.newValue) return;
    try {
      const value = JSON.parse(e.newValue);
      project.syncRevision();
      accept(assertConfig(value), "live");
    } catch (error) {
      console.error("配置同步失败", error);
    }
  });
  window.addEventListener("message", (e) => {
    if (
      e.origin === location.origin &&
      e.data?.type === "friday-config-restart"
    )
      for (const fn of listeners) fn(current, "restart");
  });
}
function accept(next, mode) {
  current = next;
  revision++;
  for (const fn of listeners) fn(current, mode);
}
export const getConfig = () => current;
export const getConfigRevision = () => revision;
export function subscribeConfig(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export async function saveConfig(draft, mode = "live") {
  const next = assertConfig(draft);
  await project.save(next);
  // Persist before notifying: quota failures must not publish an unsaved configuration.
  if (typeof window !== "undefined")
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  if (typeof window !== "undefined" && mode === "restart")
    localStorage.setItem(CONFIG_KEY + "-restart", String(Date.now()));
  accept(next, mode);
  return clone(next);
}
export const exportConfig = () => JSON.stringify(current, null, 2);
