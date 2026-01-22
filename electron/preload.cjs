const { contextBridge, ipcRenderer } = require('electron');

// 通过 contextBridge 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,

  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 更新相关
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-status');
  },

  // 存储路径相关
  selectStoragePath: () => ipcRenderer.invoke('select-storage-path'),
  getStoragePath: () => ipcRenderer.invoke('get-storage-path'),
  setStoragePath: (path) => ipcRenderer.invoke('set-storage-path', path),
  migrateData: (newPath) => ipcRenderer.invoke('migrate-data', newPath),
  openStoragePath: () => ipcRenderer.invoke('open-storage-path'),

  // 环境标识
  isElectron: true,

  // --- RunningHub IPC ---
  runningHub: {
    saveFile: (url, name, subDir) => ipcRenderer.invoke('rh-save-file', { url, name, subDir }),
    getConfig: () => ipcRenderer.invoke('rh-get-config'),
    saveConfig: (settings) => ipcRenderer.invoke('rh-save-config', settings),
    decodeImage: (buffer, fileName, filePath) => ipcRenderer.invoke('rh-decode-image', { buffer, fileName, filePath })
  },

  // Top-level alias for backward compatibility
  decodeImage: (buffer, fileName, filePath) => ipcRenderer.invoke('rh-decode-image', { buffer, fileName, filePath }),

  // --- File Explorer IPC ---
  fileExplorer: {
    listDrives: () => ipcRenderer.invoke('fs:list-drives'),
    readDir: (dirPath) => ipcRenderer.invoke('fs:read-dir', dirPath),
    watchPath: (dirPath) => ipcRenderer.invoke('fs:watch-path', dirPath),
    stopWatch: () => ipcRenderer.invoke('fs:stop-watch'),
    getThumbnail: (imagePath, size) => ipcRenderer.invoke('fs:get-thumbnail', imagePath, size),
    onFolderChange: (callback) => {
      ipcRenderer.on('fs:folder-change', (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('fs:folder-change');
    },
    // 右鍵選單操作
    openInExplorer: (filePath) => ipcRenderer.invoke('fs:open-in-explorer', filePath),
    copyPath: (filePath) => ipcRenderer.invoke('fs:copy-path', filePath),
    copyToDesktop: (filePath) => ipcRenderer.invoke('fs:copy-to-desktop', filePath),
    getDefaultPath: () => ipcRenderer.invoke('fs:get-default-path')
  }
});

console.log('Preload script loaded');

