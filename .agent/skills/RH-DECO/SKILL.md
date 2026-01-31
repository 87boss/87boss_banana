---
name: RH-DECO
description: 核心圖片解碼功能 (圖片解密) 的實作邏輯與技術細節。
---

# RH-DECO: 圖片解碼功能指南 (核心邏輯)

本文件記載了 `87Boss AI學堂` 中桌面右鍵「圖片解密」功能的核心實作邏輯，包含路徑解析強化與 Windows EBUSY 鎖定重試機制。

## 架構概述

解碼功能採用 Electron 的非同步 IPC (Inter-Process Communication) 模式：
1.  **Frontend (渲染程序)**: `Desktop.tsx` 或 `MiniRunningHub` 發起請求，提供圖片的 URL、Base64 或路徑。
2.  **Bridge (預載腳本)**: `electron/preload.cjs` 暴露 `electronAPI.decodeImage` 給前端呼叫。
3.  **Backend (主程序)**: `electron/main.cjs` 處理路徑解析、執行外部解碼器 (`duck_decoder.exe`) 並處理檔案操作。

## 核心實作技術細節

### 1. 魯棒的路徑解析 (Robust Path Resolution)
後端 `rh-decode-image` 處理程序現在能自動識別多種輸入格式：
-   **Base64 數據**: 偵測到 `data:` 開頭或包含 `;base64,` 的字串時，會自動寫入臨時檔案進行解碼。
-   **虛擬 URL**: 能將前端產生的 `/files/output/...` 相對路徑正確地轉換為系統實體路徑。
-   **Basename 備選**: 若路徑解析失敗，會嘗試在輸出目錄 (`output`) 中以檔名進行備選匹配。

### 2. Windows EBUSY 鎖定重試機制
在 Windows 環境下，檔案常因預覽、防毒掃描或系統索引而暫時被鎖定 (`EBUSY`)。為提高成功率，重命名邏輯實作了重試迴圈：
-   **重試次數**: 最多 5 次。
-   **退避算法 (Backoff)**: 每次失敗後等待時間逐漸增加 (200ms * i)。
-   **容錯處理**: 若 `unlinkSync` 失敗會記錄警告並嘗試直接覆蓋，最後若 5 次重試皆失敗才回報錯誤。

## 後端實作邏輯 (main.cjs)

```javascript
// 關鍵邏輯摘要
ipcMain.handle('rh-decode-image', async (event, { buffer, fileName, filePath }) => {
    // 1. 路徑解析與 Base64 處理
    const isDataURL = typeof filePath === 'string' && (filePath.trim().startsWith('data:') || filePath.includes(';base64,'));
    // ... 解析與寫入 tempInputPath ...

    // 2. 執行解碼器
    // execFile(decoderPath, ['--duck', tempInputPath, '--out', tempOutputPath], ...)

    // 3. 檔案重試機制 (解決 EBUSY)
    for (let i = 0; i < 5; i++) {
        try {
            fs.renameSync(expectedOutputPath, finalPath);
            break;
        } catch (e) {
            if (e.code === 'EBUSY' && i < 4) {
               await new Promise(r => setTimeout(r, 200 * (i + 1)));
            } else { throw e; }
        }
    }
});
```

## 注意事項
-   **外部依賴**: `duck_decoder.exe` 必須放置於 `extraResources` 資料夾中。
-   **暫存檔清理**: 解碼成功後，系統會自動清理 `temp_b64` 等臨時輸入檔案。

---
> [!NOTE]
> 本 Skill 更新於 2026-01-23，同步了 Base64 支援與 EBUSY 重試強化邏輯。
