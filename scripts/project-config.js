import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { assertConfig } from "../src/config/schema.js";
import { assertAudioConfig, MAX_LIBRARY_BYTES } from "../src/audio/schema.js";
import { configFingerprint } from "../src/config/project-sync.js";

export function validateProjectConfig(section, input) {
  if (section === "game") return assertConfig(input);
  const config = assertAudioConfig(input);
  // Local audio must carry its bytes, not just an IndexedDB identifier.
  for (const asset of config.assets) if (asset.source === "local") {
    if (typeof asset.data !== "string" || !/^data:(?:audio\/[\w.+-]+|application\/(?:octet-stream|ogg))?;base64,[A-Za-z0-9+/]*={0,2}$/.test(asset.data))
      throw new Error("本地音效必须包含可迁移的音频数据");
    if (Buffer.from(asset.data.slice(asset.data.indexOf(",") + 1), "base64").length !== asset.size)
      throw new Error("音效数据大小不匹配");
  }
  return config;
}
export function projectConfigPlugin(root) {
  const directory = process.env.FRIDAY_CONFIG_DIR || path.join(root, "public", "config");
  let queue = Promise.resolve();
  return {
    name: "project-config",
    configureServer(server) {
      // Saving settings must not restart a running battle via Vite's public-file HMR.
      server.watcher.unwatch(directory);
      server.middlewares.use(async (req, res, next) => {
        const match = /^\/__project-config\/(game|audio)(?:\?.*)?$/.exec(req.url || "");
        if (!match) return next();
        const section = match[1], file = path.join(directory, section + ".json");
        const respond = (code, body) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); };
        if (process.env.FRIDAY_CONFIG_SYNC === "0") return respond(200, { enabled: false });
        const read = async () => {
          try { const config = JSON.parse(await readFile(file, "utf8")); return { enabled: true, config, revision: configFingerprint(config) }; }
          catch (error) { if (error.code === "ENOENT") return { enabled: true, config: null, revision: null }; throw error; }
        };
        try {
          if (req.method === "GET") return respond(200, await read());
          if (req.method !== "PUT") return respond(405, { error: "不支持此操作" });
          const origin = req.headers.origin;
          if (!origin || new URL(origin).host !== req.headers.host || !/^https?:/.test(origin)) return respond(403, { error: "只接受配置页的同源保存" });
          if (!req.headers["content-type"]?.startsWith("application/json")) return respond(415, { error: "需要 JSON 配置" });
          const chunks = []; let size = 0;
          const limit = section === "game" ? 14 * 1024 * 1024 : MAX_LIBRARY_BYTES * 1.5;
          for await (const chunk of req) { size += chunk.length; if (size > limit) return respond(413, { error: "配置文件过大" }); chunks.push(chunk); }
          const config = validateProjectConfig(section, JSON.parse(Buffer.concat(chunks).toString("utf8")));
          // Serialize writes so stale tabs cannot race and silently overwrite another save.
          const operation = queue.then(async () => {
            const previous = await read();
            if (req.headers["if-match"] !== (previous.revision || "missing")) return respond(409, { error: "项目配置已更新，请先导出草稿备份，再刷新页面合并" });
            await mkdir(directory, { recursive: true });
            const temporary = file + ".tmp";
            await writeFile(temporary, JSON.stringify(config, null, 2) + "\n", "utf8");
            await rename(temporary, file);
            respond(200, { revision: configFingerprint(config) });
          });
          queue = operation.catch(() => {});
          await operation;
        } catch (error) { if (!res.writableEnded) respond(400, { error: error.message }); }
      });
    },
  };
}
