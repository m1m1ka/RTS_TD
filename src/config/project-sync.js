// Repository files are authoritative after a pull; unchanged static deployments
// may still retain browser-only edits. Backups protect older local settings.
export function configFingerprint(value) {
  const text = JSON.stringify(value);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}
export class ProjectConfigSync {
  constructor(section, storageKey) {
    this.section = section; this.storageKey = storageKey; this.revision = null;
    this.writable = typeof window !== "undefined" && !!import.meta.env?.DEV;
  }
  async load(local) {
    if (typeof window === "undefined") return local;
    const url = this.writable ? `/__project-config/${this.section}` : `${import.meta.env?.BASE_URL || "/"}config/${this.section}.json`;
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      if (!this.writable && response.status === 404) return local;
      throw new Error("无法读取项目配置，请检查本地服务或配置文件");
    }
    const payload = await response.json();
    if (this.writable && payload.enabled === false) { this.writable = false; return local; }
    const config = this.writable ? payload.config : payload;
    this.revision = this.writable ? payload.revision : configFingerprint(config);
    if (!config) return local;
    const marker = localStorage.getItem(this.storageKey + "-project-revision");
    if (!this.writable && marker === this.revision && local) return local;
    if (local && JSON.stringify(local) !== JSON.stringify(config))
      localStorage.setItem(this.storageKey + "-local-backup", JSON.stringify(local));
    return config;
  }
  markLoaded() {
    if (typeof window !== "undefined" && this.revision)
      localStorage.setItem(this.storageKey + "-project-revision", this.revision);
  }
  async save(config) {
    if (!this.writable) return;
    const response = await fetch(`/__project-config/${this.section}`, {
      method: "PUT", headers: { "Content-Type": "application/json", "If-Match": this.revision || "missing" },
      body: JSON.stringify(config), signal: AbortSignal.timeout(30000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "项目配置写入失败");
    this.revision = result.revision;
    this.markLoaded();
  }
  // Another tab saved to the shared file before broadcasting its local cache.
  syncRevision() {
    if (typeof window !== "undefined") this.revision = localStorage.getItem(this.storageKey + "-project-revision") || this.revision;
  }
}
