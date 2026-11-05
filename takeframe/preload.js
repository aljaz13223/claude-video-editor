const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('host', {
  invoke: (ch, arg) => ipcRenderer.invoke(ch, arg),
  on: (ch, fn) => ipcRenderer.on(ch, (_, ...a) => fn(...a)),
  send: (ch, ...a) => ipcRenderer.send(ch, ...a),
  pathOf: (file) => (webUtils && webUtils.getPathForFile ? webUtils.getPathForFile(file) : file.path),
});
