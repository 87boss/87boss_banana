import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Star, Zap, History, ChevronLeft, X, Grid, Plus, Loader2, Maximize2, Download, Trash2, Maximize } from 'lucide-react';
import { appService, AppPoolItem } from '../../services/runningHub/appService';
import { getWebappDetail, getAccountInfo } from '../../services/runningHub/api';
import { useTaskStore } from '../../stores/runningHubTaskStore';
import type { NodeInfo, InstalledApp } from '../../services/runningHub/types';
import type { WebappDetail } from '../../services/runningHub/api';
import { ApiKeyInput } from './ApiKeyInput';
import { StepEditor } from './StepEditor';
import { StepResult } from './StepResult';
import { TaskFloater } from './TaskFloater';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 工具函數
function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// 應用步驟枚舉
const STEP = {
    APP_LIST: 0,   // 應用列表
    EDITOR: 1,     // 編輯器
} as const;

type Step = typeof STEP[keyof typeof STEP];

// Props 接口
interface RunningHubViewProps {
    setView?: (view: 'editor' | 'local-library' | 'interior-design' | 'runninghub') => void;
    localCreativeIdeasCount?: number;
}

export default function RunningHubView({ setView, localCreativeIdeasCount = 0 }: RunningHubViewProps) {
    // API 狀態
    const [apiKey, setApiKey] = useState<string>('');
    const [isApiKeyValid, setIsApiKeyValid] = useState<boolean>(false);
    const [rhCoins, setRhCoins] = useState<string | null>(null);

    // 應用狀態
    const [currentStep, setCurrentStep] = useState<Step>(STEP.APP_LIST);
    const [appPool, setAppPool] = useState<AppPoolItem[]>([]);
    const [localFavorites, setLocalFavorites] = useState<AppPoolItem[]>([]);
    const [selectedApp, setSelectedApp] = useState<(AppPoolItem & { webappDetail?: WebappDetail }) | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(true);

    // 側邊欄狀態
    const [sidebarTab, setSidebarTab] = useState<'favorites' | 'recommended'>('favorites');

    // 添加應用對話框狀態
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAppId, setNewAppId] = useState('');
    const [isAddingApp, setIsAddingApp] = useState(false);

    // 圖片預覽狀態
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // 任務狀態
    const { tasks, runningCount, clearHistory } = useTaskStore();
    const completedTasks = tasks.filter(t => t.status === 'SUCCESS' || t.status === 'FAILED');

    // 初始化
    useEffect(() => {
        const init = async () => {
            await appService.init();
            const savedApiKey = appService.getApiKey();
            if (savedApiKey) {
                setApiKey(savedApiKey);
                setIsApiKeyValid(true);
                fetchRhCoins(savedApiKey);
            }
            loadApps();
        };
        init();
    }, []);

    // 載入應用
    const loadApps = useCallback(() => {
        setAppPool(appService.getAppPool());
        setLocalFavorites(appService.getLocalFavorites());
    }, []);

    // 獲取 RH 幣餘額
    const fetchRhCoins = async (key: string) => {
        try {
            const info = await getAccountInfo(key);
            setRhCoins(info.remainCoins);
        } catch (e) {
            console.warn('Failed to fetch RH coins:', e);
        }
    };

    // 從 URL 或純 ID 提取 Webapp ID
    const extractIdFromUrl = (input: string): string => {
        if (!input) return '';
        const trimmed = input.trim();

        // 嘗試匹配 URL 格式：runninghub.cn/task/xxxxx 或 webapp/xxxxx
        const urlMatch = trimmed.match(/(?:task|webapp)\/([a-zA-Z0-9]+)/);
        if (urlMatch) return urlMatch[1];

        // 嘗試匹配純 ID (字母數字)
        if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;

        return '';
    };

    // 手動添加應用 (使用 API Key)
    const handleAddApp = async () => {
        const extractedId = extractIdFromUrl(newAppId);
        if (!extractedId) {
            setError('請輸入有效的 Webapp ID 或 URL');
            return;
        }
        if (!apiKey) {
            setError('請先配置 API Key');
            return;
        }

        // 檢查是否已存在
        const existing = appService.getAppById(extractedId);
        if (existing) {
            setError('應用已存在於應用池中');
            return;
        }

        setIsAddingApp(true);
        setError(null);
        try {
            const detail = await getWebappDetail(apiKey, extractedId);
            const newApp: AppPoolItem = {
                id: extractedId,
                name: detail.webappName || `應用 ${extractedId.slice(-6)}`,
                intro: '',
                thumbnailUrl: detail.covers?.[0]?.thumbnailUri || detail.covers?.[0]?.url || '',
                owner: { name: '', avatar: '' },
                useCount: parseInt(detail.statisticsInfo?.useCount || '0', 10),
                addedAt: Date.now(),
                isLocalFavorite: false
            };

            const pool = appService.getAppPool();
            pool.unshift(newApp);
            appService.saveAppPool(pool);
            loadApps();

            setShowAddModal(false);
            setNewAppId('');
        } catch (err: any) {
            setError('獲取應用詳情失敗: ' + (err.message || '請檢查 Webapp ID 是否正確'));
        } finally {
            setIsAddingApp(false);
        }
    };

    // API Key 驗證成功
    const handleApiKeyValidated = useCallback((key: string) => {
        setApiKey(key);
        setIsApiKeyValid(true);
        appService.setApiKey(key);
        fetchRhCoins(key);
    }, []);

    // 選擇應用
    const handleSelectApp = useCallback(async (app: AppPoolItem) => {
        setIsLoading(true);
        setError(null);

        try {
            const webappId = (app as any).webappId || app.id;
            const detail = await getWebappDetail(apiKey, webappId);
            setSelectedApp({
                ...app,
                webappDetail: detail,
                webappId: webappId
            } as any);
            setCurrentStep(STEP.EDITOR);
        } catch (err: any) {
            setError(err.message || '無法載入應用詳情');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey]);

    // 返回應用列表
    const handleBack = useCallback(() => {
        setCurrentStep(STEP.APP_LIST);
        setSelectedApp(null);
        setError(null);
    }, []);

    // 切換本地收藏
    const handleToggleFavorite = useCallback((appId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        appService.toggleLocalFavorite(appId);
        loadApps();
    }, [loadApps]);

    // 未驗證 API Key
    if (!isApiKeyValid) {
        return (
            <div className="flex-1 flex flex-col bg-[#0d1117] text-white overflow-hidden">
                {/* 頂部導航 - 包含分頁列 */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">RunningHub AI</h1>
                            <p className="text-xs text-slate-400">請輸入 API Key</p>
                        </div>
                    </div>

                    {/* 分頁導航列 */}
                    {setView && (
                        <div className="flex items-center gap-1 liquid-tabs">
                            <button
                                onClick={() => setView('editor')}
                                className="liquid-tab flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                桌面
                            </button>
                            <button
                                onClick={() => setView('local-library')}
                                className="liquid-tab flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                本地創意
                                {localCreativeIdeasCount > 0 && (
                                    <span className="px-1 py-0.5 text-[8px] rounded bg-white/20 font-medium">
                                        {localCreativeIdeasCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setView('interior-design')}
                                className="liquid-tab flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                室內設計
                                <span className="px-1 py-0.5 text-[8px] rounded bg-yellow-500/20 text-yellow-300 font-medium border border-yellow-500/30">
                                    BETA
                                </span>
                            </button>
                            <button
                                className="liquid-tab active flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                RunningHub
                            </button>
                        </div>
                    )}
                </div>

                {/* API Key 輸入 */}
                <div className="flex-1 flex items-center justify-center p-8">
                    <ApiKeyInput onValidated={handleApiKeyValidated} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#0d1117] text-white overflow-hidden">
            {/* 頂部導航 - 包含分頁列 */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">RunningHub AI</h1>
                        <p className="text-xs text-slate-400">
                            {selectedApp ? selectedApp.name : '選擇應用開始創作'}
                        </p>
                    </div>
                </div>

                {/* 分頁導航列 - 在標題右側 */}
                {setView && (
                    <div className="flex items-center gap-1 liquid-tabs">
                        <button
                            onClick={() => setView('editor')}
                            className="liquid-tab flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            桌面
                        </button>
                        <button
                            onClick={() => setView('local-library')}
                            className="liquid-tab flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            本地創意
                            {localCreativeIdeasCount > 0 && (
                                <span className="px-1 py-0.5 text-[8px] rounded bg-white/20 font-medium">
                                    {localCreativeIdeasCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setView('interior-design')}
                            className="liquid-tab flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            室內設計
                            <span className="px-1 py-0.5 text-[8px] rounded bg-yellow-500/20 text-yellow-300 font-medium border border-yellow-500/30">
                                BETA
                            </span>
                        </button>
                        <button
                            className="liquid-tab active flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            RunningHub
                        </button>
                    </div>
                )}

                {/* 狀態指示器 */}
                <div className="flex items-center gap-4">
                    {/* API 狀態 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs text-emerald-400">API 已連接</span>
                    </div>

                    {/* RH 幣餘額 */}
                    {rhCoins && (
                        <div className="text-sm text-amber-400">
                            ⚡ {rhCoins} 幣
                        </div>
                    )}

                    {/* 運行中任務數 */}
                    {runningCount > 0 && (
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            {runningCount} 任務執行中
                        </div>
                    )}

                    {/* 設定按鈕 */}
                    <button
                        onClick={() => {
                            setIsApiKeyValid(false);
                            setApiKey('');
                        }}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="設定"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* 主內容區 - 三欄式佈局 */}
            <div className="flex-1 flex overflow-hidden">
                {/* 左側欄 - 收藏/推薦 */}
                <div className="w-48 flex-shrink-0 border-r border-white/10 bg-white/[0.02] flex flex-col">
                    {/* 標籤切換 */}
                    <div className="flex border-b border-white/10">
                        <button
                            onClick={() => setSidebarTab('favorites')}
                            className={cn(
                                "flex-1 px-3 py-3 text-sm font-medium transition-colors",
                                sidebarTab === 'favorites'
                                    ? "text-white border-b-2 border-emerald-400"
                                    : "text-white/50 hover:text-white/80"
                            )}
                        >
                            <Star className="w-4 h-4 inline mr-1" />
                            我的收藏
                        </button>
                        <button
                            onClick={() => setSidebarTab('recommended')}
                            className={cn(
                                "flex-1 px-3 py-3 text-sm font-medium transition-colors",
                                sidebarTab === 'recommended'
                                    ? "text-white border-b-2 border-emerald-400"
                                    : "text-white/50 hover:text-white/80"
                            )}
                        >
                            <Zap className="w-4 h-4 inline mr-1" />
                            推薦
                        </button>
                    </div>

                    {/* 收藏列表 */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {sidebarTab === 'favorites' && localFavorites.length === 0 && (
                            <div className="text-center py-8">
                                <Star className="w-8 h-8 mx-auto text-white/20 mb-2" />
                                <p className="text-xs text-white/40">點擊應用卡片上的</p>
                                <p className="text-xs text-white/40"><strong>★按鈕</strong>收藏到這裡</p>
                            </div>
                        )}
                        {sidebarTab === 'favorites' && localFavorites.map(app => (
                            <button
                                key={app.id}
                                onClick={() => handleSelectApp(app)}
                                className={cn(
                                    "w-full text-left p-2 rounded-lg transition-colors",
                                    selectedApp?.id === app.id
                                        ? "bg-emerald-500/20 border border-emerald-500/30"
                                        : "hover:bg-white/5"
                                )}
                            >
                                <div className="text-sm font-medium truncate">{app.name}</div>
                                <div className="text-xs text-white/40 truncate">{app.useCount} 次使用</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 中間主區域 */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {currentStep === STEP.APP_LIST ? (
                        <>
                            {/* 應用列表頭部 */}
                            <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-white/60">
                                        <Grid className="w-4 h-4 inline mr-1" />
                                        應用池
                                    </span>
                                    <span className="text-xs text-white/40">{appPool.length}個</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowAddModal(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors"
                                    >
                                        <Plus className="w-3 h-3" />
                                        添加應用
                                    </button>
                                </div>
                            </div>

                            {/* 應用卡片列表 */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {appPool.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <Grid className="w-16 h-16 text-white/10 mb-4" />
                                        <h3 className="text-lg font-medium text-white/60 mb-2">尚無應用</h3>
                                        <p className="text-sm text-white/40 mb-4">輸入 Webapp ID 或 URL 添加應用</p>
                                        <button
                                            onClick={() => setShowAddModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            添加應用
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {appPool.map(app => (
                                            <div
                                                key={app.id}
                                                onClick={() => handleSelectApp(app)}
                                                className="group relative bg-white/5 rounded-xl overflow-hidden cursor-pointer hover:bg-white/10 transition-all hover:scale-[1.02]"
                                            >
                                                {/* 封面圖 */}
                                                <div className="aspect-square bg-gradient-to-br from-slate-700 to-slate-800 relative">
                                                    {app.thumbnailUrl ? (
                                                        <img
                                                            src={app.thumbnailUrl}
                                                            alt={app.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Zap className="w-12 h-12 text-white/20" />
                                                        </div>
                                                    )}

                                                    {/* 收藏按鈕 */}
                                                    <button
                                                        onClick={(e) => handleToggleFavorite(app.id, e)}
                                                        className={cn(
                                                            "absolute top-2 right-2 p-1.5 rounded-lg transition-all",
                                                            app.isLocalFavorite
                                                                ? "bg-amber-500 text-white"
                                                                : "bg-black/50 text-white/60 opacity-0 group-hover:opacity-100"
                                                        )}
                                                    >
                                                        <Star className="w-4 h-4" fill={app.isLocalFavorite ? "currentColor" : "none"} />
                                                    </button>
                                                </div>

                                                {/* 應用信息 */}
                                                <div className="p-3">
                                                    <h3 className="text-sm font-medium truncate">{app.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                                                        <span>{app.useCount} 次使用</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* 編輯器視圖 */
                        <StepEditor
                            apiKey={apiKey}
                            app={selectedApp as any}
                            nodeInfoList={selectedApp?.webappDetail?.nodeInfoList || []}
                            covers={selectedApp?.webappDetail?.covers?.map(c => c.url) || []}
                            onBack={handleBack}
                        />
                    )}
                </div>

                {/* 右側欄 - 歷史記錄 */}
                <div className={cn(
                    "w-72 flex-shrink-0 border-l border-white/10 bg-white/[0.02] flex flex-col transition-all",
                    !showHistoryPanel && "w-0 overflow-hidden"
                )}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-white/60" />
                            <span className="text-sm font-medium">歷史記錄</span>
                            {completedTasks.length > 0 && (
                                <span className="text-xs text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
                                    {completedTasks.length}
                                </span>
                            )}
                        </div>
                        {completedTasks.length > 0 && (
                            <button
                                onClick={clearHistory}
                                className="text-xs text-white/40 hover:text-white/60"
                            >
                                清空
                            </button>
                        )}
                    </div>

                    {/* 歷史記錄列表 - 大圖模式 */}
                    {completedTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <History className="w-8 h-8 text-white/20" />
                            </div>
                            <p className="text-sm text-white/40">準備就緒</p>
                            <p className="text-xs text-white/30 mt-1">配置參數並點擊"運行"，結果將顯示在這裡</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {completedTasks.map(task => (
                                <div key={task.id} className="space-y-3">
                                    {/* 任務頭部信息 */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                task.status === 'SUCCESS' ? "bg-emerald-400" : "bg-red-400"
                                            )} />
                                            <span className="text-sm font-medium truncate max-w-[150px]" title={task.appName}>
                                                {task.appName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    useTaskStore.getState().removeTask(task.id);
                                                }}
                                                className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
                                                title="刪除"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 任務結果展示 - 大圖與操作 */}
                                    {task.status === 'SUCCESS' && task.result && task.result.length > 0 ? (
                                        <div className="space-y-3">
                                            {task.result.map((output, idx) => (
                                                <div key={idx} className="group relative rounded-xl overflow-hidden bg-black/40 border border-white/5 shadow-sm">
                                                    {/* 圖片 */}
                                                    <div className="aspect-[3/4] w-full relative">
                                                        <img
                                                            src={output.fileUrl}
                                                            alt={`Result ${idx + 1}`}
                                                            className="w-full h-full object-contain bg-[#1a1d24]"
                                                        />

                                                        {/* 懸浮遮罩與按鈕 */}
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => setPreviewImage(output.fileUrl)}
                                                                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all transform hover:scale-110"
                                                                title="放大查看"
                                                            >
                                                                <Maximize className="w-5 h-5" />
                                                            </button>
                                                            <a
                                                                href={output.fileUrl}
                                                                download
                                                                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all transform hover:scale-110"
                                                                title="下載"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Download className="w-5 h-5" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : task.status === 'FAILED' && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                                            {task.error || '任務執行失敗'}
                                        </div>
                                    )}

                                    <div className="h-px bg-white/5 w-full" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>


            {/* 添加應用對話框 */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-[#1a1d24] rounded-2xl p-6 w-96 border border-white/10">
                            <h3 className="text-lg font-semibold mb-4">添加 RunningHub 應用</h3>
                            <p className="text-sm text-white/60 mb-4">
                                輸入 RunningHub 應用的 Webapp ID 或完整 URL
                            </p>
                            <input
                                type="text"
                                value={newAppId}
                                onChange={(e) => setNewAppId(e.target.value)}
                                placeholder="例如：68b72f03fae746418b11d59b89b52a36"
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 mb-4"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddApp()}
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setNewAppId('');
                                        setError(null);
                                    }}
                                    className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleAddApp}
                                    disabled={isAddingApp || !newAppId.trim()}
                                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isAddingApp ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                    添加
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 錯誤提示 */}
            {
                error && (
                    <div className="absolute bottom-4 right-4 max-w-md bg-red-500/20 border border-red-500/30 rounded-lg p-4 z-50">
                        <div className="flex items-start gap-3">
                            <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-red-300">{error}</p>
                                <button
                                    onClick={() => setError(null)}
                                    className="mt-2 text-xs text-red-400 hover:text-red-300"
                                >
                                    關閉
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 圖片預覽彈窗 */}
            {
                previewImage && (
                    <div
                        className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-8 animated fadeIn"
                        onClick={() => setPreviewImage(null)}
                    >
                        <button
                            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            onClick={() => setPreviewImage(null)}
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )
            }

            {/* 任務浮窗 */}
            {tasks.length > 0 && <TaskFloater />}
        </div >
    );
}
