import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, X, CheckCircle, XCircle, Loader2, Clock, Minimize2, Maximize2, GripHorizontal } from 'lucide-react';
import { useTaskStore } from '../../stores/runningHubTaskStore';
import type { BackgroundTask } from '../../services/runningHub/types';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// 格式化時長
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
}

// 任務狀態配置
const STATUS_CONFIG = {
    PENDING: { label: '等待中', color: 'text-slate-400', bgColor: 'bg-slate-400', icon: Clock },
    QUEUED: { label: '排隊中', color: 'text-amber-400', bgColor: 'bg-amber-400', icon: Clock },
    RUNNING: { label: '執行中', color: 'text-emerald-400', bgColor: 'bg-emerald-400', icon: Loader2 },
    SUCCESS: { label: '完成', color: 'text-emerald-400', bgColor: 'bg-emerald-400', icon: CheckCircle },
    FAILED: { label: '失敗', color: 'text-red-400', bgColor: 'bg-red-400', icon: XCircle },
};

export function TaskFloater() {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { tasks, runningCount, removeTask, cancelTask } = useTaskStore();

    // 只顯示最近的任務
    const recentTasks = tasks.slice(0, 10);
    const hasRunning = runningCount > 0;
    const runningTasks = tasks.filter(t => t.status === 'RUNNING');
    const queuedTasks = tasks.filter(t => t.status === 'QUEUED');
    const completedTasks = tasks.filter(t => t.status === 'SUCCESS' || t.status === 'FAILED');

    // 拖拽處理
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: position.x,
            startPosY: position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragRef.current) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setPosition({
                x: dragRef.current.startPosX - dx,
                y: dragRef.current.startPosY - dy
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            dragRef.current = null;
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (tasks.length === 0) return null;

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-4 right-4 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-full shadow-lg hover:opacity-90 transition-all z-50"
                style={{ right: position.x || 16, bottom: position.y || 16 }}
            >
                <div className="relative">
                    <Loader2 className={cn("w-6 h-6", hasRunning && "animate-spin")} />
                    {runningCount > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {runningCount}
                        </span>
                    )}
                </div>
            </button>
        );
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                "fixed w-80 bg-[#1a1d24] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50",
                isDragging && "cursor-grabbing"
            )}
            style={{
                right: position.x || 16,
                bottom: position.y || 16,
            }}
        >
            {/* 頭部 - 可拖拽 */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-white/10 cursor-grab"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2">
                    <GripHorizontal className="w-4 h-4 text-white/40" />
                    {hasRunning && (
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                    <span className="text-sm font-semibold text-white">
                        任務管理器
                    </span>
                    <span className="text-xs text-white/40">
                        ({runningTasks.length + queuedTasks.length}運行中)
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    >
                        <Minimize2 size={14} />
                    </button>
                </div>
            </div>

            {/* 任務列表 */}
            {isExpanded && (
                <div className="max-h-80 overflow-y-auto">
                    {/* 運行中的任務 */}
                    {runningTasks.length > 0 && (
                        <div className="border-b border-white/5">
                            {runningTasks.map((task) => (
                                <TaskItem
                                    key={task.id}
                                    task={task}
                                    onRemove={() => removeTask(task.id)}
                                    onCancel={() => cancelTask(task.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* 排隊中的任務 */}
                    {queuedTasks.length > 0 && (
                        <div className="border-b border-white/5 bg-amber-500/5">
                            <div className="px-4 py-1.5 text-xs text-amber-400 font-medium">
                                排隊中 ({queuedTasks.length})
                            </div>
                            {queuedTasks.slice(0, 3).map((task) => (
                                <TaskItem
                                    key={task.id}
                                    task={task}
                                    onRemove={() => removeTask(task.id)}
                                    onCancel={() => cancelTask(task.id)}
                                    compact
                                />
                            ))}
                            {queuedTasks.length > 3 && (
                                <div className="px-4 py-2 text-xs text-white/40 text-center">
                                    還有 {queuedTasks.length - 3} 個任務在排隊
                                </div>
                            )}
                        </div>
                    )}

                    {/* 已完成的任務 */}
                    {completedTasks.slice(0, 5).map((task) => (
                        <TaskItem
                            key={task.id}
                            task={task}
                            onRemove={() => removeTask(task.id)}
                            onCancel={() => cancelTask(task.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// 單個任務項
function TaskItem({
    task,
    onRemove,
    onCancel,
    compact = false,
}: {
    task: BackgroundTask;
    onRemove: () => void;
    onCancel: () => void;
    compact?: boolean;
}) {
    const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
    const StatusIcon = config.icon;
    const isActive = task.status === 'RUNNING' || task.status === 'QUEUED' || task.status === 'PENDING';

    // 計算耗時
    const duration = task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime;

    return (
        <div className={cn(
            "px-4 border-b border-white/5 hover:bg-white/5 transition-colors",
            compact ? "py-2" : "py-3"
        )}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <StatusIcon
                            className={cn(
                                "w-4 h-4 flex-shrink-0",
                                config.color,
                                task.status === 'RUNNING' && "animate-spin"
                            )}
                        />
                        <span className="text-sm font-medium text-white truncate">
                            {task.appName}
                        </span>
                    </div>
                    {!compact && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                            <span className={config.color}>{config.label}</span>
                            {task.status === 'RUNNING' && (
                                <span>{task.progress}%</span>
                            )}
                            {(task.status === 'SUCCESS' || task.status === 'FAILED') && (
                                <span>耗時 {formatDuration(duration)}</span>
                            )}
                            {task.costCoins && (
                                <span className="text-amber-400">⚡{task.costCoins}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* 操作按鈕 */}
                <div className="flex items-center gap-1">
                    {isActive ? (
                        <button
                            onClick={onCancel}
                            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="取消"
                        >
                            <X size={14} />
                        </button>
                    ) : (
                        <button
                            onClick={onRemove}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="移除"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* 進度條 */}
            {task.status === 'RUNNING' && !compact && (
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                        style={{ width: `${task.progress}%` }}
                    />
                </div>
            )}

            {/* 結果縮略圖 */}
            {task.status === 'SUCCESS' && task.result && task.result.length > 0 && !compact && (
                <div className="mt-2 flex gap-1">
                    {task.result.slice(0, 4).map((output, idx) => (
                        <div key={idx} className="w-10 h-10 rounded bg-white/10 overflow-hidden">
                            <img
                                src={output.fileUrl}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                    {task.result.length > 4 && (
                        <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-xs text-white/40">
                            +{task.result.length - 4}
                        </div>
                    )}
                </div>
            )}

            {/* 錯誤信息 */}
            {task.error && !compact && (
                <p className="mt-1 text-xs text-red-400 truncate">{task.error}</p>
            )}
        </div>
    );
}

export default TaskFloater;
