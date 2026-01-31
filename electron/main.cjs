console.log('🚀 [main.cjs] FILE LOADING STARTED...');
const { app, BrowserWindow, Menu, nativeImage, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');
const https = require('https');
const http = require('http');

// File Explorer dependencies (optional - will gracefully handle if missing)
let chokidar = null;
try {
  chokidar = require('chokidar');
  console.log('✅ chokidar loaded successfully');
} catch (e) {
  console.warn('⚠️ chokidar not available:', e.message);
}



// RunningHub Settings Helper
const getRhSettingsPath = () => path.join(app.getPath('userData'), 'rh_settings.json');
const readRhSettings = () => {
  try {
    if (fs.existsSync(getRhSettingsPath())) {
      return JSON.parse(fs.readFileSync(getRhSettingsPath(), 'utf8'));
    }
  } catch (e) { console.error('RH Settings Read Error:', e); }
  return { apiKey: '', autoSave: true, autoDecode: true };
};
const saveRhSettings = (settings) => {
  try {
    const current = readRhSettings();
    fs.writeFileSync(getRhSettingsPath(), JSON.stringify({ ...current, ...settings }, null, 2));
    return true;
  } catch (e) {
    console.error('RH Settings Save Error:', e);
    return false;
  }
};
// 配置引數
const CONFIG = {
  windowWidth: 1280,
  windowHeight: 800,
  minWidth: 1024,
  minHeight: 768,
  backendPort: 8766,
  backendHost: '127.0.0.1',
  isDev: !app.isPackaged
};

let mainWindow = null;
let splashWindow = null;
let backendServer = null;

// Helper: Get Base Output Path
// Must match the logic in startBackendServer() for backend to serve files correctly
function logToFile(msg) {
  try {
    const logPath = 'C:\\Users\\87boss\\debug_startup.log';
    fs.appendFileSync(logPath, new Date().toISOString() + ' ' + msg + '\n');
  } catch (e) { }
}

function getBaseOutputPath() {
  logToFile(`[getBaseOutputPath] Called. global.userDataPath: ${global.userDataPath}`);

  // Logic: 
  // 1. If we have a custom path (loaded from config/global), return it DIRECTLY (no 'output' subfolder).
  // 2. If we rely on default, append 'output'.

  // Check config first to be sure (as global might be flaky based on previous tasks)
  let customPath = null;
  try {
    const config = loadStorageConfig();
    if (config && config.customPath) {
      customPath = config.customPath;
    }
  } catch (e) { }

  if (customPath) {
    logToFile(`[getBaseOutputPath] Using Custom Path: ${customPath}`);
    if (!fs.existsSync(customPath)) {
      try { fs.mkdirSync(customPath, { recursive: true }); } catch (e) { }
    }
    return customPath;
  }

  // Backup: Check global variable (might be same as customPath)
  if (global.userDataPath && global.userDataPath !== app.getPath('userData') && global.userDataPath !== process.cwd()) {
    // Heuristic: if it looks like a custom path, use it directly? 
    // Better to rely on loadStorageConfig above. but if that failed...
    // Let's assume global.userDataPath IS the base.
    // But wait, for default path, global.userDataPath is Documents/87Boss...
    // We need to know if it is CUSTOM or DEFAULT to decide on appending 'output'.
    // Since config check above handles Custom, here we assume Default behavior if we reached here?
    // OR we can check if global.userDataPath matches config.customPath.
  }

  // If we are here, it means NO custom path found in config. Use Default.

  let baseDataPath;
  if (!app.isPackaged) {
    baseDataPath = process.cwd();
  } else {
    baseDataPath = path.join(app.getPath('documents'), '87Boss_RunningHub_Data');
    if (!fs.existsSync(baseDataPath)) {
      try { fs.mkdirSync(baseDataPath, { recursive: true }); } catch (e) {
        baseDataPath = app.getPath('userData');
      }
    }
  }

  // Default path ALWAYS has 'output' subfolder
  const outputPath = path.join(baseDataPath, 'output');
  if (!fs.existsSync(outputPath)) {
    try { fs.mkdirSync(outputPath, { recursive: true }); } catch (e) { }
  }
  return outputPath;
}

// 版本更新內容說明（業務向）
const RELEASE_NOTES = {
  '1.4.1': {
    title: '🎉 重磅更新 v1.4.1',
    content: '本次更新內容：\n\n✨ 影片節點批次輸出改造\n• 影片節點現在支援批次生成（最多4個）\n• 生成結果自動彈出獨立的影片容器節點\n\n🎬 影片工具欄\n• 新增影片專用工具球\n• 支援提取首幀/尾幀，輸出為圖片節點\n\n🚀 Veo3.1 全系列模型支援\n• 支援 6 種模型：fast/4k/pro/pro-4k/comp/comp-4k\n• 新增增強提示詞開關\n\n📷 畫布體驗最佳化\n• 最佳化畫布佈局，滿鋪全屏\n• 最佳化錯誤狀態顯示\n\n感謝您的使用！'
  },
  '1.4.0': {
    title: '🎉 重磅更新 v1.4.0',
    content: '本次更新內容：\n\n✨ 影片節點批次輸出改造\n• 影片節點現在支援批次生成（最多4個）\n• 生成結果自動彈出獨立的影片容器節點\n\n🎬 影片工具欄\n• 新增影片專用工具球\n• 支援提取首幀/尾幀，輸出為圖片節點\n\n🚀 Veo3.1 全系列模型支援\n• 支援 6 種模型：fast/4k/pro/pro-4k/comp/comp-4k\n• 新增增強提示詞開關\n\n📷 畫布體驗最佳化\n• 最佳化畫布佈局，滿鋪全屏\n• 最佳化錯誤狀態顯示\n\n感謝您的使用！'
  },
  '1.3.7': {
    title: '🎉 歡迎使用新版本 v1.3.7',
    content: '本次更新內容：\n\n• 新增自定義資料儲存路徑功能\n• 支援資料遷移到新位置\n• 可在設定中管理儲存位置\n\n感謝您的使用！'
  },
  '1.2.7': {
    title: '🎉 歡迎使用新版本 v1.2.7',
    content: '本次更新內容：\n\n• 修復了畫布中 Veo 3.1 影片生成後無法正常顯示的問題\n• 最佳化了影片下載穩定性\n• 減少了瀏覽器記憶體佔用\n\n感謝您的使用！'
  },
  '1.3.0': {
    title: '🎉 歡迎使用新版本 v1.3.0',
    content: '本次更新內容：\n\n• 最佳化了應用效能和穩定性\n• 修復了已知問題\n\n感謝您的使用！'
  },
  '1.3.1': {
    title: '🎉 歡迎使用新版本 v1.3.1',
    content: '本次更新內容：\n\n• 最佳化了應用效能和穩定性\n• 修復了已知問題\n\n感謝您的使用！'
  },
  '1.3.2': {
    title: '🎉 歡迎使用新版本 v1.3.2',
    content: '本次更新內容：\n\n• 全新自定義更新彈窗樣式，更精美的UI體驗\n• 設定中新增檢查更新按鈕\n• 最佳化了應用效能和穩定性\n\n感謝您的使用！'
  },
  '1.3.3': {
    title: '🎉 歡迎使用新版本 v1.3.3',
    content: '本次更新內容：\n\n• 修復更新彈窗內容顯示不全的問題\n• 最佳化設定彈窗UI風格\n• 統一應用內捲軸樣式\n\n感謝您的使用！'
  },
  '1.3.7': {
    title: '🎉 歡迎使用新版本 v1.3.7',
    content: '本次更新內容：\n\n• 新增自定義資料儲存路徑功能\n• 支援資料遷移到新位置\n• 可在設定中管理儲存位置\n\n感謝您的使用！'
  },
  '1.3.6': {
    title: '🎉 歡迎使用新版本 v1.3.6',
    content: '本次更新內容：\n\n• 全新設定彈窗 UI 設計\n• 統一冰藍色系視覺風格\n• 最佳化 API 配置佈局\n• 底部資訊欄固定展示\n\n感謝您的使用！'
  },
  '1.3.5': {
    title: '🎉 歡迎使用新版本 v1.3.5',
    content: '本次更新內容：\n\n• 全新設定彈窗 UI 設計\n• 統一冰藍色系視覺風格\n• 最佳化 API 配置佈局\n• 底部資訊欄固定展示\n\n感謝您的使用！'
  },
  '1.3.4': {
    title: '🎉 歡迎使用新版本 v1.3.4',
    content: '本次更新內容：\n\n• 修復更新彈窗圖示無法顯示的問題\n• 修復彈窗可拖動的問題\n• 修復內容區域無法滾動的問題\n\n感謝您的使用！'
  }
};

// 檢查並顯示更新後歡迎提示（自定義彈窗）
function checkAndShowWelcome() {
  const currentVersion = app.getVersion();
  const versionFile = path.join(app.getPath('userData'), 'last_version.txt');

  let lastVersion = '';
  try {
    if (fs.existsSync(versionFile)) {
      lastVersion = fs.readFileSync(versionFile, 'utf-8').trim();
    }
  } catch (e) {
    console.log('讀取版本檔案失敗:', e.message);
  }

  // 儲存當前版本
  try {
    fs.writeFileSync(versionFile, currentVersion);
  } catch (e) {
    console.log('儲存版本檔案失敗:', e.message);
  }

  // 如果版本不同且有更新日誌，顯示自定義歡迎彈窗
  if (lastVersion && lastVersion !== currentVersion && RELEASE_NOTES[currentVersion]) {
    const notes = RELEASE_NOTES[currentVersion];
    setTimeout(() => {
      showUpdateDialog(currentVersion, notes);
    }, 2000);
  }
}

// 顯示自定義更新彈窗
function showUpdateDialog(version, notes) {
  const contentLines = notes.content.split('\n').filter(line => line.trim());
  const contentHtml = contentLines.map(line => {
    if (line.startsWith('•')) {
      return `<div class="item"><span class="dot"></span><span>${line.substring(1).trim()}</span></div>`;
    }
    return `<div class="text">${line}</div>`;
  }).join('');

  const updateWindow = new BrowserWindow({
    width: 380,
    height: 440,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  updateWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        html, body {
          height: 100%;
          overflow: hidden;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        /* 自定義捲軸 */
        .content::-webkit-scrollbar { width: 4px; }
        .content::-webkit-scrollbar-track { background: transparent; }
        .content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        .content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
        .card {
          width: 340px;
          max-height: 400px;
          background: linear-gradient(180deg, rgba(23, 23, 23, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
          overflow: hidden;
          animation: fadeIn 0.3s ease-out;
          display: flex;
          flex-direction: column;
        }
        .header {
          padding: 24px 24px 16px;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }
        .icon-wrap {
          width: 56px;
          height: 56px;
          margin: 0 auto 12px;
          border-radius: 14px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 20px;
          margin-bottom: 8px;
        }
        .badge-text {
          font-size: 11px;
          font-weight: 600;
          color: #60a5fa;
          letter-spacing: 0.02em;
        }
        .version {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 4px;
        }
        .subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
        .content {
          padding: 20px 24px;
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          max-height: 150px;
        }
        .section-title {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 12px;
        }
        .item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 6px 0;
        }
        .dot {
          width: 6px;
          height: 6px;
          background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
          border-radius: 50%;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .item span:last-child {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.5;
        }
        .text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
          padding: 4px 0;
        }
        .footer {
          padding: 16px 24px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }
        .btn {
          width: 100%;
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
        }
        .btn:active {
          transform: translateY(0) scale(0.98);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
          </div>
          <div class="badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            <span class="badge-text">NEW VERSION</span>
          </div>
          <div class="version">v${version}</div>
          <div class="subtitle">已成功更新到最新版本</div>
        </div>
        <div class="content">
          <div class="section-title">更新內容</div>
          ${contentHtml}
        </div>
        <div class="footer">
          <button class="btn" onclick="window.close()">開始使用</button>
        </div>
      </div>
    </body>
    </html>
  `)}`);

  updateWindow.once('ready-to-show', () => {
    updateWindow.show();
  });
}

// 下載進度彈窗引用
let downloadProgressWindow = null;

// 顯示發現新版本彈窗
function showUpdateAvailableDialog(version, notes) {
  const iconPath = getIconPath() || '';
  const iconPathUrl = iconPath.replace(/\\/g, '/');
  const contentLines = notes.split('\n').filter(line => line.trim());
  const contentHtml = contentLines.map(line => {
    if (line.startsWith('•')) {
      return `<div class="item"><span class="dot"></span><span>${line.substring(1).trim()}</span></div>`;
    }
    return `<div class="text">${line}</div>`;
  }).join('');

  const updateAvailableWindow = new BrowserWindow({
    width: 380,
    height: 380,
    frame: false,
    transparent: true,
    resizable: false,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  updateAvailableWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: transparent;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          -webkit-app-region: drag;
        }
        .card {
          width: 340px;
          background: linear-gradient(180deg, rgba(23, 23, 23, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
          overflow: hidden;
          animation: fadeIn 0.3s ease-out;
        }
        .header {
          padding: 24px 24px 16px;
          text-align: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .icon { font-size: 40px; margin-bottom: 12px; }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 20px;
          margin-bottom: 8px;
        }
        .badge-text {
          font-size: 11px;
          font-weight: 600;
          color: #4ade80;
          letter-spacing: 0.02em;
        }
        .version {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 4px;
        }
        .subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
        .content {
          padding: 20px 24px;
          max-height: 150px;
          overflow-y: auto;
        }
        .section-title {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 12px;
        }
        .item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 6px 0;
        }
        .dot {
          width: 6px;
          height: 6px;
          background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%);
          border-radius: 50%;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .item span:last-child {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.5;
        }
        .text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
          padding: 4px 0;
        }
        .footer {
          padding: 16px 24px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          gap: 10px;
        }
        .btn {
          flex: 1;
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          -webkit-app-region: no-drag;
        }
        .btn-primary {
          color: white;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(34, 197, 94, 0.4);
        }
        .btn-secondary {
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.08);
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .btn:active { transform: translateY(0) scale(0.98); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="icon">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" fill="url(#rocket-bg)" />
              <path d="M24 12c-2 4-3 8-3 12 0 2 .5 4 1.5 6l-4.5 3 1.5-6-3-3h5l2.5-5 2.5 5h5l-3 3 1.5 6-4.5-3c1-2 1.5-4 1.5-6 0-4-1-8-3-12z" fill="#fff"/>
              <circle cx="24" cy="22" r="2" fill="#4ade80"/>
              <defs>
                <linearGradient id="rocket-bg" x1="4" y1="4" x2="44" y2="44">
                  <stop stop-color="#22c55e"/>
                  <stop offset="1" stop-color="#16a34a"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5">
              <path d="M12 2v20M2 12h20"/>
            </svg>
            <span class="badge-text">UPDATE AVAILABLE</span>
          </div>
          <div class="version">v${version}</div>
          <div class="subtitle">發現新版本</div>
        </div>
        <div class="content">
          <div class="section-title">更新內容</div>
          ${contentHtml}
        </div>
        <div class="footer">
          <button class="btn btn-secondary" onclick="require('electron').ipcRenderer.send('update-response', 'later');window.close()">稍後</button>
          <button class="btn btn-primary" onclick="require('electron').ipcRenderer.send('update-response', 'download');window.close()">立即更新</button>
        </div>
      </div>
    </body>
    </html>
  `)}`);

  updateAvailableWindow.once('ready-to-show', () => {
    updateAvailableWindow.show();
  });
}

// 顯示下載進度彈窗
function showDownloadProgressWindow() {
  if (downloadProgressWindow) return;

  downloadProgressWindow = new BrowserWindow({
    width: 340,
    height: 180,
    frame: false,
    transparent: true,
    resizable: false,
    parent: mainWindow,
    modal: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  downloadProgressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: transparent;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          -webkit-app-region: drag;
        }
        .card {
          width: 300px;
          padding: 24px;
          background: linear-gradient(180deg, rgba(23, 23, 23, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
          animation: fadeIn 0.3s ease-out;
          text-align: center;
        }
        .icon { font-size: 32px; margin-bottom: 12px; }
        .title {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 16px;
        }
        .progress-bg {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .percent {
          font-size: 24px;
          font-weight: 700;
          color: #60a5fa;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" fill="url(#dl-bg)" opacity="0.15"/>
            <path d="M24 14v14m0 0l-5-5m5 5l5-5" stroke="#60a5fa" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 32h20" stroke="#60a5fa" stroke-width="3" stroke-linecap="round"/>
            <defs>
              <linearGradient id="dl-bg" x1="4" y1="4" x2="44" y2="44">
                <stop stop-color="#3b82f6"/>
                <stop offset="1" stop-color="#60a5fa"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="title">正在下載更新...</div>
        <div class="progress-bg"><div class="progress-bar" id="progress" style="width: 0%"></div></div>
        <div class="percent" id="percent">0%</div>
      </div>
    </body>
    </html>
  `)}`);

  downloadProgressWindow.once('ready-to-show', () => {
    downloadProgressWindow.show();
  });
}

// 更新下載進度
function updateDownloadProgress(percent) {
  if (!downloadProgressWindow) {
    showDownloadProgressWindow();
    return;
  }
  downloadProgressWindow.webContents.executeJavaScript(`
    document.getElementById('progress').style.width = '${percent}%';
    document.getElementById('percent').textContent = '${percent.toFixed(1)}%';
  `).catch(() => { });
}

// 關閉下載進度彈窗
function closeDownloadProgressWindow() {
  if (downloadProgressWindow) {
    downloadProgressWindow.close();
    downloadProgressWindow = null;
  }
}

// 顯示更新就緒彈窗
function showUpdateReadyDialog(version) {
  const updateReadyWindow = new BrowserWindow({
    width: 380,
    height: 280,
    frame: false,
    transparent: true,
    resizable: false,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  updateReadyWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: transparent;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          -webkit-app-region: drag;
        }
        .card {
          width: 340px;
          padding: 32px 24px;
          background: linear-gradient(180deg, rgba(23, 23, 23, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
          animation: fadeIn 0.3s ease-out;
          text-align: center;
        }
        .icon {
          font-size: 48px;
          margin-bottom: 16px;
          animation: bounce 1s ease-in-out infinite;
        }
        .title {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 24px;
        }
        .footer {
          display: flex;
          gap: 10px;
        }
        .btn {
          flex: 1;
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          -webkit-app-region: no-drag;
        }
        .btn-primary {
          color: white;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
        }
        .btn-secondary {
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.08);
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .btn:active { transform: translateY(0) scale(0.98); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">
          <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" fill="url(#check-bg)"/>
            <path d="M16 24l6 6 10-12" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="check-bg" x1="4" y1="4" x2="44" y2="44">
                <stop stop-color="#22c55e"/>
                <stop offset="1" stop-color="#16a34a"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="title">v${version} 已準備就緒</div>
        <div class="subtitle">重啟應用以完成更新</div>
        <div class="footer">
          <button class="btn btn-secondary" onclick="window.close()">稍後</button>
          <button class="btn btn-primary" onclick="require('electron').ipcRenderer.send('update-response', 'install');window.close()">立即重啟</button>
        </div>
      </div>
    </body>
    </html>
  `)}`);

  updateReadyWindow.once('ready-to-show', () => {
    updateReadyWindow.show();
  });
}

// 檢查並釋放埠（Windows）
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve();
      return;
    }

    // 查詢佔用埠的程序PID
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout.trim()) {
        console.log(`✅ 埠 ${port} 未被佔用`);
        resolve();
        return;
      }

      // 解析PID
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') {
          pids.add(pid);
        }
      });

      if (pids.size === 0) {
        resolve();
        return;
      }

      console.log(`⚠️ 埠 ${port} 被佔用，嘗試終止程序: ${[...pids].join(', ')}`);

      // 殺掉佔用埠的程序
      const killPromises = [...pids].map(pid => {
        return new Promise((res) => {
          exec(`taskkill /F /PID ${pid}`, (killErr) => {
            if (killErr) {
              console.log(`殺死程序 ${pid} 失敗:`, killErr.message);
            } else {
              console.log(`✅ 已終止程序 ${pid}`);
            }
            res();
          });
        });
      });

      Promise.all(killPromises).then(() => {
        // 等待一下確保埠釋放
        setTimeout(resolve, 500);
      });
    });
  });
}

// 建立啟動畫面
function createSplashWindow() {
  const iconPath = getIconPath();
  const logoPath = iconPath.replace(/\\/g, '/'); // 路徑轉換為 URL 格式

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 載入啟動畫面 HTML
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          -webkit-app-region: drag;
          border-radius: 16px;
          overflow: hidden;
        }
        .logo {
          width: 80px;
          height: 80px;
          margin-bottom: 20px;
          animation: bounce 1s ease-in-out infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 14px;
          color: #888;
          margin-bottom: 30px;
        }
        .loader {
          width: 200px;
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          overflow: hidden;
        }
        .loader-bar {
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
          border-radius: 2px;
          animation: loading 1.5s ease-in-out infinite;
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        .status {
          margin-top: 16px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <img class="logo" src="file:///${logoPath}" alt="Logo" onerror="this.outerHTML='🐧'" />
      <div class="title">87Boss AI學堂</div>
      <div class="subtitle">87Boss AI學堂</div>
      <div class="loader"><div class="loader-bar"></div></div>
      <div class="status">正在啟動服務...</div>
    </body>
    </html>
  `)}`);

  splashWindow.center();
  splashWindow.show();
}

// 關閉啟動畫面
function closeSplashWindow() {
  if (splashWindow) {
    splashWindow.close();
    splashWindow = null;
  }
}

// 獲取圖示路徑（開發環境和打包環境不同）
function getIconPath() {
  const iconExt = process.platform === 'win32' ? 'ico' : 'png';
  let iconPath;

  if (!app.isPackaged) {
    // 開發環境
    iconPath = path.join(__dirname, `../resources/icon.${iconExt}`);
  } else {
    // 打包環境：嘗試多個可能的位置
    const possiblePaths = [
      path.join(process.resourcesPath, `icon.${iconExt}`),
      path.join(process.resourcesPath, 'resources', `icon.${iconExt}`),
      path.join(app.getAppPath(), 'resources', `icon.${iconExt}`),
      path.join(__dirname, `../resources/icon.${iconExt}`)
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        iconPath = p;
        console.log('✅ 找到圖示:', p);
        break;
      } else {
        console.log('❌ 圖示不存在:', p);
      }
    }

    if (!iconPath) {
      console.error('❌ 無法找到圖示檔案，使用預設路徑');
      // 返回預設路徑，即使不存在也不會 crash
      iconPath = path.join(process.resourcesPath, `icon.${iconExt}`);
    }
  }

  return iconPath;
}

// 建立 nativeImage 圖示
function getNativeIcon() {
  const iconPath = getIconPath();
  if (!iconPath) return null;

  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.error('❌ 圖示載入失敗（空圖片）:', iconPath);
      return null;
    }
    console.log('✅ 圖示載入成功:', iconPath, '尺寸:', icon.getSize());
    return icon;
  } catch (e) {
    console.error('❌ 圖示載入異常:', e);
    return null;
  }
}

// 建立主視窗
function createWindow() {
  const icon = getNativeIcon();
  console.log('視窗圖示:', icon ? '已載入' : '未載入');

  mainWindow = new BrowserWindow({
    width: CONFIG.windowWidth,
    height: CONFIG.windowHeight,
    minWidth: CONFIG.minWidth,
    minHeight: CONFIG.minHeight,
    title: '87Boss AI學堂',
    icon: icon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    show: false
  });

  // 設定工作列圖示（Windows特有）
  if (icon && process.platform === 'win32') {
    mainWindow.setIcon(icon);
  }

  // 視窗準備好後顯示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 載入應用
  if (CONFIG.isDev) {
    // 開發環境：先清除快取再載入
    mainWindow.webContents.session.clearCache().then(() => {
      console.log('🧹 已清除 Electron 快取 (Pre-load)');
      // 載入 Vite 開發伺服器
      // 載入 Vite 開發伺服器
      mainWindow.loadURL('http://localhost:8767');
      // 改用後端靜態資源服務 (8766) 避開 Vite 504 錯誤
      // mainWindow.loadURL('http://localhost:8766');
      // 開啟開發者工具
      mainWindow.webContents.openDevTools();
    });
  } else {
    // 生產環境：載入本地後端服務
    mainWindow.loadURL(`http://${CONFIG.backendHost}:${CONFIG.backendPort}`);
  }

  // 視窗關閉事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 啟動後端服務（直接在主程序中執行，不依賴外部 Node.js）
// 啟動後端服務（直接在主程序中執行，不依賴外部 Node.js）
function startBackendServer() {
  logToFile('[startBackendServer] Starting...');
  return new Promise((resolve, reject) => {
    console.log('🚀 啟動後端服務...');

    // 讀取自定義儲存路徑
    const storageConfig = loadStorageConfig();
    logToFile(`[startBackendServer] Loaded config: ${JSON.stringify(storageConfig)}`);

    // [Fix] 統一資料路徑邏輯：
    // 1. 如果有自定義路徑，優先使用
    // 2. 開發模式下，默認為 CWD (專案根目錄)，保持與舊行為一致，方便調試
    // 3. 生產模式下，改為「我的文件/87Boss_RunningHub_Data」，方便用戶直接訪問 output
    let baseDataPath = path.join(app.getPath('documents'), '87Boss_RunningHub_Data');
    if (CONFIG.isDev) {
      baseDataPath = process.cwd();
    }

    logToFile(`[startBackendServer] baseDataPath: ${baseDataPath}`);

    // 確保目錄存在
    if (!CONFIG.isDev && !fs.existsSync(baseDataPath)) {
      try {
        fs.mkdirSync(baseDataPath, { recursive: true });
      } catch (e) {
        console.error('無法創建數據目錄，回退到 userData:', e);
        baseDataPath = app.getPath('userData');
      }
    }

    const userDataPath = storageConfig.customPath || baseDataPath;
    global.userDataPath = userDataPath; // 設置全局變量供 IPC 使用
    logToFile(`[startBackendServer] SET global.userDataPath = ${userDataPath}`);

    console.log('資料儲存路徑:', userDataPath);

    // 設定環境變數
    process.env.NODE_ENV = 'production';
    process.env.PORT = CONFIG.backendPort.toString();
    process.env.HOST = CONFIG.backendHost;
    process.env.IS_ELECTRON = 'true';
    process.env.USER_DATA_PATH = userDataPath;

    // 計算後端路徑
    let backendPath;
    if (CONFIG.isDev) {
      backendPath = path.join(__dirname, '../backend-nodejs/src/server.js');
    } else {
      // 打包後，asar 未打包的檔案在 resources/app.asar.unpacked/ 目錄
      backendPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend-nodejs', 'src', 'server.js');
    }

    console.log('resourcesPath:', process.resourcesPath);
    console.log('後端路徑:', backendPath);

    // 檢查檔案是否存在
    // 檢查檔案是否存在
    if (!fs.existsSync(backendPath)) {
      console.error('❌ 後端檔案不存在:', backendPath);
      // 嘗試其他可能的路徑
      const altPath1 = path.join(app.getAppPath(), 'backend-nodejs', 'src', 'server.js');
      const altPath2 = path.join(process.resourcesPath, 'backend-nodejs', 'src', 'server.js');
      console.log('嘗試替代路徑1:', altPath1, fs.existsSync(altPath1));
      console.log('嘗試替代路徑2:', altPath2, fs.existsSync(altPath2));

      if (fs.existsSync(altPath1)) {
        backendPath = altPath1;
      } else if (fs.existsSync(altPath2)) {
        backendPath = altPath2;
      } else {
        reject(new Error('找不到後端檔案'));
        return;
      }
    }

    // 使用 spawn 啟動後端進程（獨立的 Node.js 進程可以正確解析 node_modules）
    const { spawn } = require('child_process');
    const backendDir = path.dirname(path.dirname(backendPath)); // backend-nodejs 目錄

    console.log('🚀 以子進程方式啟動後端...');
    console.log('後端目錄:', backendDir);

    // 使用 Electron 內建的 node 執行後端
    const nodeExe = process.execPath; // Electron 的可執行檔路徑

    backendServer = spawn(nodeExe, [backendPath], {
      cwd: backendDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1', // 讓 Electron 以 Node.js 模式運行
        NODE_ENV: 'production',
        PORT: CONFIG.backendPort.toString(),
        HOST: CONFIG.backendHost,
        IS_ELECTRON: 'true',
        USER_DATA_PATH: userDataPath,
        CUSTOM_OUTPUT_PATH: storageConfig.customPath || '',
        RESOURCES_PATH: process.resourcesPath
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    backendServer.stdout.on('data', (data) => {
      console.log('[Backend]', data.toString().trim());
    });

    backendServer.stderr.on('data', (data) => {
      console.error('[Backend Error]', data.toString().trim());
    });

    backendServer.on('error', (err) => {
      console.error('❌ 後端進程啟動失敗:', err);
      reject(err);
    });

    backendServer.on('close', (code) => {
      console.log(`[Backend] 進程退出，代碼: ${code}`);
      backendServer = null;
    });

    // 等待後端啟動（檢測埠口是否可用）
    const checkBackendReady = () => {
      const { createConnection } = require('net');
      const client = createConnection({ port: CONFIG.backendPort, host: CONFIG.backendHost }, () => {
        client.end();
        console.log(`✅ 後端服務已啟動: http://${CONFIG.backendHost}:${CONFIG.backendPort}`);
        resolve();
      });
      client.on('error', () => {
        // 還沒啟動，稍後重試
        setTimeout(checkBackendReady, 200);
      });
    };

    // 延遲一秒後開始檢測
    setTimeout(checkBackendReady, 1000);
  });
}

// 停止後端服務
function stopBackendServer() {
  if (backendServer) {
    console.log('🛑 停止後端服務...');
    backendServer.kill();
    backendServer = null;
  }
}

// 建立應用選單
function createMenu() {
  const template = [
    {
      label: '檔案',
      submenu: [
        {
          label: '重新整理',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '編輯',
      submenu: [
        { label: '撤銷', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪下', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '複製', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '貼上', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全選', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '檢視',
      submenu: [
        {
          label: '開發者工具',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        { label: '實際大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '縮小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: '幫助',
      submenu: [
        {
          label: '關於',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '關於 87Boss AI學堂',
              message: '87Boss AI學堂',
              detail: `版本: ${app.getVersion()}\n基於 Electron 和 React 構建的 AI 影象管理應用`,
              buttons: ['確定']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ============ 自動更新配置 ============
function setupAutoUpdater() {
  if (CONFIG.isDev) {
    console.log('📦 開發模式，跳過自動更新檢查');
    return;
  }

  // 暫時禁用自動更新，避免開發版覆蓋
  console.log('📦 自動更新已禁用');
  return;

  /*
  // 配置更新伺服器
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'http://updates.pebbling.cn/'
  });

  // 禁用自動下載，讓使用者選擇
  autoUpdater.autoDownload = false;

  // 檢查更新出錯
  autoUpdater.on('error', (err) => {
    console.error('❌ 更新檢查出錯:', err.message);
  });

  // 檢查到新版本
  autoUpdater.on('update-available', (info) => {
    console.log('🆕 發現新版本:', info.version);

    // 優先使用伺服器返回的 releaseNotes，否則使用預設說明
    let notes = '• 效能最佳化和問題修復';
    if (info.releaseNotes) {
      // releaseNotes 可能是字串或陣列
      if (typeof info.releaseNotes === 'string') {
        notes = info.releaseNotes;
      } else if (Array.isArray(info.releaseNotes)) {
        notes = info.releaseNotes.map(n => n.note || n).join('\n');
      }
    }

    console.log('📝 更新說明:', notes.substring(0, 100) + '...');
    showUpdateAvailableDialog(info.version, notes);
  });

  // 無新版本
  autoUpdater.on('update-not-available', () => {
    console.log('✅ 當前已是最新版本');
    // 通知渲染程序
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'up-to-date', version: app.getVersion() });
    }
  });

  // 下載進度
  autoUpdater.on('download-progress', (progress) => {
    const percent = progress.percent.toFixed(1);
    console.log(`📥 下載進度: ${percent}%`);
    if (mainWindow) {
      mainWindow.setProgressBar(progress.percent / 100);
      mainWindow.webContents.send('update-status', { status: 'downloading', percent: progress.percent });
    }
    // 更新進度彈窗
    updateDownloadProgress(progress.percent);
  });

  // 下載完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ 更新下載完成:', info.version);
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }
    closeDownloadProgressWindow();
    showUpdateReadyDialog(info.version);
  });

  // 延遲 5 秒後檢查更新
  setTimeout(() => {
    console.log('🔍 開始檢查更新...');
    autoUpdater.checkForUpdates().catch(err => {
      console.error('檢查更新失敗:', err.message);
    });
  }, 5000);
  */
}

// ============ IPC 通訊處理 ============
// 處理更新彈窗的響應
ipcMain.on('update-response', (event, action) => {
  if (action === 'download') {
    autoUpdater.downloadUpdate();
  } else if (action === 'install') {
    autoUpdater.quitAndInstall(false, true);
  }
});

// 獲取應用版本
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 手動檢查更新
ipcMain.handle('check-for-updates', async () => {
  if (CONFIG.isDev) {
    return { status: 'dev-mode' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: 'checking', version: result?.updateInfo?.version };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// ============ 儲存路徑相關 IPC ============
// 獲取自定義儲存路徑配置檔案路徑
function getStorageConfigPath() {
  return path.join(app.getPath('userData'), 'storage_config.json');
}

// 讀取儲存路徑配置
function loadStorageConfig() {
  const configPath = getStorageConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      console.log('📖 [Storage] Loaded config from:', configPath, config);
      return config;
    }
  } catch (e) {
    console.error('❌ [Storage] Failed to load config:', e.message);
  }
  return { customPath: null };
}

// 儲存儲存路徑配置
function saveStorageConfig(config) {
  const configPath = getStorageConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('💾 [Storage] Saved config to:', configPath, config);
    return true;
  } catch (e) {
    console.error('❌ [Storage] Failed to save config:', e.message);
    return false;
  }
}

// 獲取當前儲存路徑
ipcMain.handle('get-storage-path', () => {
  const config = loadStorageConfig();
  const defaultPath = app.getPath('userData');
  return {
    currentPath: config.customPath || defaultPath,
    isCustom: !!config.customPath,
    defaultPath: defaultPath
  };
});

// 選擇儲存路徑
ipcMain.handle('select-storage-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '選擇資料儲存位置',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: '選擇此資料夾'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// 設定儲存路徑
ipcMain.handle('set-storage-path', (event, newPath) => {
  console.log('🔧 [Storage] Setting new path:', newPath);
  try {
    // 驗證路徑是否有效
    if (newPath && !fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
    }

    const config = loadStorageConfig();
    config.customPath = newPath || null;
    const saved = saveStorageConfig(config);

    if (saved) {
      // 更新全局變量，這樣不用重啟也能部分生效 (儘管 backend 需要重啟)
      global.userDataPath = newPath || app.getPath('userData');
    }

    return {
      success: saved,
      message: saved ? '儲存路徑已更新，重啟應用後生效' : '儲存配置失敗',
      needRestart: true
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// 遷移資料到新路徑
ipcMain.handle('migrate-data', async (event, newPath) => {
  try {
    const config = loadStorageConfig();
    const currentPath = config.customPath || app.getPath('userData');

    if (currentPath === newPath) {
      return { success: true, message: '目標路徑與當前路徑相同' };
    }

    // 要遷移的資料夾
    const foldersToMigrate = ['data', 'input', 'output', 'creative_images', 'thumbnails', 'canvas_images'];
    let migratedCount = 0;
    let fileCount = 0;

    // 遞迴複製資料夾
    function copyDirRecursive(src, dest) {
      if (!fs.existsSync(src)) return 0;

      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      let count = 0;
      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          count += copyDirRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
          count++;
        }
      }
      return count;
    }

    for (const folder of foldersToMigrate) {
      const srcDir = path.join(currentPath, folder);
      const destDir = path.join(newPath, folder);

      if (fs.existsSync(srcDir)) {
        const copied = copyDirRecursive(srcDir, destDir);
        if (copied > 0) {
          migratedCount++;
          fileCount += copied;
        }
      }
    }

    // 儲存新路徑配置
    config.customPath = newPath;
    saveStorageConfig(config);

    return {
      success: true,
      message: `已遷移 ${migratedCount} 個資料夾（${fileCount} 個檔案），重啟應用後生效`,
      needRestart: true
    };
  } catch (e) {
    return { success: false, message: '遷移失敗: ' + e.message };
  }
});

// 開啟儲存路徑
ipcMain.handle('open-storage-path', () => {
  const config = loadStorageConfig();
  const currentPath = config.customPath || app.getPath('userData');
  shell.openPath(currentPath);
  return { success: true };
});

// 應用啟動
app.whenReady().then(async () => {
  console.log('🐧 87Boss AI學堂 啟動中...');
  console.log('使用者資料目錄:', app.getPath('userData'));
  console.log('應用路徑:', app.getAppPath());
  console.log('開發模式:', CONFIG.isDev);

  // 建立選單（僅在開發環境）
  if (CONFIG.isDev) {
    createMenu();
  } else {
    // 生產環境：隱藏選單欄
    Menu.setApplicationMenu(null);
  }

  // 啟動後端服務（在開發與生產環境皆由 Electron 統一控管，以確保路徑配置一致）
  try {
    if (!CONFIG.isDev) {
      createSplashWindow();
    }

    // 先檢查並釋放埠
    await killProcessOnPort(CONFIG.backendPort);
    await startBackendServer();
  } catch (err) {
    console.error('❌ 後端服務啟動失敗:', err);
    if (!CONFIG.isDev) {
      closeSplashWindow();
      const { dialog } = require('electron');
      dialog.showErrorBox('啟動失敗', `後端服務啟動失敗: ${err.message}`);
      app.quit();
    }
    return;
  }

  // 建立主視窗
  createWindow();

  // 關閉啟動畫面
  closeSplashWindow();

  // 設定自動更新（生產環境）
  setupAutoUpdater();

  // 檢查並顯示更新後歡迎提示（生產環境）
  if (!CONFIG.isDev) {
    checkAndShowWelcome();
  }

  // macOS 特定：點選 dock 圖示時重新建立視窗
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有視窗關閉時退出應用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 應用退出前清理
app.on('before-quit', () => {
  stopBackendServer();
});

// 應用退出
app.on('quit', () => {
  console.log('👋 87Boss AI學堂 已關閉');
});

// 全域性異常處理
process.on('uncaughtException', (error) => {
  console.error('未捕獲的異常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('未處理的 Promise 拒絕:', reason);
});

// =======================================================
// RunningHub IPC Handlers (Pure IPC Mode)
// =======================================================

// 1. Get Config
ipcMain.handle('rh-get-config', async () => {
  return { success: true, data: readRhSettings() };
});

// 2. Save Config
ipcMain.handle('rh-save-config', async (event, settings) => {
  const success = saveRhSettings(settings);
  return { success, data: readRhSettings() }; // Return updated settings
});

// 3. Save File

// 4. Decode Image - using duck_decoder.exe for encoded images
// Duplicate legacy handler removed. See correct implementation below around line 2100.

// ============ File Explorer IPC ============
// (chokidar is loaded at top of file)

// 當前活動的 watcher 實例
let activeWatcher = null;

// 支援的圖片副檔名
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.ico']);

// 取得磁碟列表 (Windows)
ipcMain.handle('fs:list-drives', async () => {
  try {
    if (process.platform === 'win32') {
      return new Promise((resolve, reject) => {
        // 使用 PowerShell 取得磁碟資訊（避免 wmic 編碼問題）
        const psCommand = `powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free | ConvertTo-Json"`;
        exec(psCommand, { encoding: 'utf8', maxBuffer: 1024 * 1024 }, (err, stdout) => {
          if (err) {
            console.error('[fs:list-drives] PowerShell error:', err);
            // Fallback: 只列出已知的磁碟代號
            const fallbackDrives = [];
            for (let i = 65; i <= 90; i++) { // A-Z
              const letter = String.fromCharCode(i) + ':';
              try {
                if (fs.existsSync(letter + '\\\\')) {
                  fallbackDrives.push({ letter, label: letter, size: null, freeSpace: null });
                }
              } catch (e) { /* 忽略 */ }
            }
            resolve({ success: true, drives: fallbackDrives });
            return;
          }
          try {
            const psdrives = JSON.parse(stdout);
            const drivesArray = Array.isArray(psdrives) ? psdrives : [psdrives];
            const drives = drivesArray.map(d => ({
              letter: d.Name + ':',
              label: d.Name + ':',
              size: d.Used != null && d.Free != null ? d.Used + d.Free : null,
              freeSpace: d.Free
            }));
            resolve({ success: true, drives });
          } catch (parseErr) {
            console.error('[fs:list-drives] Parse error:', parseErr);
            resolve({ success: true, drives: [] });
          }
        });
      });
    } else {
      // macOS / Linux - 使用 df 指令
      return new Promise((resolve, reject) => {
        exec('df -h', { encoding: 'utf8' }, (err, stdout) => {
          if (err) {
            reject(err);
            return;
          }
          const lines = stdout.trim().split('\n').slice(1);
          const drives = lines
            .filter(l => l.includes('/'))
            .map(line => {
              const parts = line.split(/\s+/);
              return {
                letter: parts[parts.length - 1], // mount point
                label: parts[0],
                size: parts[1],
                freeSpace: parts[3]
              };
            });
          resolve({ success: true, drives });
        });
      });
    }
  } catch (error) {
    console.error('[fs:list-drives] Error:', error);
    return { success: false, error: error.message };
  }
});

// 讀取目錄內容
ipcMain.handle('fs:read-dir', async (event, dirPath) => {
  try {
    const items = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // 跳過系統隱藏檔案
      if (entry.name.startsWith('.') || entry.name.startsWith('$') || entry.name === 'desktop.ini' || entry.name === 'Thumbs.db') {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      let stat = null;

      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        // 無法讀取 (權限問題等)，跳過
        continue;
      }

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          mtime: stat.mtime.getTime()
        });
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          items.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false,
            size: stat.size,
            mtime: stat.mtime.getTime(),
            ext
          });
        }
      }
    }

    // 排序：資料夾在前，然後按名稱排序
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, 'zh-TW', { numeric: true });
    });

    return { success: true, items };
  } catch (error) {
    console.error('[fs:read-dir] Error:', error);
    return { success: false, error: error.message };
  }
});

// 監聽目錄變化
ipcMain.handle('fs:watch-path', async (event, dirPath) => {
  try {
    // 關閉之前的 watcher
    if (activeWatcher) {
      await activeWatcher.close();
      activeWatcher = null;
    }

    if (!dirPath) {
      return { success: true, message: 'Watcher stopped' };
    }

    activeWatcher = chokidar.watch(dirPath, {
      depth: 0,
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../  // 忽略隱藏檔案
    });

    activeWatcher.on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext) && mainWindow) {
        mainWindow.webContents.send('fs:folder-change', { type: 'add', path: filePath });
      }
    });

    activeWatcher.on('unlink', (filePath) => {
      if (mainWindow) {
        mainWindow.webContents.send('fs:folder-change', { type: 'unlink', path: filePath });
      }
    });

    activeWatcher.on('addDir', (dirPath) => {
      if (mainWindow) {
        mainWindow.webContents.send('fs:folder-change', { type: 'addDir', path: dirPath });
      }
    });

    activeWatcher.on('unlinkDir', (dirPath) => {
      if (mainWindow) {
        mainWindow.webContents.send('fs:folder-change', { type: 'unlinkDir', path: dirPath });
      }
    });

    return { success: true, message: `Watching ${dirPath}` };
  } catch (error) {
    console.error('[fs:watch-path] Error:', error);
    return { success: false, error: error.message };
  }
});

// 停止監聽
ipcMain.handle('fs:stop-watch', async () => {
  if (activeWatcher) {
    await activeWatcher.close();
    activeWatcher = null;
  }
  return { success: true };
});

// 取得圖片縮圖 (利用 nativeImage)
ipcMain.handle('fs:get-thumbnail', async (event, imagePath, size = 120) => {
  try {
    const { nativeImage } = require('electron');
    const image = nativeImage.createFromPath(imagePath);

    if (image.isEmpty()) {
      return { success: false, error: 'Failed to load image' };
    }

    // 計算縮放尺寸
    const origSize = image.getSize();
    const scale = Math.min(size / origSize.width, size / origSize.height, 1);
    const newWidth = Math.floor(origSize.width * scale);
    const newHeight = Math.floor(origSize.height * scale);

    const resized = image.resize({ width: newWidth, height: newHeight, quality: 'good' });
    const dataUrl = resized.toDataURL();

    return { success: true, dataUrl };
  } catch (error) {
    console.error('[fs:get-thumbnail] Error:', error);
    return { success: false, error: error.message };
  }
});

// 在檔案總管中開啟
ipcMain.handle('fs:open-in-explorer', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('[fs:open-in-explorer] Error:', error);
    return { success: false, error: error.message };
  }
});

// 複製路徑到剪貼簿
ipcMain.handle('fs:copy-path', async (event, filePath) => {
  try {
    const { clipboard } = require('electron');
    clipboard.writeText(filePath);
    return { success: true };
  } catch (error) {
    console.error('[fs:copy-path] Error:', error);
    return { success: false, error: error.message };
  }
});

// 複製檔案到桌面項目（返回本地 URL）
ipcMain.handle('fs:copy-to-desktop', async (event, filePath) => {
  try {
    const fileName = path.basename(filePath);
    const outputDir = getBaseOutputPath();

    // 確保 output 目錄存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 生成唯一檔名
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const timestamp = Date.now();
    const newFileName = `${base}_${timestamp}${ext}`;
    const destPath = path.join(outputDir, newFileName);

    // 複製檔案
    fs.copyFileSync(filePath, destPath);

    // 返回相對 URL 供前端使用
    return {
      success: true,
      localUrl: `/files/output/${newFileName}`,
      fileName: newFileName
    };
  } catch (error) {
    console.error('[fs:copy-to-desktop] Error:', error);
    return { success: false, error: error.message };
  }
});

// 取得預設路徑 (output 資料夾)
ipcMain.handle('fs:get-default-path', async () => {
  try {
    const outputPath = getBaseOutputPath();

    // 確保目錄存在
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    return { success: true, path: outputPath };
  } catch (error) {
    console.error('[fs:get-default-path] Error:', error);
    return { success: false, error: error.message };
  }
});
// RunningHub 存檔
// RunningHub 存檔
// 通知後端生成縮略圖
async function notifyBackendThumbnail(filePath, sourceDir = 'output') {
  try {
    const { net } = require('electron');
    const url = `http://${CONFIG.backendHost}:${CONFIG.backendPort}/api/files/generate-thumbnail`;
    const response = await net.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, sourceDir })
    });
    if (!response.ok) {
      console.warn('[Thumbnail Notify] Failed:', await response.text());
    } else {
      console.log('[Thumbnail Notify] Success for:', filePath);
    }
  } catch (e) {
    console.warn('[Thumbnail Notify] Error:', e.message);
  }
}

ipcMain.handle('rh-save-file', async (event, { url, name, subDir }) => {
  console.log('[rh-save-file] Invoked. name:', name, 'subDir:', subDir);
  try {
    if (!url || !name) throw new Error('URL and name are required');

    const baseDir = getBaseOutputPath();
    const targetDir = subDir ? path.join(baseDir, subDir) : baseDir;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, name);

    // Case 1: Base64 Data
    if (url.startsWith('data:')) {
      console.log('[rh-save-file] Saving from Base64...');
      const base64Data = url.split(';base64,').pop();
      fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
      console.log('[rh-save-file] Saved successfully:', filePath);
      notifyBackendThumbnail(filePath, subDir || 'output');
      return { success: true, path: filePath };
    }

    // Case 2: Remote URL
    console.log('[rh-save-file] Downloading using net:', url, 'to', filePath);
    return new Promise((resolve) => {
      const { net } = require('electron');
      const request = net.request(url);

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          resolve({ success: false, error: `Failed to fetch: ${response.statusCode}` });
          return;
        }

        const fileStream = fs.createWriteStream(filePath);
        response.on('data', (chunk) => {
          fileStream.write(chunk);
        });

        response.on('end', () => {
          fileStream.end();
          fileStream.on('finish', () => {
            console.log('[rh-save-file] Saved successfully:', filePath);
            notifyBackendThumbnail(filePath, subDir || 'output');
            resolve({ success: true, path: filePath });
          });
          fileStream.on('error', (err) => {
            console.error('[rh-save-file] Write error:', err);
            resolve({ success: false, error: err.message });
          });
        });

        response.on('error', (err) => {
          console.error('[rh-save-file] Response error:', err);
          resolve({ success: false, error: err.message });
        });
      });

      request.on('error', (error) => {
        console.error('[rh-save-file] Request error:', error);
        resolve({ success: false, error: error.message });
      });

      request.end();
    });

  } catch (error) {
    console.error('[rh-save-file] Handler Error:', error);
    return { success: false, error: error.message };
  }
});

// RunningHub 圖片解碼
console.log('⚡ [main.cjs] Registering rh-decode-image handler...');
ipcMain.handle('rh-decode-image', async (event, { buffer, fileName, filePath }) => {
  console.log('📦 [rh-decode-image] Handler invoked with filePath:', filePath);
  try {
    if (!buffer && !filePath) throw new Error('Buffer and filePath are empty');

    // 1. 確定 Decoder 路徑 - 使用 fallback 機制適應不同安裝位置
    function getDecoderPath() {
      const possiblePaths = [
        // 生產環境標準路徑 (process.resourcesPath)
        path.join(process.resourcesPath || '', 'extraResources', 'duck_decoder.exe'),
        // 相對於執行檔的路徑
        path.join(path.dirname(app.getPath('exe')), 'resources', 'extraResources', 'duck_decoder.exe'),
        // 開發環境 - 相對於 __dirname
        path.join(__dirname, '..', 'extraResources', 'duck_decoder.exe'),
        // 開發環境 - 相對於 CWD
        path.join(process.cwd(), 'extraResources', 'duck_decoder.exe'),
        // Portable 模式 - 相對於 exe 同層
        path.join(path.dirname(app.getPath('exe')), 'extraResources', 'duck_decoder.exe'),
      ];

      for (const p of possiblePaths) {
        if (p && fs.existsSync(p)) {
          console.log('[Decoder] Found at:', p);
          return p;
        }
      }

      // 找不到時列出所有嘗試的路徑以便除錯
      console.error('[Decoder] Not found. Searched paths:');
      possiblePaths.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
      throw new Error('duck_decoder.exe not found in any expected location');
    }

    const decoderPath = getDecoderPath();

    // 確定輸出路徑
    // 確定輸出路徑
    const outputDir = getBaseOutputPath();
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 2. 準備輸入檔案
    let tempInputPath = '';
    let isTempFile = true;

    // [New] Resolve path if it's a URL-like string or relative path
    let resolvedPath = filePath;
    if (typeof filePath === 'string') {
      try {
        if (filePath.startsWith('file://')) {
          resolvedPath = require('url').fileURLToPath(filePath);
        } else if (filePath.includes('/files/output/')) {
          // Map http://.../files/output/xxx.png -> <outputDir>/xxx.png
          // This handles both relative paths and full URLs
          const parts = filePath.split('/files/output/');
          if (parts.length > 1) {
            // split gives us everything after /files/output/
            const relName = decodeURIComponent(parts.pop());
            resolvedPath = path.join(getBaseOutputPath(), relName);
          }
        }
        // else: assume it is already an absolute path if it looks like one, or leave as is
      } catch (e) {
        console.warn('[Decoder] Path resolution failed:', e);
      }
    }

    const isDataURL = typeof filePath === 'string' && (filePath.trim().startsWith('data:') || filePath.includes(';base64,'));

    if (isDataURL) {
      const base64Data = filePath.split(';base64,').pop();
      tempInputPath = path.join(outputDir, `temp_b64_${Date.now()}.png`);
      fs.writeFileSync(tempInputPath, base64Data, { encoding: 'base64' });
      isTempFile = true;
      console.log('[Decoder] Created input from base64 string:', tempInputPath);
    } else if (resolvedPath && fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      tempInputPath = resolvedPath;
      isTempFile = false;
      console.log('[Decoder] Using existing file:', tempInputPath);
    } else {
      // Fallback: Create temp file from buffer if file not found
      if (resolvedPath) {
        console.warn('[Decoder] File path provided but not found or not a file:', resolvedPath);
      }

      if (buffer) {
        tempInputPath = path.join(outputDir, `temp_buf_${Date.now()}.png`);
        fs.writeFileSync(tempInputPath, Buffer.from(buffer));
        isTempFile = true;
        console.log('[Decoder] Created temp input from buffer:', tempInputPath);
      } else if (typeof filePath === 'string' && !filePath.startsWith('data:')) {
        // Last resort: check if it's just a filename in the output directory
        const justFileName = path.basename(filePath);
        const fallbackPath = path.join(getBaseOutputPath(), justFileName);
        if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
          tempInputPath = fallbackPath;
          isTempFile = false;
          console.log('[Decoder] Found file via fallback basename matching:', tempInputPath);
        } else {
          throw new Error(`No input source. File not found: ${resolvedPath || filePath}`);
        }
      } else {
        throw new Error(`No input source. File not found: ${resolvedPath || filePath}`);
      }
    }

    // 3. 執行解碼器
    // usage: duck_decoder.exe <input> (Positional argument style based on user feedback)
    const { execFile } = require('child_process');

    console.log('[Decoder] Running:', decoderPath);
    console.log('[Decoder] Args (Positional):', [tempInputPath]);

    await new Promise((resolve, reject) => {
      const options = {
        cwd: path.dirname(tempInputPath), // Set CWD to input directory to avoid path issues
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
      };

      execFile(decoderPath, [tempInputPath], options, (error, stdout, stderr) => {
        if (error) {
          console.warn('[Decoder] Exec warning:', error);
          const errStr = stderr || stdout || error.message || '';
          console.warn('[Decoder] Output:', errStr);

          // Check for specific known errors
          if (errStr.includes('ValueError') || errStr.includes('Payload length invalid')) {
            reject(new Error('圖片未加密或格式不正確 (Not an encrypted image)'));
          } else {
            // If it succeeds but returns exit code 0, error might be null. 
            // If exit code is non-zero, it lands here.
            reject(new Error(errStr || 'Decoder failed with unknown error'));
          }
          return;
        }
        console.log('[Decoder] Stdout:', stdout);
        resolve(stdout);
      });
    });

    // 4. 尋找輸出檔案
    // User reported: input.png -> input.png.png
    const expectedOutputPath = tempInputPath + '.png';
    console.log('[Decoder] Looking for output at:', expectedOutputPath);

    if (fs.existsSync(expectedOutputPath)) {
      // 重命名為最終檔案名
      let finalPath = expectedOutputPath;
      let finalName = path.basename(expectedOutputPath);

      if (fileName) {
        const safeName = fileName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_.]/g, '_');
        finalName = safeName.replace('.png', '_decoded.png');
        finalPath = path.join(outputDir, finalName);

        if (fs.existsSync(finalPath)) {
          try { fs.unlinkSync(finalPath); } catch (e) { console.warn('[Decoder] Target busy, will try rename directly'); }
        }

        // Retry rename to handle Windows EBUSY
        let renamed = false;
        for (let i = 0; i < 5; i++) {
          try {
            fs.renameSync(expectedOutputPath, finalPath);
            renamed = true;
            break;
          } catch (e) {
            if (e.code === 'EBUSY' && i < 4) {
              console.log(`[Decoder] File busy, retry ${i + 1}...`);
              await new Promise(r => setTimeout(r, 200 * (i + 1)));
            } else {
              throw e;
            }
          }
        }
        if (!renamed) throw new Error('Rename failed after retries');
      }

      // 只有在是臨時檔案時才刪除輸入
      if (isTempFile) {
        try { fs.unlinkSync(tempInputPath); } catch (e) { }
      }

      console.log('[Decoder] Success:', finalPath);

      // 通知後端生成縮圖
      notifyBackendThumbnail(finalPath, 'output');

      return {
        success: true,
        filePath: finalPath,
        localUrl: `/files/output/${finalName}`,
        fileName: finalName
      };
    } else {
      // Check if maybe it didn't append .png?
      // Sometimes decoders replace the file? No, user said extraction "completed: ...png.png"
      throw new Error(`Decoder executed but output file not found at ${expectedOutputPath}. Check if image is encrypted.`);
    }

  } catch (error) {
    console.error('[rh-decode-image] Error:', error);
    // Ensure error is a string
    const errorMsg = error.message || String(error) || 'Unknown Error';
    return { success: false, error: errorMsg };
  }
});

console.log('✅ [main.cjs] ALL IPC handlers registered (rh-save-file, rh-decode-image)');
