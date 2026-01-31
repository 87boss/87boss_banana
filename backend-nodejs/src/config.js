const path = require('path');

// 获取项目根目录
// 如果有 USER_DATA_PATH 环境变量（由 Electron 传入），则优先使用
console.log('[Config] process.env.USER_DATA_PATH:', process.env.USER_DATA_PATH);
console.log('[Config] process.env.CUSTOM_OUTPUT_PATH:', process.env.CUSTOM_OUTPUT_PATH);

// 嘗試主動從 Electron 的配置文件讀取自定義路徑
const fs = require('fs');
let customPathFromConfig = null;
try {
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
  const storageConfigPath = path.join(appData, '87boss-banana-client', 'storage_config.json');
  if (fs.existsSync(storageConfigPath)) {
    const data = JSON.parse(fs.readFileSync(storageConfigPath, 'utf-8'));
    if (data.customPath) {
      customPathFromConfig = data.customPath;
      console.log('[Config] Found customPath from storage_config.json:', customPathFromConfig);
    }
  }
} catch (e) {
  console.warn('[Config] Failed to read storage_config.json:', e.message);
}

const USER_DATA_PATH = process.env.USER_DATA_PATH;
const BASE_DIR = USER_DATA_PATH || path.resolve(__dirname, '..', '..');
console.log('[Config] Resolved BASE_DIR:', BASE_DIR);

const FINAL_OUTPUT_DIR = process.env.CUSTOM_OUTPUT_PATH || customPathFromConfig || path.join(BASE_DIR, 'output');
console.log('[Config] FINAL_OUTPUT_DIR:', FINAL_OUTPUT_DIR);

// 配置项
const config = {
  // 服务器配置
  HOST: process.env.HOST || '127.0.0.1',
  PORT: process.env.PORT || 8766,
  NODE_ENV: process.env.NODE_ENV || 'production',

  // 目录路径
  BASE_DIR: BASE_DIR,
  INPUT_DIR: path.join(BASE_DIR, 'input'),
  // [Modified] Support direct custom output path without 'output' subfolder
  OUTPUT_DIR: FINAL_OUTPUT_DIR,
  THUMBNAILS_DIR: path.join(BASE_DIR, 'thumbnails'),
  DATA_DIR: path.join(BASE_DIR, 'data'),
  CREATIVE_IMAGES_DIR: path.join(BASE_DIR, 'creative_images'),
  DIST_DIR: process.env.RESOURCES_PATH ? path.join(process.env.RESOURCES_PATH, 'dist') : path.join(BASE_DIR, 'dist'),

  // 缩略图配置
  THUMBNAIL_SIZE: 160, // 缩略图大小（像素）
  THUMBNAIL_QUALITY: 80, // 缩略图质量（JPEG）

  // 数据文件路径
  CREATIVE_IDEAS_FILE: path.join(BASE_DIR, 'data', 'creative_ideas.json'),
  HISTORY_FILE: path.join(BASE_DIR, 'data', 'history.json'),
  SETTINGS_FILE: path.join(BASE_DIR, 'data', 'settings.json'),
  DESKTOP_ITEMS_FILE: path.join(BASE_DIR, 'data', 'desktop_items.json'),

  // 业务配置
  MAX_HISTORY_COUNT: 500,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
};

module.exports = config;
