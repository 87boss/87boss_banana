const path = require('path');

// 获取项目根目录
// 如果有 USER_DATA_PATH 环境变量（由 Electron 传入），则优先使用
const USER_DATA_PATH = process.env.USER_DATA_PATH;
const BASE_DIR = USER_DATA_PATH || path.resolve(__dirname, '..', '..');

console.log('[Config] BASE_DIR:', BASE_DIR);

// 配置项
const config = {
  // 服务器配置
  HOST: process.env.HOST || '127.0.0.1',
  PORT: process.env.PORT || 8766,
  NODE_ENV: process.env.NODE_ENV || 'production',

  // 目录路径
  BASE_DIR: BASE_DIR,
  INPUT_DIR: path.join(BASE_DIR, 'input'),
  OUTPUT_DIR: path.join(BASE_DIR, 'output'),
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
