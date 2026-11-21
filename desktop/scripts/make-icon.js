// Renders assets/icon.svg to assets/icon.png (1024x1024) for the app icon.
// Run with: npx electron scripts/make-icon.js
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, "..", "assets", "icon.svg"), "utf8");
  const window = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, useContentSize: true });
  const page = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(path.join(__dirname, "..", "assets", "icon.png"), image.resize({ width: 1024, height: 1024 }).toPNG());
  app.quit();
});
