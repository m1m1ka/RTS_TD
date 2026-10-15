import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { audioExtensions, MAX_AUDIO_BYTES } from "../src/audio/schema.js";
export async function scanAudioDirectory(root) {
  const assets = [];
  async function walk(directory) {
    let entries;
    try { entries = await readdir(directory,{withFileTypes:true}); } catch(error) { if(error.code==="ENOENT")return; throw error; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory,entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && audioExtensions.test(entry.name)) {
        const info = await stat(absolute), relative = path.relative(root,absolute).split(path.sep).join("/");
        if (!info.size || info.size > MAX_AUDIO_BYTES) continue;
        assets.push({id:"project:"+relative,name:entry.name,path:relative,source:"project",url:"/audio/"+relative.split("/").map(encodeURIComponent).join("/"),size:info.size,modified:info.mtimeMs});
      }
    }
  }
  await walk(root);
  return assets.sort((a,b)=>a.path.localeCompare(b.path));
}
export function audioCatalogPlugin(root) {
  return {
    name:"audio-catalog",
    configureServer(server) {
      server.middlewares.use("/audio-manifest.json",async(req,res,next)=>{
        if (req.method!=="GET") return next();
        try { res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify({assets:await scanAudioDirectory(root)})); }
        catch { res.statusCode=500;res.end(JSON.stringify({error:"音效目录扫描失败"})); }
      });
    },
    async generateBundle() { this.emitFile({type:"asset",fileName:"audio-manifest.json",source:JSON.stringify({assets:await scanAudioDirectory(root)})}); },
  };
}
