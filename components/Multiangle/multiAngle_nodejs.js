/**
 * ComfyUI-Easy-Use: 視覺化調節視角功能 - Node.js/JavaScript 版本
 * ============================================================
 * 
 * 純 JavaScript 實現，可直接在 Node.js 或瀏覽器中執行
 * 不依賴任何框架
 */

/**
 * 獲取水平方向描述
 * @param {number} angle - 水平角度 (0-360)
 * @param {boolean} addAnglePrompt - 是否使用詳細模式
 * @returns {string}
 */
function getHorizontalDirection(angle, addAnglePrompt = true) {
  const hAngle = angle % 360;
  const suffix = addAnglePrompt ? "" : " quarter";
  
  if (hAngle < 22.5 || hAngle >= 337.5) return "front view";
  if (hAngle < 67.5) return `front-right${suffix} view`;
  if (hAngle < 112.5) return "right side view";
  if (hAngle < 157.5) return `back-right${suffix} view`;
  if (hAngle < 202.5) return "back view";
  if (hAngle < 247.5) return `back-left${suffix} view`;
  if (hAngle < 292.5) return "left side view";
  return `front-left${suffix} view`;
}

/**
 * 獲取垂直方向描述
 * @param {number} vertical - 垂直角度 (-30 到 90)
 * @param {boolean} addAnglePrompt - 是否使用詳細模式
 * @returns {string}
 */
function getVerticalDirection(vertical, addAnglePrompt = true) {
  if (addAnglePrompt) {
    if (vertical < -15) return "low angle";
    if (vertical < 15) return "eye level";
    if (vertical < 45) return "high angle";
    if (vertical < 75) return "bird's eye view";
    return "top-down view";
  } else {
    if (vertical < -15) return "low-angle shot";
    if (vertical < 15) return "eye-level shot";
    if (vertical < 75) return "elevated shot";
    return "high-angle shot";
  }
}

/**
 * 獲取距離/縮放描述
 * @param {number} zoom - 縮放值 (0-10)
 * @param {boolean} addAnglePrompt - 是否使用詳細模式
 * @returns {string}
 */
function getDistanceDescription(zoom, addAnglePrompt = true) {
  if (addAnglePrompt) {
    if (zoom < 2) return "wide shot";
    if (zoom < 4) return "medium-wide shot";
    if (zoom < 6) return "medium shot";
    if (zoom < 8) return "medium close-up";
    return "close-up";
  } else {
    if (zoom < 2) return "wide shot";
    if (zoom < 6) return "medium shot";
    return "close-up";
  }
}

/**
 * 主轉換函式 - 將角度引數轉換為提示詞
 * @param {Object} params - 角度引數
 * @param {number} params.rotate - 水平角度 (0-360)
 * @param {number} params.vertical - 垂直角度 (-30 到 90)
 * @param {number} params.zoom - 縮放距離 (0-10)
 * @param {boolean} [params.addAnglePrompt=true] - 是否新增詳細角度資訊
 * @returns {Object} - { prompt, hDirection, vDirection, distance }
 */
function convertAngleToPrompt(params) {
  const { 
    rotate: rawRotate = 0, 
    vertical: rawVertical = 0, 
    zoom: rawZoom = 5, 
    addAnglePrompt = true 
  } = params;
  
  // 限制輸入範圍
  const rotate = Math.max(0, Math.min(360, Math.round(rawRotate)));
  const vertical = Math.max(-30, Math.min(90, Math.round(rawVertical)));
  const zoom = Math.max(0, Math.min(10, rawZoom));
  
  const hDirection = getHorizontalDirection(rotate, addAnglePrompt);
  const vDirection = getVerticalDirection(vertical, addAnglePrompt);
  const distance = getDistanceDescription(zoom, addAnglePrompt);
  
  let prompt;
  if (addAnglePrompt) {
    prompt = `${hDirection}, ${vDirection}, ${distance} (horizontal: ${rotate}, vertical: ${vertical}, zoom: ${zoom.toFixed(1)})`;
  } else {
    prompt = `${hDirection} ${vDirection} ${distance}`;
  }
  
  return { prompt, hDirection, vDirection, distance };
}

/**
 * 批次轉換多個角度
 * @param {Array} angleList - 角度引數陣列
 * @returns {Array} - 結果陣列
 */
function convertMultipleAngles(angleList) {
  return angleList.map(params => convertAngleToPrompt(params));
}

/**
 * 角度對映參考表
 */
const ANGLE_REFERENCE = {
  horizontal: {
    0: 'front view (正面)',
    45: 'front-right view (正面右側)',
    90: 'right side view (右側)',
    135: 'back-right view (背面右側)',
    180: 'back view (背面)',
    225: 'back-left view (背面左側)',
    270: 'left side view (左側)',
    315: 'front-left view (正面左側)',
  },
  vertical: {
    '-30 to -15': 'low angle (仰視)',
    '-15 to 15': 'eye level (平視)',
    '15 to 45': 'high angle (高角度)',
    '45 to 75': "bird's eye view (鳥瞰)",
    '75 to 90': 'top-down view (俯視)',
  },
  zoom: {
    '0-2': 'wide shot (遠景)',
    '2-4': 'medium-wide shot (中遠景)',
    '4-6': 'medium shot (中景)',
    '6-8': 'medium close-up (中近景)',
    '8-10': 'close-up (特寫)',
  },
};

// ============================================
// 模組匯出 (CommonJS & ES Module 相容)
// ============================================

// CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    convertAngleToPrompt,
    convertMultipleAngles,
    getHorizontalDirection,
    getVerticalDirection,
    getDistanceDescription,
    ANGLE_REFERENCE,
  };
}

// ES Module 匯出 (在支援的環境中)
// export { convertAngleToPrompt, convertMultipleAngles, ANGLE_REFERENCE };

// ============================================
// 測試程式碼 (Node.js 直接執行)
// ============================================

if (typeof require !== 'undefined' && require.main === module) {
  console.log('=' .repeat(60));
  console.log('視覺化視角調節功能測試 (Node.js 版本)');
  console.log('='.repeat(60));
  
  const testCases = [
    { rotate: 0, vertical: 0, zoom: 5, addAnglePrompt: true },
    { rotate: 90, vertical: 30, zoom: 8, addAnglePrompt: true },
    { rotate: 180, vertical: -20, zoom: 2, addAnglePrompt: true },
    { rotate: 270, vertical: 60, zoom: 4, addAnglePrompt: false },
    { rotate: 45, vertical: 80, zoom: 9, addAnglePrompt: true },
  ];
  
  testCases.forEach((params, i) => {
    const result = convertAngleToPrompt(params);
    console.log(`\n測試 ${i + 1}:`);
    console.log(`  輸入: rotate=${params.rotate}°, vertical=${params.vertical}°, zoom=${params.zoom}`);
    console.log(`  詳細模式: ${params.addAnglePrompt}`);
    console.log(`  輸出: ${result.prompt}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('Express/Koa API 使用示例:');
  console.log('='.repeat(60));
  console.log(`
// Express 示例
const express = require('express');
const { convertAngleToPrompt } = require('./multiAngle_nodejs');

const app = express();
app.use(express.json());

app.post('/api/angle-to-prompt', (req, res) => {
  const { rotate, vertical, zoom, addAnglePrompt } = req.body;
  const result = convertAngleToPrompt({ rotate, vertical, zoom, addAnglePrompt });
  res.json(result);
});

app.listen(3000);
`);
  console.log('='.repeat(60));
}
