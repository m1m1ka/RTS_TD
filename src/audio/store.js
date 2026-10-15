import { defaultAudioConfig, assertAudioConfig, audioExtensions, MAX_AUDIO_BYTES, MAX_LIBRARY_BYTES } from "./schema.js";
export const AUDIO_CONFIG_KEY = "friday-defense-audio-v1";
const listeners = new Set();
export let audioLoadError = "";
let current = defaultAudioConfig(), database;
if (typeof window !== "undefined") {
  try { const saved = localStorage.getItem(AUDIO_CONFIG_KEY); if(saved)current=assertAudioConfig(JSON.parse(saved)); }
  catch(e) { audioLoadError = "音频配置读取失败：" + e.message; }
  window.addEventListener("storage",e=>{
    if(e.key!==AUDIO_CONFIG_KEY)return;
    try { current=e.newValue?assertAudioConfig(JSON.parse(e.newValue)):defaultAudioConfig();for(const fn of listeners)fn(current); }
    catch(error) { console.warn("音频配置同步失败",error.message); }
  });
}
export const getAudioConfig = () => structuredClone(current);
export function subscribeAudioConfig(fn) { listeners.add(fn);return()=>listeners.delete(fn); }
export function saveAudioConfig(config) {
  const next=assertAudioConfig(config);
  localStorage.setItem(AUDIO_CONFIG_KEY,JSON.stringify(next));
  current=next;for(const fn of listeners)fn(current);
  return structuredClone(next);
}
function openDatabase() {
  if(!database)database=new Promise((resolve,reject)=>{
    const request=indexedDB.open("friday-defense-audio",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("files");
    request.onsuccess=()=>{ const db=request.result;db.onversionchange=()=>{db.close();database=null;};resolve(db); };
    request.onerror=()=>reject(new Error("无法打开音效库："+request.error?.message));
  }).catch(e=>{database=null;throw e;});
  return database;
}
export async function storeAudioFiles(entries) {
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readwrite");
    for(const [id,blob] of entries)tx.objectStore("files").put(blob,id);
    tx.oncomplete=resolve;tx.onabort=()=>reject(new Error("保存音效失败，请检查浏览器存储空间"));tx.onerror=()=>{};
  });
}
export async function audioBlob(asset) {
  if(asset.source==="project") {
    const response=await fetch(asset.url,{cache:"no-cache"});
    if(!response.ok)throw new Error(`找不到音效：${asset.path}`);
    const blob=await response.blob();
    if(blob.size>MAX_AUDIO_BYTES)throw new Error("单个音效不能超过 20 MB");
    return blob;
  }
  const db=await openDatabase();
  const blob=await new Promise((resolve,reject)=>{const request=db.transaction("files").objectStore("files").get(asset.id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  if(!blob)throw new Error(`音效数据缺失，请重新导入：${asset.name}`);
  return blob;
}
async function audioId(bytes) {
  // Imported blobs never overwrite bytes referenced by an already-saved config.
  const hash=crypto.subtle ? new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)) : crypto.getRandomValues(new Uint8Array(24));
  return "local:"+[...hash].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function importAudioFiles(files, config) {
  const candidates=[...files].filter(file=>audioExtensions.test(file.name));
  if(!candidates.length)throw new Error("没有找到支持的音效文件");
  if(candidates.length>500 || candidates.reduce((n,f)=>n+f.size,0)>MAX_LIBRARY_BYTES)throw new Error("一次最多导入 500 个音效，总大小不超过 200 MB");
  const next=structuredClone(config), entries=[];
  for(const file of candidates) {
    if(!file.size || file.size>MAX_AUDIO_BYTES)throw new Error(`${file.name}：单个音效须为 1 字节～20 MB`);
    const id=await audioId(await file.arrayBuffer());
    if(next.assets.some(a=>a.id===id))continue;
    next.assets.push({id,name:file.name,path:file.webkitRelativePath||file.name,size:file.size,source:"local"});entries.push([id,file]);
  }
  assertAudioConfig(next);
  await storeAudioFiles(entries);
  return {config:next, added:entries.length, skipped:files.length-candidates.length};
}
const dataURL = blob => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
export async function exportAudioBundle(config) {
  const next=assertAudioConfig(config), assets=[];
  for(const asset of next.assets) {
    const blob=await audioBlob(asset), {url,modified,...metadata}=asset;
    assets.push({...metadata,source:"local",size:blob.size,data:await dataURL(blob)});
  }
  return JSON.stringify({...next,assets},null,2);
}
export async function importAudioBundle(text) {
  const input=JSON.parse(text), entries=[], assets=[], remap=new Map();
  if(!input || !Array.isArray(input.assets) || input.assets.length>500)throw new Error("不是有效的音频配置文件");
  let total=0;
  for(const asset of input.assets) {
    const {data,...metadata}=asset || {};
    if(typeof data!=="string" || !/^data:(?:audio\/[\w.+-]+|application\/(?:octet-stream|ogg))?;base64,[A-Za-z0-9+/]*={0,2}$/.test(data))throw new Error("音频配置必须包含完整的音频数据");
    const comma=data.indexOf(","), bytes=Uint8Array.from(atob(data.slice(comma+1)),c=>c.charCodeAt(0));
    total+=bytes.length;
    if(bytes.length>MAX_AUDIO_BYTES || total>MAX_LIBRARY_BYTES)throw new Error("音频文件超过大小限制");
    const blob=new Blob([bytes],{type:data.slice(5,data.indexOf(";"))||"application/octet-stream"});
    if(remap.has(metadata.id))throw new Error("音频 ID 重复");
    const id=await audioId(bytes);
    remap.set(metadata.id,id);
    delete metadata.url; delete metadata.modified;
    if(!assets.some(a=>a.id===id)) {assets.push({...metadata,id,source:"local",size:blob.size});entries.push([id,blob]);}
  }
  for(const event of Object.values(input.events||{}))if(event && event.sound && remap.has(event.sound))event.sound=remap.get(event.sound);
  const next=assertAudioConfig({...input,assets});
  await storeAudioFiles(entries);
  return next;
}
