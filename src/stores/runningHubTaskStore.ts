// RunningHub 任務狀態管理 (使用 Zustand)
// 從 RH-AI-87boss/stores/taskStore.ts 遷移

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BackgroundTask, NodeInfo, TaskOutput, API_CODE } from '../services/runningHub/types';
import { submitTask, queryTaskOutputs, cancelTask as cancelTaskApi } from '../services/runningHub/api';

// 存儲鍵
const STORAGE_KEY = 'rh_task_history';

// 獲取動態並發限制
const getMaxConcurrent = (): number => {
    const val = localStorage.getItem('rh_max_concurrent');
    const num = val ? parseInt(val, 10) : 3;
    return isNaN(num) ? 3 : Math.min(10, Math.max(1, num));
};

// 從 URL 提取文件擴展名
const getFileExtension = (url: string): string => {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? `.${match[1]}` : '.png';
};

// 檢測是否為 Electron 環境
const isElectronEnvironment = (): boolean => {
    return typeof window !== 'undefined' && 'electronAPI' in window;
};

interface TaskState {
    tasks: BackgroundTask[];
    runningCount: number;

    // Actions
    addTask: (appId: string, appName: string, apiKey: string, webappId: string, params: NodeInfo[]) => void;
    addBatchTasks: (appId: string, appName: string, apiKey: string, webappId: string, paramsList: NodeInfo[][]) => void;
    removeTask: (taskId: string) => void;
    cancelTask: (taskId: string) => void;
    removeTaskResult: (taskId: string, resultIndex: number) => void;
    clearHistory: () => void;

    // Internal
    updateTask: (taskId: string, updates: Partial<BackgroundTask>) => void;
    processNextInQueue: () => void;
    startTask: (task: BackgroundTask) => void;
}

export const useTaskStore = create<TaskState>()(
    persist(
        (set, get) => ({
            tasks: [],
            runningCount: 0,

            updateTask: (taskId, updates) => {
                set((state) => ({
                    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
                }));
            },

            // 處理隊列中的下一個任務
            processNextInQueue: () => {
                const { tasks, runningCount } = get();
                const queuedTask = tasks.find(t => t.status === 'QUEUED');

                if (runningCount < getMaxConcurrent() && queuedTask) {
                    console.log(`[Queue] Starting queued task: ${queuedTask.id}`);
                    get().startTask(queuedTask);
                }
            },

            // 內部方法：實際開始執行任務
            startTask: async (task: BackgroundTask) => {
                const { params } = task;
                const apiKey = task.apiKey;
                const webappId = task.webappId;
                const taskId = task.id;

                if (!apiKey || !webappId || !params) {
                    get().updateTask(taskId, {
                        status: 'FAILED',
                        error: '缺少必要參數',
                        endTime: Date.now()
                    });
                    return;
                }

                set((state) => ({
                    runningCount: state.runningCount + 1,
                }));

                get().updateTask(taskId, { status: 'RUNNING', progress: 10, startTime: Date.now() });

                const onTaskComplete = () => {
                    set(s => ({ runningCount: s.runningCount - 1 }));
                    setTimeout(() => get().processNextInQueue(), 500);
                };

                try {
                    const submission = await submitTask(apiKey, webappId, params);
                    const remoteTaskId = submission.taskId;

                    console.log('[Task] Submitted, remoteTaskId:', remoteTaskId);
                    get().updateTask(taskId, { remoteTaskId, progress: 30 });

                    let pollCount = 0;
                    const pollInterval = setInterval(async () => {
                        try {
                            pollCount++;
                            const result = await queryTaskOutputs(apiKey, remoteTaskId);
                            console.log(`[Task] Poll #${pollCount}, code:`, result.code);

                            switch (result.code) {
                                case API_CODE.SUCCESS:
                                    clearInterval(pollInterval);

                                    // 標準化結果數據
                                    let normalizedResults: TaskOutput[] = [];
                                    const rawData = result.data;

                                    if (Array.isArray(rawData)) {
                                        normalizedResults = rawData.map((item: any) => {
                                            if (item && typeof item.fileUrl === 'string') {
                                                return { fileUrl: item.fileUrl, fileType: item.fileType };
                                            }
                                            if (typeof item === 'string') {
                                                return { fileUrl: item };
                                            }
                                            if (item && typeof item.url === 'string') {
                                                return { fileUrl: item.url, fileType: item.fileType || item.type };
                                            }
                                            return null;
                                        }).filter(Boolean) as TaskOutput[];
                                    } else if (rawData && typeof rawData === 'object') {
                                        if (Array.isArray(rawData.outputs)) {
                                            normalizedResults = rawData.outputs.map((item: any) => {
                                                if (typeof item === 'string') return { fileUrl: item };
                                                if (item && typeof item.fileUrl === 'string') return item;
                                                if (item && typeof item.url === 'string') return { fileUrl: item.url };
                                                return null;
                                            }).filter(Boolean);
                                        } else if (typeof rawData.fileUrl === 'string') {
                                            normalizedResults = [{ fileUrl: rawData.fileUrl }];
                                        }
                                    }

                                    // 自動保存到預設目錄
                                    const autoSaveEnabled = localStorage.getItem('rh_auto_save_enabled') !== 'false';
                                    if (autoSaveEnabled && isElectronEnvironment() && normalizedResults.length > 0) {
                                        try {
                                            const electronAPI = (window as any).electronAPI;
                                            let defaultPath = localStorage.getItem('rh_default_download_path') || '';

                                            if (!defaultPath && electronAPI?.getDefaultOutputPath) {
                                                defaultPath = await electronAPI.getDefaultOutputPath();
                                            }

                                            if (defaultPath && electronAPI?.autoSaveFiles) {
                                                const filesToSave = normalizedResults.map((r, idx) => ({
                                                    url: r.fileUrl,
                                                    name: `${task.appName || 'output'}_${taskId.slice(0, 8)}_${idx + 1}${getFileExtension(r.fileUrl)}`
                                                }));
                                                electronAPI.autoSaveFiles(filesToSave, defaultPath);
                                            }
                                        } catch (e) {
                                            console.error('[Task] Auto-save error:', e);
                                        }
                                    }

                                    // 解析消耗字段
                                    let totalConsumeCoins = 0;
                                    if (Array.isArray(rawData)) {
                                        rawData.forEach((item: any) => {
                                            if (item?.consumeCoins) {
                                                totalConsumeCoins += parseFloat(item.consumeCoins) || 0;
                                            }
                                        });
                                    }

                                    get().updateTask(taskId, {
                                        status: 'SUCCESS',
                                        progress: 100,
                                        result: normalizedResults,
                                        endTime: Date.now(),
                                        costCoins: totalConsumeCoins > 0 ? String(totalConsumeCoins) : undefined,
                                    });
                                    onTaskComplete();
                                    break;

                                case API_CODE.RUNNING:
                                    get().updateTask(taskId, { progress: Math.min(90, 30 + pollCount * 5) });
                                    break;

                                case API_CODE.QUEUED:
                                    get().updateTask(taskId, { progress: 20 });
                                    break;

                                case API_CODE.FAILED:
                                    clearInterval(pollInterval);
                                    let errorMsg = typeof result.msg === 'string' ? result.msg : '任務執行失敗';
                                    if (result.data?.failedReason) {
                                        const reason = result.data.failedReason;
                                        const exMsg = reason.exception_message || reason.exception_type;
                                        if (typeof exMsg === 'string') {
                                            errorMsg = exMsg;
                                        }
                                        if (reason.node_name && typeof reason.node_name === 'string') {
                                            errorMsg = `[${reason.node_name}] ${errorMsg}`;
                                        }
                                    }
                                    get().updateTask(taskId, {
                                        status: 'FAILED',
                                        error: String(errorMsg),
                                        endTime: Date.now()
                                    });
                                    onTaskComplete();
                                    break;

                                case API_CODE.QUEUE_MAXED:
                                    get().updateTask(taskId, { progress: 10, status: 'QUEUED' });
                                    break;
                            }
                        } catch (e) {
                            console.warn('[Task] Poll error:', e);
                        }
                    }, 3000);

                    // 60分鐘超時
                    setTimeout(() => {
                        clearInterval(pollInterval);
                        const current = get().tasks.find(t => t.id === taskId);
                        if (current && current.status === 'RUNNING') {
                            get().updateTask(taskId, {
                                status: 'FAILED',
                                error: '任務超時（60分鐘）',
                                endTime: Date.now()
                            });
                            onTaskComplete();
                        }
                    }, 3600000);

                } catch (e: any) {
                    console.error('[Task] Submission Failed:', e);
                    get().updateTask(taskId, {
                        status: 'FAILED',
                        error: e.message || '提交任務失敗',
                        endTime: Date.now()
                    });
                    onTaskComplete();
                }
            },

            addTask: async (appId, appName, apiKey, webappId, params) => {
                const { runningCount, tasks } = get();
                const taskId = crypto.randomUUID();
                const queuedCount = tasks.filter(t => t.status === 'QUEUED').length;

                const newTask: BackgroundTask = {
                    id: taskId,
                    appId,
                    appName,
                    status: runningCount >= getMaxConcurrent() ? 'QUEUED' : 'PENDING',
                    progress: 0,
                    startTime: Date.now(),
                    params,
                    apiKey,
                    webappId,
                    queuePosition: runningCount >= getMaxConcurrent() ? queuedCount + 1 : undefined,
                };

                set((state) => ({
                    tasks: [newTask, ...state.tasks],
                }));

                if (runningCount < getMaxConcurrent()) {
                    get().startTask(newTask);
                } else {
                    console.log(`[Queue] Task queued at position ${queuedCount + 1}`);
                }
            },

            addBatchTasks: (appId, appName, apiKey, webappId, paramsList) => {
                console.log(`[Batch] Adding ${paramsList.length} tasks`);

                paramsList.forEach((params, index) => {
                    setTimeout(() => {
                        get().addTask(appId, appName, apiKey, webappId, params);
                    }, index * 100);
                });
            },

            removeTask: (taskId) => {
                const task = get().tasks.find(t => t.id === taskId);
                set((state) => ({
                    tasks: state.tasks.filter((t) => t.id !== taskId),
                }));
                if (task?.status === 'RUNNING') {
                    set(s => ({ runningCount: s.runningCount - 1 }));
                    get().processNextInQueue();
                }
            },

            cancelTask: async (taskId) => {
                const task = get().tasks.find(t => t.id === taskId);
                if (!task) return;

                if (task.remoteTaskId && task.apiKey) {
                    try {
                        await cancelTaskApi(task.apiKey, task.remoteTaskId);
                        console.log('[Task] Cancelled:', task.remoteTaskId);
                    } catch (e) {
                        console.warn('[Task] Cancel API failed:', e);
                    }
                }

                get().updateTask(taskId, {
                    status: 'FAILED',
                    error: '已取消',
                    endTime: Date.now()
                });

                if (task.status === 'RUNNING' || task.status === 'QUEUED') {
                    if (task.status === 'RUNNING') {
                        set(s => ({ runningCount: s.runningCount - 1 }));
                    }
                    get().processNextInQueue();
                }
            },

            removeTaskResult: (taskId, resultIndex) => {
                set((state) => ({
                    tasks: state.tasks.map((t) => {
                        if (t.id === taskId && t.result) {
                            const newResult = [...t.result];
                            newResult.splice(resultIndex, 1);
                            if (newResult.length === 0) {
                                return null;
                            }
                            return { ...t, result: newResult };
                        }
                        return t;
                    }).filter(Boolean) as BackgroundTask[],
                }));
            },

            clearHistory: () => {
                set((state) => ({
                    tasks: state.tasks.filter((t) => t.status === 'RUNNING' || t.status === 'PENDING' || t.status === 'QUEUED'),
                }));
            },
        }),
        {
            name: STORAGE_KEY,
            partialize: (state) => ({
                tasks: state.tasks.filter(t => t.status === 'SUCCESS' || t.status === 'FAILED'),
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.runningCount = 0;
                    console.log('[TaskStore] Restored', state.tasks.length, 'completed tasks from storage');
                }
            },
        }
    )
);
