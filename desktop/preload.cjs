const { contextBridge, ipcRenderer } = require("electron");
window.addEventListener("keydown", event => {
  if (event.repeat) return;
  if (event.code === "F11") {
    event.preventDefault();
    ipcRenderer.invoke("fullscreen:toggle");
  } else if (event.code === "Escape") ipcRenderer.send("fullscreen:exit");
}, true);
contextBridge.exposeInMainWorld("cardHeroes", {
  toggleFullscreen: () => ipcRenderer.invoke("fullscreen:toggle"),
  onFullscreen: callback => ipcRenderer.on("fullscreen:changed", (_event, active) => callback(active)),
});
