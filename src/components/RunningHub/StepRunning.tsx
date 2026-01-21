import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, ChevronLeft, Clock } from 'lucide-react';
import { submitTask, queryTaskOutputs } from '../../services/runningHub/api';
import type { AppPoolItem, NodeInfo, TaskOutput } from '../../services/runningHub/types';

interface StepRunningProps {
    apiKey: string;
    app: AppPoolItem;
    nodeInfoList: NodeInfo[];
    onComplete: (result: TaskOutput[]) => void;
    onFailed: (error: string) => void;
    onBack: () => void;
}

type TaskStatus = 'SUBMITTING' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';

const STATUS_CONFIG = {
    SUBMITTING: { label: '提交任務中...', color: 'text-purple-400', icon: Loader2 },
    QUEUED: { label: '排隊中...', color: 'text-yellow-400', icon: Clock },
    RUNNING: { label: '執行中...', color: 'text-blue-400', icon: Loader2 },
    SUCCESS: { label: '完成', color: 'text-emerald-400', icon: CheckCircle },
    FAILED: { label: '失敗', color: 'text-red-400', icon: XCircle },
};

// API 狀態碼
const API_CODE = {
    SUCCESS: 0,
    RUNNING: 804,
    FAILED: 805,
    QUEUED: 813,
};

export function StepRunning({ apiKey, app, nodeInfoList, onComplete, onFailed, onBack }: StepRunningProps) {
    const [status, setStatus] = useState<TaskStatus>('SUBMITTING');
    const [taskId, setTaskId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [startTime] = useState(Date.now());
    const [elapsedTime, setElapsedTime] = useState(0);

    // 更新經過時間
    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    // 格式化時間
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // 輪詢任務狀態
    const pollTaskStatus = useCallback(async (tid: string) => {
        try {
            const response = await queryTaskOutputs(apiKey, tid);

            switch (response.code) {
                case API_CODE.SUCCESS:
                    setStatus('SUCCESS');
                    setProgress(100);
                    if (response.data) {
                        onComplete(Array.isArray(response.data) ? response.data : [response.data]);
                    } else {
                        onComplete([]);
                    }
                    return true; // 停止輪詢

                case API_CODE.RUNNING:
                    setStatus('RUNNING');
                    setProgress(prev => Math.min(prev + 5, 90));
                    return false; // 繼續輪詢

                case API_CODE.QUEUED:
                    setStatus('QUEUED');
                    return false; // 繼續輪詢

                case API_CODE.FAILED:
                    setStatus('FAILED');
                    const failReason = response.data?.failedReason?.exception_message || response.msg || '任務執行失敗';
                    setError(failReason);
                    onFailed(failReason);
                    return true; // 停止輪詢

                default:
                    // 未知狀態，繼續輪詢
                    return false;
            }
        } catch (err: any) {
            setStatus('FAILED');
            setError(err.message || '查詢任務狀態失敗');
            onFailed(err.message || '查詢任務狀態失敗');
            return true;
        }
    }, [apiKey, onComplete, onFailed]);

    // 提交並開始執行
    useEffect(() => {
        let isMounted = true;
        let pollTimer: NodeJS.Timeout | null = null;

        const startTask = async () => {
            try {
                // 提交任務
                const webappId = app.webappId || app.id;
                const result = await submitTask(apiKey, webappId, nodeInfoList);

                if (!isMounted) return;

                setTaskId(result.taskId);
                setStatus('RUNNING');
                setProgress(10);

                // 開始輪詢
                const poll = async () => {
                    if (!isMounted) return;

                    const done = await pollTaskStatus(result.taskId);

                    if (!done && isMounted) {
                        pollTimer = setTimeout(poll, 2000);
                    }
                };

                poll();
            } catch (err: any) {
                if (!isMounted) return;
                setStatus('FAILED');
                setError(err.message || '提交任務失敗');
                onFailed(err.message || '提交任務失敗');
            }
        };

        startTask();

        return () => {
            isMounted = false;
            if (pollTimer) clearTimeout(pollTimer);
        };
    }, [apiKey, app, nodeInfoList, pollTaskStatus, onFailed]);

    const StatusIcon = STATUS_CONFIG[status].icon;
    const isAnimating = status === 'SUBMITTING' || status === 'RUNNING';

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md">
                {/* 狀態圖標 */}
                <div className="flex justify-center mb-8">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center ${status === 'SUCCESS' ? 'bg-emerald-500/20' :
                            status === 'FAILED' ? 'bg-red-500/20' :
                                'bg-purple-500/20'
                        }`}>
                        <StatusIcon className={`w-12 h-12 ${STATUS_CONFIG[status].color} ${isAnimating ? 'animate-spin' : ''}`} />
                    </div>
                </div>

                {/* 狀態文字 */}
                <div className="text-center mb-8">
                    <h2 className={`text-2xl font-bold ${STATUS_CONFIG[status].color}`}>
                        {STATUS_CONFIG[status].label}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        {app.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        已用時間: {formatTime(elapsedTime)}
                    </p>
                </div>

                {/* 進度條 */}
                {(status === 'RUNNING' || status === 'QUEUED') && (
                    <div className="mb-8">
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="mt-2 text-center text-xs text-slate-400">
                            {progress}%
                        </p>
                    </div>
                )}

                {/* 錯誤信息 */}
                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* 任務 ID */}
                {taskId && (
                    <p className="text-center text-xs text-slate-500">
                        任務 ID: {taskId}
                    </p>
                )}

                {/* 返回按鈕 */}
                {status === 'FAILED' && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={onBack}
                            className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
                        >
                            <ChevronLeft size={18} />
                            返回重試
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
