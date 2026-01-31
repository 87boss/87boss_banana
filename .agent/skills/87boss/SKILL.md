---
name: 87boss
description: 規範並自動化 87Boss 專案的「開始」、「重啟」與「發佈」流程，確保 Backend (8766) 和 Frontend (8767) 正確啟動。
---

# 87Boss Lifecycle (前 Penguin Lifecycle)

當用戶提出「開始」、「重啟」或「發佈」專案時，必須遵循此 Skill 進行操作，以實現「一句話完成」且「不重複確認」的目標。

## 1. 核心原則
- **無須確認**：除非發生嚴重錯誤，否則自動執行所有步驟。
- **兩個服務**：Backend (8766) 和 Frontend (8767) 必須同時運行。
- **服務依賴**：Frontend 的 Vite proxy 依賴 Backend，**必須先啟動 Backend**。
- **路徑明確**：確保指令在正確的目錄執行。

## 2. 功能規範

### A. 開始 / 重啟 (Start / Restart)

**關鍵順序**：必須先啟動 Backend，再啟動 Frontend！

#### 步驟 1: 清理舊進程
```powershell
taskkill /F /IM node.exe /IM electron.exe 2>$null
```
> 注意：使用 `2>$null` 忽略「找不到進程」的錯誤訊息。

#### 步驟 2: 啟動 Backend (必須先啟動)
```powershell
cd backend-nodejs
node src/server.js
```
**驗證**：
- 終端顯示 `🚀 服務器啟動成功!`
- `地址: http://127.0.0.1:8766`

#### 步驟 3: 啟動 Frontend (Electron)
```powershell
npm run electron:dev
```
**說明**：
- 此命令會啟動 Vite (port 8767) + Electron
- **不要**開啟瀏覽器訪問 `localhost:8767`
- 應用會在 Electron 視窗中運行

#### 常見問題處理

**問題 1: Vite proxy 錯誤 `ECONNREFUSED`**
- **原因**：Backend 未啟動或啟動失敗
- **解決**：檢查 Backend 是否在 port 8766 運行

**問題 2: TypeScript 編譯錯誤**
- **檢查**：`src/utils/cn2tw.ts` 是否有語法錯誤
- **常見**：對象最後一項不應有逗號

**問題 3: 縮圖閃爍**
- **檢查**：`App.tsx` 中 `setDesktopItems` 是否有重複添加
- **解決**：確保有重複檢查機制

### B. 發佈 (Release / Publish)

#### 步驟 1: 版本更新
```powershell
# 自動更新 patch 版本 (+0.0.1)
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));const v=p.version.split('.').map(Number);v[2]++;p.version=v.join('.');fs.writeFileSync('package.json',JSON.stringify(p,null,2));"
```

#### 步驟 2: 停止開發服務
```powershell
taskkill /F /IM node.exe /IM electron.exe
```

#### 步驟 3: 清理舊發佈檔案 (關鍵! 防止鎖定錯誤)
```powershell
if (Test-Path release) { Remove-Item -Recurse -Force release }
```

#### 步驟 4: 打包
```powershell
npm run package
```
**預期結果**：
- 終端顯示 `Exit code: 0`
- 生成 `release/RunningHub-AI-{version}-Setup.exe`
- 安裝檔大小約 136 MB
- 確保 `release/win-unpacked/resources` 中包含 `dist` 資料夾 (關鍵修復)
- **注意**：安裝後，生成的圖片會自動儲存在 `Documents/87Boss_RunningHub_Data/output`，而非安裝目錄。

#### 步驟 4: 上傳 (可選)
```powershell
npm run upload
```

#### 步驟 5: Git 同步 (可選)
```powershell
git add .
git commit -m "Release v{version}"
git push
```

## 3. 最佳實踐

### 啟動檢查清單
- [ ] Backend 運行在 port 8766
- [ ] Frontend Vite 運行在 port 8767
- [ ] Electron 視窗已開啟
- [ ] 終端無 `ECONNREFUSED` 錯誤
- [ ] 縮圖正常顯示不閃爍

### 故障排除
1. **Backend 無法啟動**
   - 檢查 `backend-nodejs/src/server.js` 是否存在
   - 檢查 `backend-nodejs/package.json` dependencies

2. **Frontend 無法啟動**
   - 確認 Backend 已運行
   - 檢查 `vite.config.ts` proxy 配置

3. **打包失敗**
   - 檢查 `electron-builder.json` 配置
   - 確認 `.venv` 已被排除

## 4. 完整啟動腳本範例

以下是完整的啟動順序（按照成功經驗）：

```powershell
# 1. 清理舊進程
taskkill /F /IM node.exe /IM electron.exe 2>$null
Start-Sleep -Seconds 1

# 2. 啟動 Backend (背景運行)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\Dropbox\0000google\87boss_banana\backend-nodejs'; node src/server.js"

# 3. 等待 Backend 啟動
Start-Sleep -Seconds 3

# 4. 啟動 Frontend
npm run electron:dev
```

**重要提醒**：
- 不要同時在兩個終端手動執行，使用背景進程
- Backend 必須先於 Frontend 啟動
- 應用在 Electron 視窗中運行，不需要瀏覽器
