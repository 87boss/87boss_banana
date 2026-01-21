import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, Play, Upload, Image as ImageIcon, Type, Hash, List, ToggleLeft, Loader2, Download, ChevronRight, Trash2, Zap } from 'lucide-react';
import { uploadFile } from '../../services/runningHub/api';
import { useTaskStore } from '../../stores/runningHubTaskStore';
import type { NodeInfo, TaskOutput, AppPoolItem } from '../../services/runningHub/types';
import type { WebappDetail } from '../../services/runningHub/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface StepEditorProps {
    apiKey: string;
    app: AppPoolItem & { webappId?: string; webappDetail?: WebappDetail };
    nodeInfoList: NodeInfo[];
    covers?: string[];
    onBack: () => void;
}

// 字段類型圖標映射
const FIELD_ICONS: Record<string, React.ElementType> = {
    IMAGE: ImageIcon,
    STRING: Type,
    INT: Hash,
    FLOAT: Hash,
    LIST: List,
    SWITCH: ToggleLeft,
    AUDIO: ImageIcon,
    VIDEO: ImageIcon,
};

export function StepEditor({ apiKey, app, nodeInfoList, covers = [], onBack }: StepEditorProps) {
    const [params, setParams] = useState<NodeInfo[]>(() =>
        nodeInfoList.map(node => ({ ...node }))
    );
    const [uploadingNodes, setUploadingNodes] = useState<Set<string>>(new Set());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 結果輪播狀態
    const [carouselIndex, setCarouselIndex] = useState(0);

    // 任務狀態
    const { tasks, addTask } = useTaskStore();

    // 獲取此應用的最近任務
    const appTasks = tasks.filter(t => t.appId === app.id || t.appName === app.name);
    const latestSuccessTask = appTasks.find(t => t.status === 'SUCCESS' && t.result && t.result.length > 0);
    const allResults: TaskOutput[] = latestSuccessTask?.result || [];

    // 更新輪播索引
    useEffect(() => {
        if (carouselIndex >= allResults.length && allResults.length > 0) {
            setCarouselIndex(allResults.length - 1);
        }
    }, [allResults.length, carouselIndex]);

    // 更新參數值
    const updateParamValue = useCallback((nodeId: string, fieldName: string, value: string) => {
        setParams(prev => prev.map(p =>
            p.nodeId === nodeId && p.fieldName === fieldName
                ? { ...p, fieldValue: value }
                : p
        ));
        setErrors(prev => {
            const next = { ...prev };
            delete next[`${nodeId}-${fieldName}`];
            return next;
        });
    }, []);

    // 處理圖片上傳
    const handleImageUpload = useCallback(async (nodeId: string, fieldName: string, file: File) => {
        const key = `${nodeId}-${fieldName}`;
        setUploadingNodes(prev => new Set(prev).add(key));

        const previewUrl = URL.createObjectURL(file);
        setImagePreviews(prev => ({ ...prev, [key]: previewUrl }));

        try {
            const result = await uploadFile(apiKey, file);
            updateParamValue(nodeId, fieldName, result.fileName);
        } catch (err: any) {
            setImagePreviews(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            setErrors(prev => ({
                ...prev,
                [key]: err.message || '上傳失敗'
            }));
        } finally {
            setUploadingNodes(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    }, [apiKey, updateParamValue]);

    // 處理文件選擇
    const handleFileSelect = useCallback((nodeId: string, fieldName: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(nodeId, fieldName, file);
        }
    }, [handleImageUpload]);

    // 處理拖放
    const handleDrop = useCallback((nodeId: string, fieldName: string, e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(nodeId, fieldName, file);
        }
    }, [handleImageUpload]);

    // 開始執行
    const handleRun = useCallback(async () => {
        // 驗證必填字段
        const newErrors: Record<string, string> = {};
        params.forEach(p => {
            if (p.fieldType === 'IMAGE' && !p.fieldValue) {
                newErrors[`${p.nodeId}-${p.fieldName}`] = '請上傳圖片';
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const webappId = app.webappId || app.id;
            addTask(app.id, app.name, apiKey, webappId, params);
        } finally {
            setIsSubmitting(false);
        }
    }, [params, app, apiKey, addTask]);

    // 下載結果
    const handleDownload = useCallback(async (url: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = url.split('/').pop() || 'download';
            a.click();
        } catch (e) {
            console.error('Download failed:', e);
        }
    }, []);

    // 輪播導航
    const nextSlide = () => setCarouselIndex(i => Math.min(i + 1, allResults.length - 1));
    const prevSlide = () => setCarouselIndex(i => Math.max(i - 1, 0));

    // 渲染字段輸入
    const renderFieldInput = (node: NodeInfo) => {
        const key = `${node.nodeId}-${node.fieldName}`;
        const isUploading = uploadingNodes.has(key);
        const error = errors[key];

        switch (node.fieldType) {
            case 'IMAGE':
                return (
                    <div
                        className={cn(
                            "relative border-2 border-dashed rounded-xl p-4 text-center transition-all",
                            error ? 'border-red-500/50 bg-red-500/5' : 'border-white/20 hover:border-emerald-500/50 bg-white/5'
                        )}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(node.nodeId, node.fieldName, e)}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            ref={el => fileInputRefs.current[key] = el}
                            onChange={(e) => handleFileSelect(node.nodeId, node.fieldName, e)}
                            className="hidden"
                        />

                        {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                                <span className="text-sm text-slate-400">上傳中...</span>
                            </div>
                        ) : node.fieldValue ? (
                            <div className="flex items-center gap-3">
                                {imagePreviews[key] ? (
                                    <img
                                        src={imagePreviews[key]}
                                        alt="預覽"
                                        className="w-16 h-16 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
                                        <ImageIcon className="w-6 h-6 text-emerald-400" />
                                    </div>
                                )}
                                <div className="flex-1 text-left">
                                    <span className="text-sm text-emerald-400 truncate block">
                                        {node.fieldValue}
                                    </span>
                                    <button
                                        onClick={() => fileInputRefs.current[key]?.click()}
                                        className="text-xs text-white/50 hover:text-white/80"
                                    >
                                        點擊修改圖上傳
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRefs.current[key]?.click()}
                                className="flex flex-col items-center gap-2 w-full py-4"
                            >
                                <Upload className="w-8 h-8 text-slate-400" />
                                <span className="text-sm text-slate-400">點擊或拖放上傳圖片</span>
                            </button>
                        )}

                        {error && (
                            <p className="mt-2 text-xs text-red-400">{error}</p>
                        )}
                    </div>
                );

            case 'STRING':
                return (
                    <textarea
                        value={node.fieldValue || ''}
                        onChange={(e) => updateParamValue(node.nodeId, node.fieldName, e.target.value)}
                        placeholder={node.description || '請輸入文字'}
                        rows={3}
                        className="w-full px-4 py-3 bg-[#1a1f2e] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                );

            case 'INT':
            case 'FLOAT':
                return (
                    <input
                        type="number"
                        value={node.fieldValue || ''}
                        onChange={(e) => updateParamValue(node.nodeId, node.fieldName, e.target.value)}
                        placeholder={node.description || '請輸入數字'}
                        step={node.fieldType === 'FLOAT' ? '0.1' : '1'}
                        className="w-full px-4 py-3 bg-[#1a1f2e] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                );

            case 'LIST':
                const options = node.fieldData?.split(',').map(s => s.trim()) || [];
                return (
                    <select
                        value={node.fieldValue || ''}
                        onChange={(e) => updateParamValue(node.nodeId, node.fieldName, e.target.value)}
                        className="w-full px-4 py-3 bg-[#1a1f2e] border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500/50"
                    >
                        <option value="">請選擇...</option>
                        {options.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                        ))}
                    </select>
                );

            case 'SWITCH':
                return (
                    <button
                        onClick={() => updateParamValue(node.nodeId, node.fieldName, node.fieldValue === 'true' ? 'false' : 'true')}
                        className={cn(
                            "w-12 h-6 rounded-full transition-all",
                            node.fieldValue === 'true' ? 'bg-emerald-500' : 'bg-white/20'
                        )}
                    >
                        <div className={cn(
                            "w-5 h-5 rounded-full bg-white shadow transition-transform",
                            node.fieldValue === 'true' ? 'translate-x-6' : 'translate-x-0.5'
                        )} />
                    </button>
                );

            default:
                return (
                    <input
                        type="text"
                        value={node.fieldValue || ''}
                        onChange={(e) => updateParamValue(node.nodeId, node.fieldName, e.target.value)}
                        placeholder={node.description || '請輸入'}
                        className="w-full px-4 py-3 bg-[#1a1f2e] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                );
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* 左側 - 參數編輯區 */}
            <div className="w-80 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
                {/* 頂部 */}
                <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10">
                    <button
                        onClick={onBack}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="font-medium text-sm text-white truncate max-w-[180px]">{app.name}</h2>
                            <p className="text-xs text-white/40">ID: {(app.webappId || app.id).slice(0, 16)}...</p>
                        </div>
                    </div>
                </div>

                {/* 創作提示 */}
                <div className="px-4 py-2 border-b border-white/10 bg-emerald-500/10">
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        創作小貼士
                    </div>
                    <p className="text-xs text-white/60 mt-1">上傳素材後點擊運行，結果將顯示在右側</p>
                </div>

                {/* 參數列表 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* 素材輸入區 */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <ImageIcon className="w-4 h-4 text-white/60" />
                            <span className="text-sm font-medium">素材輸入</span>
                            <span className="text-xs text-white/40 ml-auto">必填</span>
                        </div>
                        {params.filter(p => p.fieldType === 'IMAGE').map(node => (
                            <div key={`${node.nodeId}-${node.fieldName}`} className="mb-3">
                                {renderFieldInput(node)}
                            </div>
                        ))}
                    </div>

                    {/* 參數配置區 */}
                    {params.filter(p => p.fieldType !== 'IMAGE').length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Type className="w-4 h-4 text-white/60" />
                                <span className="text-sm font-medium">參數配置</span>
                            </div>
                            {params.filter(p => p.fieldType !== 'IMAGE').map(node => {
                                const FieldIcon = FIELD_ICONS[node.fieldType] || Type;
                                return (
                                    <div key={`${node.nodeId}-${node.fieldName}`} className="mb-4">
                                        <label className="flex items-center gap-2 text-xs text-white/60 mb-1.5">
                                            <FieldIcon className="w-3 h-3" />
                                            {node.nodeName || node.fieldName}
                                        </label>
                                        {renderFieldInput(node)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 運行按鈕 */}
                <div className="flex-shrink-0 p-4 border-t border-white/10">
                    <button
                        onClick={handleRun}
                        disabled={uploadingNodes.size > 0 || isSubmitting}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Play className="w-5 h-5" />
                        )}
                        立即運行 ✨
                    </button>
                </div>
            </div>

            {/* 中間 - 結果預覽區 */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0a0d12]">
                {allResults.length > 0 ? (
                    <div className="relative w-full max-w-lg">
                        {/* 結果標籤 */}
                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/50 rounded-lg text-sm text-white/80">
                            結果 {carouselIndex + 1}
                        </div>

                        {/* 圖片輪播 */}
                        <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 shadow-2xl">
                            <img
                                src={allResults[carouselIndex]?.fileUrl}
                                alt={`結果 ${carouselIndex + 1}`}
                                className="w-full h-full object-contain"
                            />

                            {/* 導航按鈕 */}
                            {allResults.length > 1 && (
                                <>
                                    <button
                                        onClick={prevSlide}
                                        disabled={carouselIndex === 0}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center disabled:opacity-30"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={nextSlide}
                                        disabled={carouselIndex === allResults.length - 1}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center disabled:opacity-30"
                                    >
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                </>
                            )}

                            {/* 下載按鈕 */}
                            <button
                                onClick={() => handleDownload(allResults[carouselIndex]?.fileUrl)}
                                className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 頁碼 */}
                        <div className="text-center mt-4 text-sm text-white/40">
                            {carouselIndex + 1} / {allResults.length}
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        {covers.length > 0 ? (
                            <img
                                src={covers[0]}
                                alt="應用封面"
                                className="w-64 h-64 rounded-2xl object-cover opacity-60 mx-auto mb-4"
                            />
                        ) : (
                            <div className="w-64 h-64 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-16 h-16 text-white/10" />
                            </div>
                        )}
                        <p className="text-white/40">配置參數並點擊"運行"</p>
                        <p className="text-white/30 text-sm mt-1">結果將顯示在這裡</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StepEditor;
