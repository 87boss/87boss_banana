export const rhTranslations = {
    // UI Labels
    labels: {
        runningHub: 'RunningHub',
        sidePanelTitle: 'RH-AI 應用',
        apiKeyMissing: '請在設定中配置 API Key',
        inputPlaceholder: '輸入 Webapp ID',
        addToLibrary: '加到庫',
        addedToLibrary: '已添加到 RH-AI 應用庫',
        appExists: '此應用已存在庫中',
        startApp: '執行',
        uploading: '上傳中...',
        running: '執行中...',
        completed: '完成',
        retry: '重試',
        decode: '解碼',
        download: '下載',
        decoded: '已解碼',
        savedFiles: '✓ 已保存 {count} 個文件',
        saving: '⏳ 正在保存...',
        restart: '重新開始',
        uploadImage: '點擊上傳圖片',
        getFromCanvas: '從畫布獲取圖片',
        preview: '預覽',
        noAppInfo: '無法獲取應用資訊',
        selectImage: '請選擇圖片',
        configureApiKey: '請在設定中配置 RunningHub API Key',
        executionFailed: '執行失敗',
        downloadSuccess: '已下載到: {path}',
        downloadFailed: '下載失敗: {error}',
        unknownError: '未知錯誤',
        noSavedApps: '暫無保存的應用',
        addInPanel: '請在 RunningHub 面板中添加',
        unnamedApp: '未命名應用',
        delete: '刪除',
        confirmDelete: '點擊確認刪除',
        syncNames: '同步名稱 (從 API 獲取最新中文名稱)',
        syncComplete: '同步完成，更新了 {count} 個名稱',
        syncNoChanges: '同步完成，沒有名稱需要更新',
        syncFailed: '同步失敗，請檢查網絡或 API Key',
    },
    // API Status Mapping
    status: {
        'QUEUED': '排隊中',
        'RUNNING': '執行中',
        'SUCCESS': '成功',
        'FAILED': '失敗',
        'TIMEOUT': '超時',
    },
    // Common Progress Messages
    progress: {
        'Initializing': '初始化中...',
        'Downloading model': '下載模型中...',
        'Loading model': '加載模型中...',
        'Processing': '處理中...',
        'Generating': '生成中...',
        'Finishing': '完成中...',
    },
    // English to Traditional Chinese Mappings for App Names
    appNames: {
        'ID photo [Ah Cai]': '證件照 [阿財]',
        'High Dynamic Image Video': '高動態影像視頻',
        'High Dynamic Image Video 【阿財】': '高動態影像視頻 【阿財】'
    }
};

export function getTranslation(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = rhTranslations;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k as keyof typeof value];
        } else {
            return key;
        }
    }

    if (typeof value === 'string' && params) {
        let result = value;
        for (const [pKey, pVal] of Object.entries(params)) {
            result = result.replace(`{${pKey}}`, String(pVal));
        }
        return result;
    }

    return typeof value === 'string' ? value : key;
}
