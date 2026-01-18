# 貢獻指南 Contributing Guide

感謝你考慮為 **企鵝工坊 Penguin Magic** 做出貢獻！🎉

我們歡迎任何形式的貢獻，包括但不限於：

- 🐛 報告 Bug
- 💡 提出新功能建議
- 📝 改進檔案
- 🔧 提交程式碼修復或新功能
- 🎨 最佳化介面和使用者體驗

---

## 行為準則

請遵守我們的行為準則，保持友善、尊重和包容。我們致力於為所有人提供一個無騷擾的協作環境。

---

## 如何貢獻

### 報告 Bug

如果你發現了 Bug，請透過 [GitHub Issues](https://github.com/your-username/PenguinMagic/issues) 報告。提交 Bug 報告時，請包含：

- **問題描述**：清晰簡潔地描述問題
- **復現步驟**：列出重現問題的詳細步驟
- **預期行為**：描述你期望發生的情況
- **實際行為**：描述實際發生的情況
- **環境資訊**：
  - 作業系統（Windows 10/11, macOS, Linux）
  - Node.js 版本
  - 瀏覽器版本（如果是前端問題）
- **截圖或日誌**：如果可能，附上截圖或錯誤日誌

### 提出新功能建議

我們歡迎你提出新功能想法！請透過 [GitHub Issues](https://github.com/your-username/PenguinMagic/issues) 提交功能建議，幷包含：

- **功能描述**：清晰描述你希望新增的功能
- **使用場景**：說明這個功能解決什麼問題或滿足什麼需求
- **可能的實現方案**：如果你有想法，可以簡單描述實現思路
- **替代方案**：是否考慮過其他解決方案

### 提交程式碼

#### 開發環境準備

1. **Fork 本倉庫**到你的 GitHub 賬號

2. **克隆你的 Fork**：
   ```bash
   git clone https://github.com/your-username/PenguinMagic.git
   cd PenguinMagic
   ```

3. **安裝依賴**：
   ```bash
   # 安裝前端依賴
   npm install
   
   # 安裝後端依賴
   cd backend-nodejs
   npm install
   cd ..
   ```

4. **啟動開發環境**：
   ```bash
   # 啟動前端開發伺服器
   npm run dev
   
   # 在另一個終端啟動後端服務
   cd backend-nodejs
   npm start
   ```

5. **訪問應用**：
   開啟瀏覽器訪問 `http://127.0.0.1:8765`

#### 分支管理

- 從 `main` 或 `develop` 分支建立你的功能分支：
  ```bash
  git checkout -b feature/your-feature-name
  # 或
  git checkout -b bugfix/your-bugfix-name
  ```

- 分支命名規範：
  - `feature/*`：新功能開發
  - `bugfix/*`：Bug 修復
  - `docs/*`：檔案改進
  - `refactor/*`：程式碼重構
  - `test/*`：測試相關

#### 程式碼規範

**前端（React/TypeScript）**：
- 使用 TypeScript 編寫程式碼，確保型別安全
- 元件使用函式式元件和 Hooks
- 遵循現有的程式碼風格（縮排、命名等）
- 檔名使用 PascalCase（元件）或 camelCase（工具函式）

**後端（Node.js）**：
- 使用 ES6+ 語法
- 遵循現有的程式碼風格
- 新增必要的錯誤處理和日誌記錄

**通用規範**：
- 保持程式碼簡潔易讀
- 新增必要的註釋，尤其是複雜邏輯
- 避免引入不必要的依賴

#### 提交規範

提交資訊應該清晰描述改動內容。建議使用以下格式：

```
<型別>: <簡短描述>

<詳細描述（可選）>

<關聯的 Issue（可選）>
```

**型別**：
- `feat`：新功能
- `fix`：Bug 修復
- `docs`：檔案更新
- `style`：程式碼格式調整（不影響功能）
- `refactor`：程式碼重構
- `test`：測試相關
- `chore`：構建工具或輔助工具的變動

**示例**：
```
feat: 新增容器分類功能

- 實現 1x1, 1x2, 2x1, 2x2 四種容器尺寸
- 支援拖拽專案到容器內
- 新增容器右鍵選單選項

Closes #123
```

#### 測試

在提交程式碼前，請確保：

- [ ] 程式碼可以正常構建（`npm run build`）
- [ ] 功能正常工作，沒有明顯 Bug
- [ ] 沒有引入新的警告或錯誤
- [ ] 如果修改了 API，後端和前端都已更新

#### 提交 Pull Request

1. **推送你的分支**到 Fork 的倉庫：
   ```bash
   git push origin feature/your-feature-name
   ```

2. **建立 Pull Request**：
   - 前往 GitHub 原倉庫頁面
   - 點選 "New Pull Request"
   - 選擇你的分支作為源分支
   - 填寫 PR 標題和描述

3. **PR 描述應包含**：
   - **改動內容**：清晰描述你做了什麼
   - **相關 Issue**：如果有，連結相關的 Issue
   - **測試說明**：描述你如何測試這些改動
   - **截圖**：如果是 UI 改動，附上截圖

4. **等待審查**：
   - 維護者會審查你的程式碼
   - 可能會提出修改建議
   - 請及時響應反饋並更新程式碼

---

## 開發技巧

### 專案結構

```
PenguinMagic/
├── components/          # React 元件
├── services/           # API 和業務邏輯
├── hooks/              # 自定義 Hooks
├── types/              # TypeScript 型別定義
├── utils/              # 工具函式
├── backend-nodejs/     # Node.js 後端服務
│   ├── src/
│   │   ├── routes/    # API 路由
│   │   └── utils/     # 後端工具函式
│   └── data/          # 資料檔案儲存
└── ...
```

### 常用命令

```bash
# 前端開發
npm run dev              # 啟動開發伺服器
npm run build            # 構建生產版本
npm run preview          # 預覽生產版本

# 後端開發
cd backend-nodejs
npm start                # 啟動後端服務
```

### 除錯技巧

- **前端除錯**：使用瀏覽器開發者工具
- **後端除錯**：檢視終端輸出的日誌
- **網路請求**：在瀏覽器 Network 標籤中檢視 API 請求

---

## 版本釋出流程

（僅適用於維護者）

1. 更新版本號（`package.json` 和 `backend-nodejs/package.json`）
2. 更新 `CHANGELOG.md`
3. 建立 Git Tag：`git tag -a v0.2.4 -m "Release v0.2.4"`
4. 推送 Tag：`git push origin v0.2.4`
5. 在 GitHub 上建立 Release

---

## 聯絡方式

如果你有任何問題或需要幫助，可以透過以下方式聯絡我們：

- **Q群**：854266067
- **微信**：Lovexy_0222
- **GitHub Issues**：[提交 Issue](https://github.com/your-username/PenguinMagic/issues)

---

## 致謝

感謝所有為企鵝工坊做出貢獻的開發者！🙏

你的每一個貢獻，無論大小，都讓這個專案變得更好。

---

**Happy Coding! 🐧✨**
# 貢獻指南 Contributing Guide

感謝你考慮為 **企鵝工坊 Penguin Magic** 做出貢獻！🎉

我們歡迎任何形式的貢獻，包括但不限於：

- 🐛 報告 Bug
- 💡 提出新功能建議
- 📝 改進檔案
- 🔧 提交程式碼修復或新功能
- 🎨 最佳化介面和使用者體驗

---

## 行為準則

請遵守我們的行為準則，保持友善、尊重和包容。我們致力於為所有人提供一個無騷擾的協作環境。

---

## 如何貢獻

### 報告 Bug

如果你發現了 Bug，請透過 [GitHub Issues](https://github.com/your-username/PenguinMagic/issues) 報告。提交 Bug 報告時，請包含：

- **問題描述**：清晰簡潔地描述問題
- **復現步驟**：列出重現問題的詳細步驟
- **預期行為**：描述你期望發生的情況
- **實際行為**：描述實際發生的情況
- **環境資訊**：
  - 作業系統（Windows 10/11, macOS, Linux）
  - Node.js 版本
  - 瀏覽器版本（如果是前端問題）
- **截圖或日誌**：如果可能，附上截圖或錯誤日誌

### 提出新功能建議

我們歡迎你提出新功能想法！請透過 [GitHub Issues](https://github.com/your-username/PenguinMagic/issues) 提交功能建議，幷包含：

- **功能描述**：清晰描述你希望新增的功能
- **使用場景**：說明這個功能解決什麼問題或滿足什麼需求
- **可能的實現方案**：如果你有想法，可以簡單描述實現思路
- **替代方案**：是否考慮過其他解決方案

### 提交程式碼

#### 開發環境準備

1. **Fork 本倉庫**到你的 GitHub 賬號

2. **克隆你的 Fork**：
   ```bash
   git clone https://github.com/your-username/PenguinMagic.git
   cd PenguinMagic
   ```

3. **安裝依賴**：
   ```bash
   # 安裝前端依賴
   npm install
   
   # 安裝後端依賴
   cd backend-nodejs
   npm install
   cd ..
   ```

4. **啟動開發環境**：
   ```bash
   # 啟動前端開發伺服器
   npm run dev
   
   # 在另一個終端啟動後端服務
   cd backend-nodejs
   npm start
   ```

5. **訪問應用**：
   開啟瀏覽器訪問 `http://127.0.0.1:8765`

#### 分支管理

- 從 `main` 或 `develop` 分支建立你的功能分支：
  ```bash
  git checkout -b feature/your-feature-name
  # 或
  git checkout -b bugfix/your-bugfix-name
  ```

- 分支命名規範：
  - `feature/*`：新功能開發
  - `bugfix/*`：Bug 修復
  - `docs/*`：檔案改進
  - `refactor/*`：程式碼重構
  - `test/*`：測試相關

#### 程式碼規範

**前端（React/TypeScript）**：
- 使用 TypeScript 編寫程式碼，確保型別安全
- 元件使用函式式元件和 Hooks
- 遵循現有的程式碼風格（縮排、命名等）
- 檔名使用 PascalCase（元件）或 camelCase（工具函式）

**後端（Node.js）**：
- 使用 ES6+ 語法
- 遵循現有的程式碼風格
- 新增必要的錯誤處理和日誌記錄

**通用規範**：
- 保持程式碼簡潔易讀
- 新增必要的註釋，尤其是複雜邏輯
- 避免引入不必要的依賴

#### 提交規範

提交資訊應該清晰描述改動內容。建議使用以下格式：

```
<型別>: <簡短描述>

<詳細描述（可選）>

<關聯的 Issue（可選）>
```

**型別**：
- `feat`：新功能
- `fix`：Bug 修復
- `docs`：檔案更新
- `style`：程式碼格式調整（不影響功能）
- `refactor`：程式碼重構
- `test`：測試相關
- `chore`：構建工具或輔助工具的變動

**示例**：
```
feat: 新增容器分類功能

- 實現 1x1, 1x2, 2x1, 2x2 四種容器尺寸
- 支援拖拽專案到容器內
- 新增容器右鍵選單選項

Closes #123
```

#### 測試

在提交程式碼前，請確保：

- [ ] 程式碼可以正常構建（`npm run build`）
- [ ] 功能正常工作，沒有明顯 Bug
- [ ] 沒有引入新的警告或錯誤
- [ ] 如果修改了 API，後端和前端都已更新

#### 提交 Pull Request

1. **推送你的分支**到 Fork 的倉庫：
   ```bash
   git push origin feature/your-feature-name
   ```

2. **建立 Pull Request**：
   - 前往 GitHub 原倉庫頁面
   - 點選 "New Pull Request"
   - 選擇你的分支作為源分支
   - 填寫 PR 標題和描述

3. **PR 描述應包含**：
   - **改動內容**：清晰描述你做了什麼
   - **相關 Issue**：如果有，連結相關的 Issue
   - **測試說明**：描述你如何測試這些改動
   - **截圖**：如果是 UI 改動，附上截圖

4. **等待審查**：
   - 維護者會審查你的程式碼
   - 可能會提出修改建議
   - 請及時響應反饋並更新程式碼

---

## 開發技巧

### 專案結構

```
PenguinMagic/
├── components/          # React 元件
├── services/           # API 和業務邏輯
├── hooks/              # 自定義 Hooks
├── types/              # TypeScript 型別定義
├── utils/              # 工具函式
├── backend-nodejs/     # Node.js 後端服務
│   ├── src/
│   │   ├── routes/    # API 路由
│   │   └── utils/     # 後端工具函式
│   └── data/          # 資料檔案儲存
└── ...
```

### 常用命令

```bash
# 前端開發
npm run dev              # 啟動開發伺服器
npm run build            # 構建生產版本
npm run preview          # 預覽生產版本

# 後端開發
cd backend-nodejs
npm start                # 啟動後端服務
```

### 除錯技巧

- **前端除錯**：使用瀏覽器開發者工具
- **後端除錯**：檢視終端輸出的日誌
- **網路請求**：在瀏覽器 Network 標籤中檢視 API 請求

---

## 版本釋出流程

（僅適用於維護者）

1. 更新版本號（`package.json` 和 `backend-nodejs/package.json`）
2. 更新 `CHANGELOG.md`
3. 建立 Git Tag：`git tag -a v0.2.4 -m "Release v0.2.4"`
4. 推送 Tag：`git push origin v0.2.4`
5. 在 GitHub 上建立 Release

---

## 聯絡方式

如果你有任何問題或需要幫助，可以透過以下方式聯絡我們：

- **Q群**：854266067
- **微信**：Lovexy_0222
- **GitHub Issues**：[提交 Issue](https://github.com/your-username/PenguinMagic/issues)

---

## 致謝

感謝所有為企鵝工坊做出貢獻的開發者！🙏

你的每一個貢獻，無論大小，都讓這個專案變得更好。

---

**Happy Coding! 🐧✨**
