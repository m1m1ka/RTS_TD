import { audioEventsFor } from "./schema.js";
import { audioBlob } from "./store.js";
export class SoundPlayer {
  constructor(config,{enabled=false,onError=()=>{},onPlayed=()=>{}}={}) {
    Object.assign(this,{config,enabled,onError,onPlayed,context:null,generation:0,voices:new Set(),cache:new Map(),last:new Map(),reported:new Set()});
  }
  setConfig(config) { this.config=config;this.generation++;this.stop();this.cache.clear();this.last.clear();this.reported.clear(); }
  setEnabled(enabled) { this.enabled=enabled;this.generation++;if(enabled)this.unlock();else this.stop(); }
  unlock() {
    if(!this.enabled)return;
    try { this.context??=new (window.AudioContext||window.webkitAudioContext)();if(this.context.state==="suspended")this.context.resume().catch(()=>{}); }
    catch(e) { this.error("context",e); }
  }
  error(key,error) { if(this.reported.has(key))return;this.reported.add(key);this.onError(error.message||"音频播放失败"); }
  configured(key) { const event=this.config.events[key];return !!event && (!!event.sound || !event.enabled); }
  handleEvent(event) { const keys=audioEventsFor(event);for(const key of keys)this.play(key);return keys.some(key=>this.configured(key)); }
  async buffer(asset) {
    const key=asset.id+":"+(asset.modified||0);
    if(!this.cache.has(key))this.cache.set(key,audioBlob(asset).then(blob=>blob.arrayBuffer()).then(data=>this.context.decodeAudioData(data)));
    return this.cache.get(key);
  }
  async play(key, {preview=false, assetId}={}) {
    const setting=this.config.events[key], id=assetId??setting?.sound;
    if(!this.enabled || !id || (!preview && !setting?.enabled))return false;
    const asset=this.config.assets.find(a=>a.id===id);if(!asset)return false;
    this.unlock();if(!this.context)return false;
    const generation=this.generation;
    if(this.context.state!=="running") { try{await this.context.resume();}catch(e){this.error("context",e);return false;} }
    if(!this.enabled || generation!==this.generation || this.context.state!=="running")return false;
    const now=this.context.currentTime, cooldown=preview?0:setting.cooldown/1000;
    if(!preview && now-(this.last.get(key)??-Infinity)<cooldown)return false;
    const volume=this.config.masterVolume*(setting?.volume??1);if(volume<=0)return false;
    this.last.set(key,now);
    try {
      const buffer=await this.buffer(asset);
      if(!this.enabled || generation!==this.generation || this.context.state!=="running")return false;
      if(this.voices.size>=24 || [...this.voices].filter(v=>v.key===key).length>=4)return false;
      const source=this.context.createBufferSource(), gain=this.context.createGain();
      source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(this.context.destination);
      const voice={source,gain,key};this.voices.add(voice);
      source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};
      source.start();this.onPlayed({key,asset:id,volume});return true;
    } catch(e) { this.error(id,new Error(`${asset.name}：${e.message || "文件无法解码"}`));return false; }
  }
  tone(freq=440,duration=.06,type="sine",volume=.025) {
    if(!this.enabled || !this.config.masterVolume)return;
    this.unlock();const context=this.context;if(!context || context.state!=="running" || this.voices.size>=24)return;
    const source=context.createOscillator(), gain=context.createGain();source.type=type;source.frequency.value=freq;
    gain.gain.setValueAtTime(Math.max(.0001,volume*this.config.masterVolume),context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+duration);
    source.connect(gain);gain.connect(context.destination);
    const voice={source,gain,key:"tone"};this.voices.add(voice);
    source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};source.start();source.stop(context.currentTime+duration);
  }
  stop() { this.generation++;for(const voice of this.voices) { try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect(); }this.voices.clear(); }
}
