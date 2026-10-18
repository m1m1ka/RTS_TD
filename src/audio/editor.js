import "../retro-theme.css";
import "../config/editor.css";
import "./editor.css";
import { escapeHTML as esc } from "../config/schema.js";
import { AUDIO_EVENTS, assertAudioConfig, MAX_LIBRARY_BYTES } from "./schema.js";
import { getAudioConfig, saveAudioConfig, subscribeAudioConfig, audioLoadError, importAudioFiles, exportAudioBundle, importAudioBundle, audioSavesToProject } from "./store.js";
import { SoundPlayer } from "./player.js";
const $=id=>document.getElementById(id);
let draft=getAudioConfig(), dirty=false, conflict=false, saving=false, busy=false, missing=new Set();
const player=new SoundPlayer(draft,{enabled:true,onError:text=>message(text,true),onPlayed:()=>{ $("stop-preview").textContent="■ 停止试听"; }});
function message(text,error=false) { $("audio-message").hidden=false;$("audio-message").textContent=text;$("audio-message").classList.toggle("error",error); }
function markDirty() { dirty=true;$("audio-save-state").textContent="未保存";player.setConfig(structuredClone(draft)); }
function options(selected) { return '<option value="">未绑定</option>'+draft.assets.map(a=>`<option value="${esc(a.id)}" ${a.id===selected?"selected":""}>${esc(a.path)}${missing.has(a.id)?"（文件缺失）":""}</option>`).join(""); }
function renderLibrary() {
  $("audio-count").textContent=`${draft.assets.length} 个`;
  const query=$("audio-search").value.toLowerCase(), assets=draft.assets.filter(a=>(a.name+" "+a.path).toLowerCase().includes(query));
  $("audio-library").innerHTML=assets.map(a=>`<article class="audio-file ${missing.has(a.id)?"missing":""}"><div><strong>${esc(a.name)}</strong><small title="${esc(a.path)}">${esc(a.path)}</small><small>${a.source==="project"?"项目目录":"已导入"} · ${(a.size/1024).toFixed(1)} KB${missing.has(a.id)?" · 文件缺失":""}</small></div><button data-preview-file="${esc(a.id)}" aria-label="试听 ${esc(a.name)}" ${missing.has(a.id)?"disabled":""}>▶</button></article>`).join("") || '<p class="audio-empty">暂无音效。放入 public/audio，或选择本地文件夹导入。</p>';
}
function render() {
  $("master-volume").value=Math.round(draft.masterVolume*100);$("master-value").textContent=Math.round(draft.masterVolume*100)+"%";
  renderLibrary();
  $("audio-events").innerHTML=Object.entries(AUDIO_EVENTS).map(([key,[name,group]])=>{
    const event=draft.events[key];
    return `<article class="audio-event" data-event="${key}"><div class="audio-event-heading"><label><input type="checkbox" data-event-enabled="${key}" ${event.enabled?"checked":""}><strong>${name}</strong></label><small>${group}</small></div><div class="audio-event-controls"><select aria-label="${name}音效" data-event-sound="${key}">${options(event.sound)}</select><button data-preview-event="${key}" ${!event.sound||missing.has(event.sound)?"disabled":""}>▶ 试听</button><label>音量 <input type="range" min="0" max="100" value="${Math.round(event.volume*100)}" data-event-volume="${key}" aria-label="${name}音量"><output>${Math.round(event.volume*100)}%</output></label><label>间隔 <input type="number" min="0" max="5000" step="10" value="${event.cooldown}" data-event-cooldown="${key}" aria-label="${name}最短间隔"> ms</label></div></article>`;
  }).join("");
}
async function scan(quiet=false) {
  if(busy)return;
  try {
    const response=await fetch("/audio-manifest.json",{cache:"no-store"});if(!response.ok)throw new Error("扫描失败，请确认开发服务或构建产物包含音效清单");
    const data=await response.json();if(!Array.isArray(data.assets))throw new Error("音效清单格式错误");
    const next=structuredClone(draft), found=new Set(data.assets.map(a=>a.id));
    for(const asset of data.assets) {
      const old=next.assets.findIndex(a=>a.id===asset.id);
      if(old<0)next.assets.push(asset);else if(next.assets[old].source==="project")next.assets[old]=asset;
    }
    assertAudioConfig(next);
    const nextMissing=new Set(next.assets.filter(a=>a.source==="project"&&!found.has(a.id)).map(a=>a.id));
    const changed=JSON.stringify(next)!==JSON.stringify(draft), missingChanged=[...nextMissing].join()!==[...missing].join();
    missing=nextMissing;
    if(changed){draft=next;markDirty();}if(changed||missingChanged)render();
    if(!quiet)message(`识别到 ${data.assets.length} 个项目音效${missing.size?`，${missing.size} 个已配置文件缺失`:""}。${changed?"保存后可在游戏中使用。":""}`);
  } catch(e) { if(!quiet)message(e.message,true); }
}
async function run(action) {
  if(busy)return;busy=true;
  for(const button of document.querySelectorAll('.toolbar button,.audio-import-actions button'))button.disabled=true;
  try { await action(); }catch(e){message(e.message,true);}finally{busy=false;for(const button of document.querySelectorAll('.toolbar button,.audio-import-actions button'))button.disabled=false;}
}
$("audio-search").addEventListener("input",renderLibrary);
$("master-volume").addEventListener("input",e=>{draft.masterVolume=Number(e.target.value)/100;$("master-value").textContent=e.target.value+"%";markDirty();});
$("audio-events").addEventListener("input",e=>{
  const target=e.target;
  if(target.dataset.eventVolume) { draft.events[target.dataset.eventVolume].volume=Number(target.value)/100;target.nextElementSibling.textContent=target.value+"%";markDirty(); }
  if(target.dataset.eventCooldown) { draft.events[target.dataset.eventCooldown].cooldown=Number(target.value);markDirty(); }
});
$("audio-events").addEventListener("change",e=>{
  const target=e.target;
  if(target.dataset.eventSound) { draft.events[target.dataset.eventSound].sound=target.value;markDirty();render(); }
  if(target.dataset.eventEnabled) { draft.events[target.dataset.eventEnabled].enabled=target.checked;markDirty(); }
});
document.addEventListener("click",async e=>{
  const button=e.target.closest("button");if(!button)return;
  if(button.dataset.previewFile || button.dataset.previewEvent) {
    player.stop();player.reported.clear();player.unlock();
    const key=button.dataset.previewEvent || "preview";
    await player.play(key,{preview:true,assetId:button.dataset.previewFile});
  }
});
$("stop-preview").onclick=()=>{player.stop();$("stop-preview").textContent="停止试听";};
$("scan-audio").onclick=()=>scan();
$("import-audio-folder").onclick=()=>$("audio-folder-input").click();
$("import-audio-files").onclick=()=>$("audio-files-input").click();
for(const id of ["audio-folder-input","audio-files-input"]) $(id).onchange=e=>run(async()=>{
  const files=[...e.target.files];e.target.value="";if(!files.length)return;
  const result=await importAudioFiles(files,draft);draft=result.config;markDirty();render();message(`已导入 ${result.added} 个新音效${result.skipped?`，忽略 ${result.skipped} 个非音频文件`:""}。保存后生效。`);
});
$("save-audio").onclick=()=>run(async()=>{
  if(conflict)throw new Error("其他页面已修改音频配置，请先导出当前草稿，再刷新页面合并后保存。");
  saving=true;
  try{draft=await saveAudioConfig(draft);dirty=false;$("audio-save-state").textContent="✓ 已保存并同步";message(audioSavesToProject()?"已写入 public/config/audio.json（包含导入音效），提交推送后可随仓库迁移。":"音频配置已保存至本机。静态部署请导出后在本地导入保存至项目。");}finally{saving=false;}
});
$("export-audio-config").onclick=()=>run(async()=>{
  const blob=new Blob([await exportAudioBundle(draft)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="friday-audio-config.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message("已导出音频配置，包含全部音效数据。");
});
$("import-audio-config").onclick=()=>$("audio-config-input").click();
$("audio-config-input").onchange=e=>run(async()=>{
  const file=e.target.files[0];e.target.value="";if(!file)return;
  if(file.size>MAX_LIBRARY_BYTES*1.5)throw new Error("音频配置文件太大");
  const next=await importAudioBundle(await file.text());draft=next;conflict=false;missing.clear();markDirty();render();message("已载入音频配置及文件，点击保存后生效。");
});
subscribeAudioConfig(next=>{
  if(saving)return;
  if(dirty){conflict=true;message("其他页面更新了音频配置。当前草稿已保留，请导出备份后刷新合并。",true);}
  else{draft=structuredClone(next);player.setConfig(draft);render();message("已同步最新音频配置。");}
});
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
window.addEventListener("pagehide",()=>player.stop());
render();if(audioLoadError)message(audioLoadError,true);else scan();
setInterval(()=>{if(document.visibilityState==="visible")scan(true);},8000);
