const { app, BrowserWindow, protocol, net, ipcMain, Menu } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
protocol.registerSchemesAsPrivileged([{ scheme: "cardheroes", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
let win;
app.setName("卡片勇者");
app.whenReady().then(async () => {
  const root = path.join(app.getAppPath(), "dist");
  protocol.handle("cardheroes", request => {
    const url = new URL(request.url);
    const file = path.resolve(root, "." + decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (url.host !== "game" || !file.startsWith(root + path.sep)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    title: "卡片勇者", width: 1440, height: 900, minWidth: 960, minHeight: 640,
    backgroundColor: "#080b10", show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  ipcMain.handle("fullscreen:toggle", () => {
    const active = !win.isFullScreen();
    win.setFullScreen(active);
    return active;
  });
  ipcMain.on("fullscreen:exit", () => win.setFullScreen(false));
  win.on("enter-full-screen", () => win.webContents.send("fullscreen:changed", true));
  win.on("leave-full-screen", () => win.webContents.send("fullscreen:changed", false));
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("cardheroes://game/")) event.preventDefault();
  });
  win.once("ready-to-show", () => win.show());
  await win.loadURL("cardheroes://game/");
});
app.on("window-all-closed", () => app.quit());
