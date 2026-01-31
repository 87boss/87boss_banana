---
name: 87boss-20260201
description: 2026-02-01 版本的核心路徑與存檔邏輯規範。包含自定義目錄映射、虛擬 URL 解析、以及 RunningHub 任務的去重化存檔流程。
---

# 87boss-20260201 技能規範

本技能定義了 87boss_banana 專案中關於檔案存儲、縮圖顯示及任務監控的核心成功邏輯。

## 1. 核心檔案路徑處理 (Path Handling)

### 自定義輸出目錄映射
- **原則**：當用戶設定自定義路徑（如 `test33`）時，後端物理存儲指向該路徑，但對前端暴露的 URL 必須映射回標準虛擬目錄（如 `/files/output`）。
- **實作規範**：調用 `FileHandler.saveImage` 時需顯式傳遞 `virtualDir` 參數。
  ```javascript
  // 範例：將圖片存入 config.OUTPUT_DIR (實體)，但返回 /files/output/... (虛擬)
  FileHandler.saveImage(imageData, config.OUTPUT_DIR, filename, 'output');
  ```

### 縮圖生成提示 (Thumbnail Notification)
- **原則**：Electron 主程序在存檔後應立即通知後端生成縮圖，確保桌面項目即時顯示。
- **實作規範**：使用 `notifyBackendThumbnail(filePath, subDir)` 助手。

## 2. RunningHub 任務去重邏輯 (Deduplication)

### 存檔權限單一化
- **原則**：`MiniRunningHub.tsx` 元件僅負責發起任務與 UI 反饋，**禁止**執行磁碟寫入（`saveFile`）或桌面數據操作。
- **原則**：所有的檔案存檔以及桌面佔位符更新，統一由 `App.tsx` 中的全局監控器（Polling Monitor）處理。

### 狀態重置
- **原則**：當 `webappId` 切換時，必須清空元件內部的 `result`、`taskId`、`savedPaths` 等狀態，防止舊任務的後續邏輯干擾新選取的 WebApp。

## 3. 桌面縮圖定位 (Smart Stacking Fix)

### 動態空位尋找
- **原則**：桌面佔位符的位置計算必須在 `setDesktopItems` 的**函數式更新內部**進行，以確保座標計算基於桌面的「最新狀態」。
- **實作規範**：
  ```typescript
  setDesktopItems(prev => {
    // 遍歷 prev 並基於 100x100 網格尋找第一個未被 occupied 的座標
    // ...網格遍歷邏輯...
    return [...prev, newItem];
  });
  ```

## 4. 適用場景
- 當需要修復或重構 RunningHub 的任務顯示流程時。
- 當需要調整檔案下載與路徑映射邏輯時。
- 當發生桌面縮圖重疊或重複下載 Bug 時。
