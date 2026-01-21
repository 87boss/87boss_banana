import React, { useCallback, useState, useEffect } from 'react';
import { CheckCircle, XCircle, Download, RotateCcw, ChevronLeft, Image as ImageIcon, Video, Music, ExternalLink, Wand2, Loader2 } from 'lucide-react';
import type { TaskOutput } from '../../services/runningHub/types';

interface StepResultProps {
    result: TaskOutput[] | null;
    error: string | null;
    onRestart: () => void;
    onBack: () => void;
}

// 判斷文件類型 - 更寬鬆的檢測，考慮 API 返回的 fileType
function getFileType(output: TaskOutput): 'image' | 'video' | 'audio' | 'unknown' {
    const url = output.fileUrl || '';
    const fileType = (output.fileType || '').toLowerCase();

    if (fileType.includes('image') || fileType === 'png' || fileType === 'jpg' || fileType === 'jpeg' || fileType === 'webp' || fileType === 'gif') {
        return 'image';
    }
    if (fileType.includes('video') || fileType === 'mp4' || fileType === 'webm' || fileType === 'mov') {
        return 'video';
    }
    if (fileType.includes('audio') || fileType === 'mp3' || fileType === 'wav' || fileType === 'ogg') {
        return 'audio';
    }

    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio';

    if (url.includes('runninghub') || url.includes('oss') || url.includes('cdn')) {
        return 'image';
    }

    return 'unknown';
}

export function StepResult({ result, error, onRestart, onBack }: StepResultProps) {
    const hasError = !!error;
    const hasResults = result && result.length > 0;
    const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
    const [decodedImages, setDecodedImages] = useState<Map<number, string>>(new Map());
    const [decodingIndexes, setDecodingIndexes] = useState<Set<number>>(new Set());

    // 下載單個文件
    const handleDownload = useCallback((url: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = url.split('/').pop() || 'download';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, []);

    // 處理圖片加載錯誤
    const handleImageError = useCallback((index: number) => {
        setImageErrors(prev => new Set(prev).add(index));
    }, []);

    // 解碼圖片 (使用 duck_decoder)
    const handleDecode = useCallback(async (url: string, index: number) => {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI?.decodeImage) {
            console.warn('Decode API not available');
            return;
        }

        setDecodingIndexes(prev => new Set(prev).add(index));

        try {
            // 下載圖片數據
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch image');

            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // 調用解碼 API
            const fileName = url.split('/').pop() || `image_${index}.png`;
            const result = await electronAPI.decodeImage(Array.from(uint8Array), fileName);

            if (result?.success && result.outputPath) {
                setDecodedImages(prev => new Map(prev).set(index, result.outputPath));
                console.log(`[Decode] Image ${index} decoded successfully`);
            } else {
                console.warn(`[Decode] Failed:`, result?.error);
            }
        } catch (err) {
            console.error(`[Decode] Error:`, err);
        } finally {
            setDecodingIndexes(prev => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
        }
    }, []);

    // 渲染輸出項
    const renderOutput = (output: TaskOutput, index: number) => {
        const fileType = getFileType(output);
        const hasImageError = imageErrors.has(index);
        const isDecoding = decodingIndexes.has(index);
        const decodedUrl = decodedImages.get(index);
        const displayUrl = decodedUrl || output.fileUrl;

        return (
            <div
                key={index}
                className="group relative bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/30 transition-all"
            >
                {/* 預覽 */}
                <div className="aspect-video bg-black/20 flex items-center justify-center">
                    {(fileType === 'image' || fileType === 'unknown') && !hasImageError ? (
                        <img
                            src={displayUrl}
                            alt={`輸出 ${index + 1}`}
                            className="w-full h-full object-contain"
                            onError={() => handleImageError(index)}
                        />
                    ) : fileType === 'video' ? (
                        <video
                            src={output.fileUrl}
                            controls
                            className="w-full h-full object-contain"
                        />
                    ) : fileType === 'audio' ? (
                        <div className="flex flex-col items-center gap-4 p-4">
                            <Music className="w-12 h-12 text-purple-400" />
                            <audio src={output.fileUrl} controls className="w-full" />
                        </div>
                    ) : (
                        <a
                            href={output.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            <ExternalLink className="w-12 h-12" />
                            <span className="text-sm">點擊查看</span>
                        </a>
                    )}
                </div>

                {/* 操作按鈕 */}
                <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* 解碼按鈕 - 只對圖片顯示 */}
                    {(fileType === 'image' || fileType === 'unknown') && !decodedUrl && (
                        <button
                            onClick={() => handleDecode(output.fileUrl, index)}
                            disabled={isDecoding}
                            className="p-2 bg-purple-500/50 backdrop-blur-sm rounded-lg hover:bg-purple-500/70 transition-colors disabled:opacity-50"
                            title="解碼圖片"
                        >
                            {isDecoding ? (
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : (
                                <Wand2 className="w-4 h-4 text-white" />
                            )}
                        </button>
                    )}

                    {/* 下載按鈕 */}
                    <button
                        onClick={() => handleDownload(displayUrl)}
                        className="p-2 bg-black/50 backdrop-blur-sm rounded-lg hover:bg-black/70 transition-colors"
                        title="下載"
                    >
                        <Download className="w-4 h-4 text-white" />
                    </button>
                </div>

                {/* 解碼標記 */}
                {decodedUrl && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-500/80 text-white text-xs rounded-md">
                        已解碼
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* 頂部 */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        {hasError ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                        ) : (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                        )}
                        <h2 className="font-semibold text-white">
                            {hasError ? '執行失敗' : '執行完成'}
                        </h2>
                    </div>
                </div>

                <button
                    onClick={onRestart}
                    className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
                >
                    <RotateCcw size={18} />
                    重新執行
                </button>
            </div>

            {/* 內容 */}
            <div className="flex-1 overflow-y-auto p-6">
                {hasError ? (
                    <div className="max-w-md mx-auto text-center py-12">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-red-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">任務執行失敗</h3>
                        <p className="text-sm text-slate-400 mb-6">{error}</p>
                        <button
                            onClick={onRestart}
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all"
                        >
                            重試
                        </button>
                    </div>
                ) : hasResults ? (
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm text-slate-400">
                                共 {result.length} 個輸出
                            </span>
                            <span className="text-xs text-slate-500">
                                💡 如果看到黃色鴨子，點擊 <Wand2 className="w-3 h-3 inline" /> 解碼
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {result.map((output, index) => renderOutput(output, index))}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-md mx-auto text-center py-12">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">任務已完成</h3>
                        <p className="text-sm text-slate-400">此任務沒有產生輸出文件</p>
                    </div>
                )}
            </div>
        </div>
    );
}
