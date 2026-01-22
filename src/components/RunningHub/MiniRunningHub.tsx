import React, { useState, useCallback, useEffect } from 'react';
import { Zap, Upload, Play, Loader2, CheckCircle, XCircle, Settings, ChevronDown, ChevronUp, Download, Wand2, RefreshCw, BookmarkPlus } from 'lucide-react';
import { getWebappDetail, uploadFile, submitTask, queryTaskOutputs } from '../../services/runningHub/api';
import type { NodeInfo, TaskOutput } from '../../services/runningHub/types';
import { saveHistoryItem } from '../../../services/db/historyDb';
import * as desktopApi from '../../../services/api/desktop';
import type { GenerationHistory, DesktopImageItem } from '../../../types';
import { simplifiedToTraditional } from '../../utils/cn2tw';
import { getTranslation, rhTranslations } from '../../utils/rhTranslations';

interface MiniRunningHubProps {
    /** 可選：從畫布獲取當前圖片 */
    getCanvasImage?: () => Promise<File | null>;
    /** 可選：通知結果已保存 */
    onResultSaved?: (filePaths: string[]) => void;
    /** 可選：通知歷史記錄已更新，用於刷新桌面 */
    onHistoryUpdate?: () => void;
    /** 可選：從外部傳入圖片進行處理 */
    externalFile?: File | null;
    /** 可選：通知任務成功 (用於觸發外部彈窗) */
    onTaskSuccess?: (results: TaskOutput[]) => void;
    /** 可選：通知任務開始 (用於創建桌面佔位符) */
    /** 可選：通知任務開始 (用於創建桌面佔位符) */
    onTaskStart?: (taskId: string, prompt: string) => void;
    /** 可選：外部控制當前 Webapp ID */
    activeAppId?: string;
}

type Step = 'idle' | 'configuring' | 'uploading' | 'running' | 'success' | 'error';

const API_CODE = {
    SUCCESS: 0,
    RUNNING: 804,
    FAILED: 805,
    QUEUED: 813,
};

// 從 localStorage 獲取 API Key
const getStoredApiKey = () => localStorage.getItem('rh_api_key') || '';

export function MiniRunningHub({ getCanvasImage, onResultSaved, onHistoryUpdate, externalFile, onTaskSuccess, onTaskStart, activeAppId }: MiniRunningHubProps) {
    // API 設定
    const [apiKey, setApiKey] = useState(getStoredApiKey);
    const [webappId, setWebappId] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    // Persistence: Load config from backend
    useEffect(() => {
        if ((window as any).electronAPI?.runningHub?.getConfig) {
            (window as any).electronAPI.runningHub.getConfig().then((res: any) => {
                if (res.success && res.data) {
                    if (res.data.apiKey) {
                        setApiKey(res.data.apiKey);
                        localStorage.setItem('rh_api_key', res.data.apiKey); // Sync to localStorage
                    }
                    if (res.data.webappId) {
                        setWebappId(res.data.webappId);
                    }
                }
            });
        }
    }, []);

    const handleWebappIdChange = (val: string) => {
        setWebappId(val);
        // Debounce or save directly? Saving directly for simplicity as it's local
        if ((window as any).electronAPI?.runningHub?.saveConfig) {
            (window as any).electronAPI.runningHub.saveConfig({ webappId: val });
        }
    };

    // 狀態
    const [step, setStep] = useState<Step>('idle');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [isLoadingApp, setIsLoadingApp] = useState(false);

    // 上傳的檔案
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // 結果
    const [result, setResult] = useState<TaskOutput[] | null>(null);
    const [decodedResults, setDecodedResults] = useState<Map<number, string>>(new Map());
    const [savedPaths, setSavedPaths] = useState<string[]>([]);
    const [taskId, setTaskId] = useState<string | null>(null);

    // App 資訊
    const [appName, setAppName] = useState<string>('');
    const [nodeInfoList, setNodeInfoList] = useState<NodeInfo[]>([]);
    // 動態參數輸入
    const [paramValues, setParamValues] = useState<Record<string, string>>({});

    // 監聽 activeAppId 變化
    useEffect(() => {
        if (activeAppId) {
            setWebappId(activeAppId);
        }
    }, [activeAppId]);

    // 監聽 settings 中的 API Key 變化
    useEffect(() => {
        const handleStorageChange = () => {
            setApiKey(getStoredApiKey());
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // 監聽外部傳入圖片
    useEffect(() => {
        if (externalFile) {
            setSelectedFile(externalFile);
            setPreviewUrl(URL.createObjectURL(externalFile));
            setResult(null);
            setDecodedResults(new Map());
            // 如果當前是 idle 或 error 狀態，切換到配置狀態
            if (step === 'idle' || step === 'error' || step === 'success') {
                setStep('configuring');
            }
        }
    }, [externalFile]);

    // 獲取 Webapp 詳情
    const fetchWebappInfo = useCallback(async () => {
        const currentApiKey = getStoredApiKey();
        if (!currentApiKey.trim() || !webappId.trim()) return;

        setIsLoadingApp(true);
        try {
            const detail = await getWebappDetail(currentApiKey.trim(), webappId.trim());

            // 本地化處理 (簡 -> 繁) + 英文名稱映射
            const originalName = detail.webappName || '';
            const localizedAppName = (rhTranslations.appNames as Record<string, string>)[originalName] || simplifiedToTraditional(originalName);
            setAppName(localizedAppName);


            const localizedNodes = (detail.nodeInfoList || []).map(node => ({
                ...node,
                nodeName: simplifiedToTraditional(node.nodeName || ''),
                description: simplifiedToTraditional(node.description || ''),
                paramName: simplifiedToTraditional(node.paramName || ''),
                fieldValue: simplifiedToTraditional(node.fieldValue || ''),
                fieldData: node.fieldData ? node.fieldData.split(',').map(s => simplifiedToTraditional(s.trim())).join(',') : node.fieldData
            }));

            setNodeInfoList(localizedNodes);

            // 初始化參數值
            const initialValues: Record<string, string> = {};
            localizedNodes.forEach(node => {
                const key = `${node.nodeId}-${node.fieldName}`;
                initialValues[key] = node.fieldValue || '';
            });
            setParamValues(initialValues);
            setError(null);
        } catch (err: any) {
            setAppName('');
            setNodeInfoList([]);
            // Ensure error message from API is also localized
            const errorMsg = err.message ? simplifiedToTraditional(err.message) : '';
            setError(errorMsg || getTranslation('labels.noAppInfo'));
        } finally {
            setIsLoadingApp(false);
        }
    }, [webappId]);

    useEffect(() => {
        if (webappId.length > 5) {
            // 如果剛切換 activeAppId，立即加載，不要 debounce 太久
            const timer = setTimeout(fetchWebappInfo, activeAppId === webappId ? 100 : 500);
            return () => clearTimeout(timer);
        } else {
            setAppName('');
            setNodeInfoList([]);
        }
    }, [webappId, fetchWebappInfo, activeAppId]);

    // 處理文件選擇
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResult(null);
            setDecodedResults(new Map());
        }
    }, []);

    // 從畫布獲取圖片
    const handleGetFromCanvas = useCallback(async () => {
        if (!getCanvasImage) return;
        const file = await getCanvasImage();
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResult(null);
            setDecodedResults(new Map());
        }
    }, [getCanvasImage]);

    // 更新參數值
    const updateParamValue = useCallback((nodeId: string, fieldName: string, value: string) => {
        setParamValues(prev => ({ ...prev, [`${nodeId}-${fieldName}`]: value }));
    }, []);

    // 自動保存結果到 output 資料夾 + 添加到歷史記錄
    const autoSaveResults = useCallback(async (outputs: TaskOutput[]) => {
        // [Force] 強制自動保存，確保有本地檔案供解碼使用
        // const isAutoSaveEnabled = localStorage.getItem('auto_save_enabled') === 'true';
        // if (!isAutoSaveEnabled) return;
        console.log('[MiniRH] Auto-saving results (Forced for decoding)...');

        const electronAPI = (window as any).electronAPI;
        if (!electronAPI?.runningHub?.saveFile) {
            console.warn('[MiniRH] runningHub.saveFile not available');
            return;
        }

        const timestamp = Date.now();
        const paths: string[] = [];

        for (let idx = 0; idx < outputs.length; idx++) {
            const output = outputs[idx];
            // [Fix] 從 URL 檢測副檔名（支援影片）
            const urlExt = output.fileUrl.match(/\.(mp4|webm|mov|avi|png|jpg|jpeg|gif|webp)(?:\?|$)/i)?.[1]?.toLowerCase();
            const ext = urlExt || 'png';
            const fileName = `RH_${webappId.slice(0, 8)}_${timestamp}_${idx + 1}.${ext}`;

            try {
                const result = await electronAPI.runningHub.saveFile(output.fileUrl, fileName, 'runninghub');
                console.log(`[MiniRH] Saved ${fileName}:`, result);
                if (result?.success && result.path) {
                    paths.push(result.path);

                    // 添加到歷史記錄以顯示在桌面
                    const filename = path.basename(result.path);
                    // [Fix] Use /files/output/ protocol which maps to the local file system properly for Electron renderer
                    const localUrl = `/files/output/${filename}`;

                    const historyItem: GenerationHistory = {
                        id: timestamp + idx, // 使用時間戳 + 索引作為 ID
                        imageUrl: localUrl,
                        prompt: `RunningHub: ${appName || webappId}`,
                        timestamp: timestamp,
                        model: 'RunningHub',
                        isThirdParty: true,
                    };


                    try {
                        await saveHistoryItem(historyItem);
                        console.log(`[MiniRH] Saved to history: ${historyItem.id}`);

                        // 同步保存到桌面 (後台操作，不觸發 UI 刷新)
                        try {
                            // 1. 獲取當前桌面項目
                            const desktopRes = await desktopApi.getDesktopItems();
                            if (desktopRes.success && desktopRes.data) {
                                const currentItems = desktopRes.data;

                                // 2. 創建新桌面項目
                                const newDesktopItem: DesktopImageItem = {
                                    id: `img-${historyItem.id}`,
                                    type: 'image',
                                    name: historyItem.prompt.slice(0, 20) || 'RunningHub Image',
                                    imageUrl: historyItem.imageUrl,
                                    createdAt: historyItem.timestamp,
                                    updatedAt: historyItem.timestamp,
                                    position: { x: 100 + (paths.length * 20), y: 100 + (paths.length * 20) }, // 簡單錯開位置
                                    historyId: historyItem.id,
                                    prompt: historyItem.prompt,
                                    model: historyItem.model,
                                    isThirdParty: true,
                                    isLoading: false
                                };

                                // 3. 保存更新後的列表
                                await desktopApi.saveDesktopItems([...currentItems, newDesktopItem]);
                                console.log(`[MiniRH] Saved to desktop: ${newDesktopItem.id}`);
                            }
                        } catch (desktopErr) {
                            console.error('[MiniRH] Failed to save to desktop:', desktopErr);
                        }
                    } catch (historyErr) {
                        console.error('[MiniRH] Failed to save history:', historyErr);
                    }
                }
            } catch (err) {
                console.error(`[MiniRH] Failed to save ${fileName}:`, err);
            }
        }

        // 更新 UI state
        setSavedPaths(paths);

        if (paths.length > 0) {
            // 通知保存成功
            if (onResultSaved) {
                onResultSaved(paths);
            }
            // 通知歷史記錄更新 (刷新桌面)
            if (onHistoryUpdate) {
                onHistoryUpdate();
            }
        }

        console.log('[MiniRH] Auto-save completed:', paths.length, 'files');

        // [UI Fix] 任務完成後清空結果，避免佔用上傳框，並提示已保存到桌面
        setTimeout(() => {
            setResult(null); // 回到上傳介面
            setDecodedResults(new Map());
            // 移除 alert，改為靜默處理
            console.log(`[MiniRH] Silent save completed: ${paths.length} files`);
        }, 1000); // 延遲 1 秒讓用戶看到進度條完成
    }, [webappId, appName, onResultSaved, onHistoryUpdate]);

    // 執行工作流
    const handleRun = useCallback(async () => {
        const currentApiKey = getStoredApiKey();
        if (!currentApiKey.trim() || !webappId.trim()) {
            setError(getTranslation('labels.configureApiKey'));
            return;
        }

        // 找到 IMAGE 類型的節點，檢查是否需要圖片
        const imageNode = nodeInfoList.find(n => n.fieldType === 'IMAGE');
        if (imageNode && !selectedFile && !paramValues[`${imageNode.nodeId}-${imageNode.fieldName}`]) {
            setError(getTranslation('labels.selectImage'));
            return;
        }

        setStep('uploading');
        setError(null);
        setProgress(10);

        try {
            // 1. 上傳圖片 (如果有)
            let uploadedFileName = '';
            if (selectedFile) {
                const uploadResult = await uploadFile(currentApiKey.trim(), selectedFile);
                uploadedFileName = uploadResult.fileName;
            }
            setProgress(30);

            // 2. 準備參數
            const params = nodeInfoList.map(node => {
                const key = `${node.nodeId}-${node.fieldName}`;
                if (node.fieldType === 'IMAGE' && uploadedFileName) {
                    return { ...node, fieldValue: uploadedFileName };
                }
                return { ...node, fieldValue: paramValues[key] || node.fieldValue };
            });

            // 3. 提交任務
            setStep('running');
            const submission = await submitTask(currentApiKey.trim(), webappId.trim(), params);

            // 立即通知外部任務開始
            if (onTaskStart) {
                // 獲取 Prompt 作為任務名稱 (如果有)
                const promptValue = params.find(p => p.fieldName === 'prompt')?.fieldValue || 'RunningHub Task';
                onTaskStart(submission.taskId, String(promptValue));
            }

            // 更新狀態並開始輪詢
            console.log('[MiniRH] Task submitted:', submission.taskId);
            setTaskId(submission.taskId);

            // [UI Optimization] 如果有外部監控 (onTaskStart)，則立即恢復按鈕狀態，允許下一個任務
            if (onTaskStart) {
                setTimeout(() => {
                    setStep('idle');
                    setProgress(0);
                }, 500);
            }
        } catch (err: any) {
            const errorMsg = err.message ? simplifiedToTraditional(err.message) : '';
            setError(errorMsg || getTranslation('labels.executionFailed'));
            setStep('error');
        }
    }, [webappId, selectedFile, nodeInfoList, paramValues, onTaskStart]);

    // 輪詢任務狀態
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        if (taskId && step === 'running') {
            console.log('[MiniRH] Start polling for taskId:', taskId);

            const checkStatus = async () => {
                const currentApiKey = getStoredApiKey();
                if (!currentApiKey) return;

                try {
                    const res = await queryTaskOutputs(currentApiKey, taskId);

                    if (res.code === API_CODE.SUCCESS) {
                        // 任務完成
                        console.log('[MiniRH] Task success:', res.data);
                        const outputs = res.data as TaskOutput[];
                        setResult(outputs);
                        setStep('success');
                        setTaskId(null); // 停止輪詢

                        // 觸發自動保存
                        await autoSaveResults(outputs);

                        if (onTaskSuccess) {
                            onTaskSuccess(outputs);
                        }
                    } else if (res.code === API_CODE.FAILED) {
                        // 任務失敗
                        console.error('[MiniRH] Task failed:', res.msg);
                        setError(res.msg || 'Task execution failed');
                        setStep('error');
                        setTaskId(null);
                    } else if (res.code === API_CODE.RUNNING || res.code === API_CODE.QUEUED) {
                        // 繼續輪詢
                        if (res.data && typeof res.data === 'string') {
                            // 有時會返回進度字串? 這裡假設如果有進度信息可以更新
                            // setProgress(...) 
                        }
                    } else {
                        // 未知狀態
                        console.warn('[MiniRH] Unknown task status:', res);
                    }
                } catch (err: any) {
                    console.error('[MiniRH] Polling error:', err);
                    // 網絡錯誤不一定代表任務失敗，可以繼續重試，或者設計最大重試次數
                }
            };

            // 立即檢查一次，然後每 2 秒檢查一次
            checkStatus();
            intervalId = setInterval(checkStatus, 2000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [taskId, step, autoSaveResults, onTaskSuccess]);

    // 解碼圖片
    const handleDecode = useCallback(async (url: string, index: number) => {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI?.decodeImage) return;

        try {
            // [Fix] 優先使用已保存的本地檔案進行解碼 (避免縮圖或 fetch 問題)
            const localFilePath = savedPaths[index];
            let result;

            if (localFilePath) {
                console.log('[MiniRH] Decoding from local file:', localFilePath);
                // 傳遞 filePath 给後端，buffer 設為 null
                result = await electronAPI.decodeImage(null, `image_${index}.png`, localFilePath);
            } else {
                console.log('[MiniRH] Decoding from URL:', url);
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                // 舊方式: 傳 buffer
                result = await electronAPI.decodeImage(Array.from(new Uint8Array(arrayBuffer)), `image_${index}.png`);
            }

            if (result?.success && result.localUrl) {
                setDecodedResults(prev => new Map(prev).set(index, result.localUrl));
            } else if (result?.error) {
                console.error('Decode returned error:', result.error);
                alert(`Decode Failed: ${result.error}`); // [Fix] Alert user
            }
        } catch (err: any) {
            console.error('Decode failed:', err);
            alert(`Decode Error: ${err.message}`); // [Fix] Alert user
        }
    }, [savedPaths]);

    // 下載 - 使用 Electron IPC 避免跨域問題
    const handleDownload = useCallback(async (url: string, index?: number) => {
        const electronAPI = (window as any).electronAPI;

        // [Fix] 從 URL 檢測副檔名（支援影片）
        const urlExt = url.match(/\.(mp4|webm|mov|avi|png|jpg|jpeg|gif|webp)(?:\?|$)/i)?.[1]?.toLowerCase();
        const ext = urlExt || 'png';

        if (electronAPI?.runningHub?.saveFile) {
            // 使用 Electron IPC 下載
            const timestamp = Date.now();
            const fileName = `RH_download_${timestamp}_${index ?? 0}.${ext}`;

            try {
                const result = await electronAPI.runningHub.saveFile(url, fileName, 'downloads');
                if (result?.success) {
                    console.log('[MiniRH] Downloaded:', result.path);
                    alert(getTranslation('labels.downloadSuccess', { path: result.path }));
                } else {
                    console.error('[MiniRH] Download failed:', result?.error);
                    alert(getTranslation('labels.downloadFailed', { error: result?.error || getTranslation('labels.unknownError') }));
                }
            } catch (err: any) {
                console.error('[MiniRH] Download error:', err);
                alert(getTranslation('labels.downloadFailed', { error: err.message }));
            }
        } else {
            // Fallback: 使用 fetch + blob 下載
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `RH_download_${Date.now()}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            } catch (err) {
                console.error('[MiniRH] Fallback download failed:', err);
                // 最後手段：新視窗打開
                window.open(url, '_blank');
            }
        }
    }, []);

    const isRunning = step === 'uploading' || step === 'running';
    const hasApiKey = !!getStoredApiKey();

    // 過濾出需要用戶輸入的欄位 (排除 IMAGE 類型，因為用檔案選擇器)
    const inputFields = nodeInfoList.filter(n => n.fieldType !== 'IMAGE');

    return (
        <div className="flex flex-col h-full text-white">
            {/* 標題欄 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold">{getTranslation('labels.runningHub')}</span>
                    {isLoadingApp && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                </div>
                {!hasApiKey && (
                    <span className="text-[9px] text-yellow-400">{getTranslation('labels.apiKeyMissing')}</span>
                )}
            </div>

            {/* Webapp ID 輸入 */}
            <div className="p-2 border-b border-white/10">
                <div className="flex gap-1 mb-2">
                    <input
                        type="text"
                        value={webappId}
                        onChange={e => handleWebappIdChange(e.target.value)}
                        placeholder={getTranslation('labels.inputPlaceholder')}
                        className="flex-1 px-2 py-1.5 text-[10px] bg-white/5 border border-white/10 rounded focus:outline-none focus:border-purple-500/50"
                    />
                    <button
                        onClick={fetchWebappInfo}
                        disabled={!webappId.trim() || isLoadingApp}
                        className="p-1.5 bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3 h-3 ${isLoadingApp ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* 應用資訊與保存按鈕 */}
                <div className="flex items-center justify-between">
                    {appName ? (
                        <p className="text-[10px] text-purple-400 truncate flex-1 mr-2">{appName}</p>
                    ) : (
                        <span className="text-[10px] text-white/20 flex-1">...</span>
                    )}

                    <button
                        onClick={() => {
                            if (!webappId.trim()) return;
                            try {
                                const stored = localStorage.getItem('rh_saved_apps');
                                const apps = stored ? JSON.parse(stored) : [];
                                // 檢查重複
                                if (apps.some((app: any) => app.id === webappId)) {
                                    alert(getTranslation('labels.appExists'));
                                    return;
                                }
                                const newApp = {
                                    id: webappId,
                                    name: appName || `App ${webappId.slice(0, 6)}`,
                                    timestamp: Date.now()
                                };
                                const newApps = [...apps, newApp];
                                localStorage.setItem('rh_saved_apps', JSON.stringify(newApps));
                                // 觸發更新事件
                                window.dispatchEvent(new Event('rh_apps_updated'));
                                alert(getTranslation('labels.addedToLibrary'));
                            } catch (e) {
                                console.error(e);
                            }
                        }}
                        disabled={!webappId.trim()}
                        className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 rounded transition-all text-[9px] text-white/60 hover:text-purple-300"
                    >
                        <BookmarkPlus className="w-3 h-3" />
                        <span>{getTranslation('labels.addToLibrary')}</span>
                    </button>
                </div>
            </div>

            {/* 主內容區 */}
            <div className="flex-1 overflow-auto p-2 space-y-2">
                {/* 動態參數輸入欄位 */}
                {inputFields.length > 0 && (
                    <div className="space-y-2">
                        {inputFields.map(node => {
                            const key = `${node.nodeId}-${node.fieldName}`;
                            return (
                                <div key={key}>
                                    <label className="text-[9px] text-white/50 block mb-0.5">
                                        {node.nodeName || node.fieldName}
                                        {node.description && <span className="text-white/30 ml-1">({node.description})</span>}
                                    </label>
                                    {node.fieldType === 'STRING' ? (
                                        <textarea
                                            value={paramValues[key] || ''}
                                            onChange={e => updateParamValue(node.nodeId, node.fieldName, e.target.value)}
                                            placeholder={node.fieldValue || '輸入內容...'}
                                            className="w-full px-2 py-1.5 text-[10px] bg-white/5 border border-white/10 rounded resize-none h-12 focus:outline-none focus:border-purple-500/50"
                                        />
                                    ) : node.fieldType === 'LIST' ? (
                                        <select
                                            value={paramValues[key] || node.fieldValue}
                                            onChange={e => updateParamValue(node.nodeId, node.fieldName, e.target.value)}
                                            className="w-full px-2 py-1.5 text-[10px] bg-white/5 border border-white/10 rounded focus:outline-none focus:border-purple-500/50"
                                        >
                                            {(node.fieldData?.split(',') || []).map(opt => (
                                                <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={node.fieldType === 'INT' || node.fieldType === 'FLOAT' ? 'number' : 'text'}
                                            value={paramValues[key] || ''}
                                            onChange={e => updateParamValue(node.nodeId, node.fieldName, e.target.value)}
                                            placeholder={node.fieldValue || ''}
                                            className="w-full px-2 py-1.5 text-[10px] bg-white/5 border border-white/10 rounded focus:outline-none focus:border-purple-500/50"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 圖片選擇 / 預覽 */}
                {!result ? (
                    <div className="space-y-2">
                        {/* 圖片預覽 */}
                        {previewUrl ? (
                            <div className="relative aspect-video bg-black/30 rounded-lg overflow-hidden">
                                <img src={previewUrl} alt={getTranslation('labels.preview')} className="w-full h-full object-contain" />
                                <button
                                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                    className="absolute top-1 right-1 p-1 bg-black/50 rounded text-white/70 hover:text-white text-[10px]"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : nodeInfoList.some(n => n.fieldType === 'IMAGE') && (
                            <label className="block aspect-video border-2 border-dashed border-white/20 rounded-lg hover:border-purple-500/50 cursor-pointer transition-all">
                                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                                <div className="flex flex-col items-center justify-center h-full gap-1">
                                    <Upload className="w-5 h-5 text-white/40" />
                                    <span className="text-[10px] text-white/40">{getTranslation('labels.uploadImage')}</span>
                                </div>
                            </label>
                        )}

                        {/* 從畫布獲取 */}
                        {getCanvasImage && nodeInfoList.some(n => n.fieldType === 'IMAGE') && (
                            <button
                                onClick={handleGetFromCanvas}
                                className="w-full py-1.5 text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all"
                            >
                                {getTranslation('labels.getFromCanvas')}
                            </button>
                        )}
                    </div>
                ) : (
                    /* 結果顯示 */
                    <div className="space-y-2">
                        {result.map((output, idx) => {
                            const displayUrl = decodedResults.get(idx) || output.fileUrl;
                            return (
                                <div key={idx} className="relative aspect-video bg-black/30 rounded-lg overflow-hidden group">
                                    <img src={displayUrl} alt={`結果 ${idx + 1}`} className="w-full h-full object-contain" />
                                    <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!decodedResults.has(idx) && (
                                            <button
                                                onClick={() => handleDecode(output.fileUrl, idx)}
                                                className="p-1 bg-purple-500/70 rounded text-white/90 hover:bg-purple-500"
                                                title={getTranslation('labels.decode')}
                                            >
                                                <Wand2 size={12} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDownload(displayUrl)}
                                            className="p-1 bg-black/50 rounded text-white/90 hover:bg-black/70"
                                            title={getTranslation('labels.download')}
                                        >
                                            <Download size={12} />
                                        </button>
                                    </div>
                                    {decodedResults.has(idx) && (
                                        <span className="absolute top-1 left-1 px-1 py-0.5 bg-emerald-500/80 text-[8px] rounded">{getTranslation('labels.decoded')}</span>
                                    )}
                                </div>
                            );
                        })}
                        {savedPaths.length > 0 ? (
                            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded">
                                <p className="text-[9px] text-center text-emerald-400 mb-1">{getTranslation('labels.savedFiles', { count: savedPaths.length })}</p>
                                <p className="text-[8px] text-white/40 truncate" title={savedPaths[0]}>
                                    {savedPaths[0]}
                                </p>
                            </div>
                        ) : (
                            <p className="text-[9px] text-center text-yellow-400">{getTranslation('labels.saving')}</p>
                        )}

                        {/* 批量解碼按鈕 */}
                        {result.length > 0 && (
                            <button
                                onClick={() => {
                                    result.forEach((output, idx) => {
                                        if (!decodedResults.has(idx)) {
                                            handleDecode(output.fileUrl, idx);
                                        }
                                    });
                                }}
                                className="w-full py-1.5 text-[10px] bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 rounded flex items-center justify-center gap-1"
                            >
                                <Wand2 size={12} />
                                <span>{getTranslation('labels.decode')}</span>
                            </button>
                        )}

                        <button
                            onClick={() => { setResult(null); setDecodedResults(new Map()); setSavedPaths([]); }}
                            className="w-full py-1.5 text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded"
                        >
                            {getTranslation('labels.restart')}
                        </button>
                    </div>
                )}
            </div>

            {/* 錯誤訊息 */}
            {error && (
                <div className="px-2 py-1 bg-red-500/20 border-t border-red-500/30">
                    <p className="text-[10px] text-red-400 truncate">{error}</p>
                </div>
            )}

            {/* 進度條 */}
            {isRunning && (
                <div className="px-2 py-1">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 執行按鈕 */}
            <div className="p-2 border-t border-white/10">
                <button
                    onClick={handleRun}
                    disabled={isRunning || !webappId.trim() || !hasApiKey || nodeInfoList.length === 0}
                    className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                    {isRunning ? (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {step === 'uploading' ? getTranslation('labels.uploading') : getTranslation('labels.running')}
                        </>
                    ) : step === 'success' ? (
                        <>
                            <CheckCircle className="w-3 h-3" />
                            {getTranslation('labels.completed')}
                        </>
                    ) : step === 'error' ? (
                        <>
                            <XCircle className="w-3 h-3" />
                            {getTranslation('labels.retry')}
                        </>
                    ) : (
                        <>
                            <Play className="w-3 h-3" />
                            {getTranslation('labels.startApp')}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
