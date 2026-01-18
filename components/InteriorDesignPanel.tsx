import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { analyzeInteriorImage } from '../services/geminiService';
import { BIMData, QuotationItem } from '../bim_types';

interface InteriorDesignPanelProps {
    onBack: () => void;
}

export const InteriorDesignPanel: React.FC<InteriorDesignPanelProps> = ({ onBack }) => {
    const { theme, themeName } = useTheme();
    const isDark = themeName !== 'light';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeSlot, setActiveSlot] = useState<number>(0); // 當前點擊的上傳欄位

    // 4 個圖片欄位
    const [selectedImages, setSelectedImages] = useState<(string | null)[]>([null, null, null, null]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [bimData, setBimData] = useState<BIMData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 可編輯的報價項目 (從 bimData 複製並允許修改)
    const [editedQuotation, setEditedQuotation] = useState<QuotationItem[]>([]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newImages = [...selectedImages];
                newImages[activeSlot] = reader.result as string;
                setSelectedImages(newImages);
                setBimData(null); // Clear previous results
                setEditedQuotation([]);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
        event.target.value = ''; // 重置 input 以允許重複選擇同檔
    };

    const handleRemoveImage = (index: number) => {
        const newImages = [...selectedImages];
        newImages[index] = null;
        setSelectedImages(newImages);
    };

    const hasAnyImage = selectedImages.some(img => img !== null);

    // 用戶自定義提示詞
    const [analysisPrompt, setAnalysisPrompt] = useState('');

    const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });

    const handleDimensionChange = (field: 'length' | 'width' | 'height', value: string) => {
        setDimensions(prev => ({ ...prev, [field]: value }));
    };

    const handleAnalyze = async () => {
        const firstImage = selectedImages.find(img => img !== null);
        if (!firstImage) return;

        setIsAnalyzing(true);
        setError(null);
        try {
            // 使用第一張圖片進行分析 (未來可擴展為多圖分析)
            const base64Data = firstImage.split(',')[1];
            const result = await analyzeInteriorImage(base64Data, 'image/png', {
                width: dimensions.width ? parseFloat(dimensions.width) : undefined,
                height: dimensions.height ? parseFloat(dimensions.height) : undefined,
                depth: dimensions.length ? parseFloat(dimensions.length) : undefined,
            });
            setBimData(result);
            // 初始化可編輯報價 (複製一份)
            setEditedQuotation(result.estimatedQuotation.map(item => ({ ...item })));
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to analyze image");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (editedQuotation.length > 0) {
            const allIds = new Set(editedQuotation.map(i => i.id));
            setSelectedItems(allIds);
        }
    }, [editedQuotation]);

    const toggleItem = (id: string) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedItems(newSet);
    };

    // 更新報價項目的欄位
    const handleQuotationChange = (id: string, field: 'quantity' | 'unitPrice' | 'unit' | 'category' | 'item' | 'description', value: string) => {
        setEditedQuotation(prev => prev.map(item => {
            if (item.id === id) {
                // 文字欄位
                if (field === 'unit' || field === 'category' || field === 'item' || field === 'description') {
                    return { ...item, [field]: value };
                }
                // 數字欄位
                const numValue = parseFloat(value) || 0;
                const updated = { ...item, [field]: numValue };
                // 重新計算小計
                updated.totalPrice = updated.quantity * updated.unitPrice;
                return updated;
            }
            return item;
        }));
    };

    // 計算動態總額 (使用 editedQuotation)
    const dynamicTotal = editedQuotation.reduce((sum, item) => {
        return selectedItems.has(item.id) ? sum + item.totalPrice : sum;
    }, 0);

    // 新增項目
    const handleAddItem = () => {
        const newItem: QuotationItem = {
            id: `custom-${Date.now()}`,
            category: '自定義',
            item: '新增項目',
            description: '點擊編輯說明',
            quantity: 1,
            unit: '式',
            unitPrice: 0,
            totalPrice: 0
        };
        setEditedQuotation(prev => [...prev, newItem]);
        setSelectedItems(prev => new Set([...prev, newItem.id]));
    };

    // 匯出 Excel
    const handleExportExcel = () => {
        if (!bimData || editedQuotation.length === 0) return;

        // 建立 CSV 內容
        const headers = ['工程類別', '項目', '說明', '數量', '單位', '單價', '小計'];
        const rows = editedQuotation
            .filter(item => selectedItems.has(item.id))
            .map(item => [
                item.category,
                item.item,
                item.description,
                item.quantity,
                item.unit,
                item.unitPrice,
                item.totalPrice
            ]);

        // 加入總計行
        rows.push(['', '', '', '', '', '總計', dynamicTotal]);

        // BOM for Excel to recognize UTF-8
        const BOM = '\uFEFF';
        const csvContent = BOM + [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // 下載檔案
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `室內設計估價單_${bimData.space.roomType}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };


    const [drawingModalOpen, setDrawingModalOpen] = useState(false);
    const [selectedDrawingItem, setSelectedDrawingItem] = useState<{ id: string, item: string } | null>(null);
    const [drawingPrompt, setDrawingPrompt] = useState('');

    // Per-item drawing state: { itemId: { loading: boolean, imageUrl: string | null } }
    const [drawingStates, setDrawingStates] = useState<Record<string, { loading: boolean, imageUrl: string | null }>>({});

    const handleGenerateDrawing = async (item: QuotationItem, customPrompt?: string) => {
        const firstImage = selectedImages.find(img => img !== null);
        if (!firstImage) return;

        // Set per-item loading state
        setDrawingStates(prev => ({ ...prev, [item.id]: { loading: true, imageUrl: prev[item.id]?.imageUrl || null } }));

        try {
            const base64Data = firstImage.includes(',') ? firstImage : firstImage;
            const resultUrl = await import('../services/geminiService').then(mod =>
                mod.generateEngineeringDrawing(base64Data, item.item, customPrompt)
            );

            // Update state with generated image
            setDrawingStates(prev => ({ ...prev, [item.id]: { loading: false, imageUrl: resultUrl } }));
        } catch (error: any) {
            console.error("Drawing generation failed:", error);
            setError(error.message || "Failed to generate drawing");
            setDrawingStates(prev => ({ ...prev, [item.id]: { loading: false, imageUrl: null } }));
        }
    };

    const openDrawingModal = (item: QuotationItem) => {
        const state = drawingStates[item.id];
        if (state?.imageUrl) {
            setSelectedDrawingItem({ id: item.id, item: item.item });
            setDrawingModalOpen(true);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex flex-col pt-12 px-6 pb-6 select-none bg-gray-950 text-white overflow-hidden">
            {/* 頂部標題列 */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 flex items-center gap-2">
                        AI 室內設計自動化 <span className="text-xs px-2 py-0.5 rounded border border-yellow-500/30 text-yellow-500 bg-yellow-500/10">BETA</span>
                    </h1>
                    <p className="text-sm text-gray-400">
                        上傳室內照片，自動生成 BIM 資料與施工估價單
                    </p>
                </div>
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
                >
                    返回桌面
                </button>
            </div>

            {/* Drawing Preview Modal */}
            {drawingModalOpen && selectedDrawingItem && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col max-h-full shadow-2xl">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">工程圖: {selectedDrawingItem.item}</h3>
                            <button onClick={() => setDrawingModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[400px] bg-black/20 overflow-auto">
                            {drawingStates[selectedDrawingItem.id]?.imageUrl ? (
                                <img src={drawingStates[selectedDrawingItem.id].imageUrl!} alt="Engineering Drawing" className="max-h-[60vh] object-contain rounded border border-white/20 shadow-lg" />
                            ) : (
                                <p className="text-gray-500">尚未生成工程圖</p>
                            )}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-gray-800/50 rounded-b-2xl">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={drawingPrompt}
                                    onChange={(e) => setDrawingPrompt(e.target.value)}
                                    placeholder="輸入指令 (例如: '加入尺寸標註', '改為剖面圖')..."
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !drawingStates[selectedDrawingItem.id]?.loading) {
                                            handleGenerateDrawing({ id: selectedDrawingItem.id, item: selectedDrawingItem.item } as QuotationItem, drawingPrompt);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => handleGenerateDrawing({ id: selectedDrawingItem.id, item: selectedDrawingItem.item } as QuotationItem, drawingPrompt)}
                                    disabled={drawingStates[selectedDrawingItem.id]?.loading}
                                    className="px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 border border-yellow-600/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {drawingStates[selectedDrawingItem.id]?.loading ? '生成中...' : '重新生成'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
                {/* 左側：上傳與預覽 (縮窄寬度) */}
                <div className="col-span-2 flex flex-col gap-2 min-h-0 overflow-hidden">
                    {/* 垂直 4 列圖片上傳區 (自適應高度) */}
                    <div className="flex-1 rounded-xl border border-white/10 bg-gray-900/50 p-1.5 flex flex-col gap-1.5 min-h-0 overflow-hidden">
                        {selectedImages.map((img, index) => (
                            <div
                                key={index}
                                className={`relative flex-1 min-h-[40px] rounded-lg border-2 border-dashed ${img ? 'border-gray-600 bg-gray-800/50' : 'border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer'} flex items-center justify-center transition-all overflow-hidden group`}
                                onClick={() => {
                                    if (!img) {
                                        setActiveSlot(index);
                                        fileInputRef.current?.click();
                                    }
                                }}
                            >
                                {img ? (
                                    <>
                                        <img src={img} alt={`照片 ${index + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 hover:bg-red-500/80 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ×
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center gap-1 text-gray-500">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="text-[8px]">照片 {index + 1}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*"
                    />

                    {/* 底部控制區 (永遠顯示) */}
                    <div className="mt-auto flex flex-col gap-2">
                        {/* 尺寸輸入 */}
                        <div className="grid grid-cols-3 gap-1 bg-gray-900/50 p-2 rounded-lg border border-white/10">
                            <div>
                                <label className="block text-[9px] text-gray-400 mb-0.5 pl-0.5">長 (m)</label>
                                <input
                                    type="number"
                                    placeholder="自動"
                                    value={dimensions.length}
                                    onChange={(e) => handleDimensionChange('length', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white placeholder-gray-600 focus:border-yellow-500/50 focus:outline-none text-center"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] text-gray-400 mb-0.5 pl-0.5">寬 (m)</label>
                                <input
                                    type="number"
                                    placeholder="自動"
                                    value={dimensions.width}
                                    onChange={(e) => handleDimensionChange('width', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white placeholder-gray-600 focus:border-yellow-500/50 focus:outline-none text-center"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] text-gray-400 mb-0.5 pl-0.5">高 (m)</label>
                                <input
                                    type="number"
                                    placeholder="自動"
                                    value={dimensions.height}
                                    onChange={(e) => handleDimensionChange('height', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white placeholder-gray-600 focus:border-yellow-500/50 focus:outline-none text-center"
                                />
                            </div>
                        </div>

                        {/* 提示詞輸入 */}
                        <div className="bg-gray-900/50 rounded-lg border border-white/10 p-2">
                            <label className="block text-[9px] text-gray-400 mb-1">自定提示詞 (選填)</label>
                            <textarea
                                rows={2}
                                placeholder="輸入額外說明..."
                                value={analysisPrompt}
                                onChange={(e) => setAnalysisPrompt(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white placeholder-gray-600 focus:border-yellow-500/50 focus:outline-none resize-none"
                            />
                        </div>

                        {/* 執行按鈕 */}
                        <button
                            onClick={handleAnalyze}
                            disabled={!hasAnyImage || isAnalyzing}
                            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all
                                ${!hasAnyImage
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : isAnalyzing
                                        ? 'bg-yellow-600/50 text-white cursor-wait'
                                        : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black shadow-lg shadow-yellow-900/20 active:scale-[0.98]'
                                }
                            `}
                        >
                            {isAnalyzing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    分析中...
                                </>
                            ) : (
                                <>
                                    <span className="text-base">✨</span> 生成估價單
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-[10px] text-center">
                                {error}
                            </div>
                        )}
                    </div>
                </div>


                {/* 右側：結果顯示 */}
                <div className="col-span-10 flex flex-col gap-4 min-h-0 rounded-xl bg-gray-900/50 border border-white/10 p-1 relative overflow-hidden">
                    {bimData ? (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* 摘要標題 */}
                            <div className="flex-shrink-0 p-4 border-b border-white/10 bg-gray-900/80 backdrop-blur">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-white mb-1">{bimData.space.roomType}</h2>
                                        <p className="text-sm text-blue-300 font-mono">
                                            {bimData.space.dimensions.width}m x {bimData.space.dimensions.depth || '?'}m
                                            <span className="mx-2 text-gray-600">|</span>
                                            風格: {bimData.space.designStyle}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400 mb-1">預估總預算</div>
                                        <div className="text-2xl font-bold text-green-400 font-mono">
                                            ${dynamicTotal.toLocaleString()} <span className="text-sm text-gray-500">元</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{bimData.usageAnalysis}</p>
                            </div>

                            {/* 可滾動內容 */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

                                {/* 估價表格 */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                            📋 施工估價單 (數量清單)
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleAddItem}
                                                className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium border border-blue-500/30 transition-colors flex items-center gap-1"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                新增項目
                                            </button>
                                            <button
                                                onClick={handleExportExcel}
                                                disabled={editedQuotation.length === 0}
                                                className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium border border-green-500/30 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                匯出EXCEL報價單
                                            </button>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 overflow-hidden bg-black/20">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-white/5 text-gray-400 text-xs">
                                                <tr>
                                                    <th className="w-8 px-2 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={editedQuotation.every(i => selectedItems.has(i.id))}
                                                            onChange={() => {
                                                                const allSelected = editedQuotation.every(i => selectedItems.has(i.id));
                                                                if (allSelected) {
                                                                    setSelectedItems(new Set());
                                                                } else {
                                                                    setSelectedItems(new Set(editedQuotation.map(i => i.id)));
                                                                }
                                                            }}
                                                            className="rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-yellow-500/50"
                                                        />
                                                    </th>
                                                    <th className="px-2 py-2 font-medium">工程類別</th>
                                                    <th className="w-16 px-1 py-2 font-medium text-center">工程圖</th>
                                                    <th className="px-2 py-2 font-medium">項目 / 說明</th>
                                                    <th className="w-16 px-1 py-2 font-medium text-center">數量</th>
                                                    <th className="w-14 px-1 py-2 font-medium text-center">單位</th>
                                                    <th className="w-20 px-1 py-2 font-medium text-center">單價</th>
                                                    <th className="w-20 px-2 py-2 font-medium text-right bg-white/5">小計</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {editedQuotation.map((item) => {
                                                    const isSelected = selectedItems.has(item.id);
                                                    return (
                                                        <tr key={item.id} className={`hover:bg-white/5 transition-colors ${!isSelected ? 'opacity-50' : ''}`}>
                                                            <td className="px-2 py-4 text-center align-middle">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => toggleItem(item.id)}
                                                                    className="rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-yellow-500/50"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-4 align-middle">
                                                                <input
                                                                    type="text"
                                                                    value={item.category}
                                                                    onChange={(e) => handleQuotationChange(item.id, 'category', e.target.value)}
                                                                    className="w-16 bg-black/40 border border-white/10 rounded px-1 py-1 text-xs text-gray-400 font-mono focus:border-yellow-500/50 focus:outline-none"
                                                                />
                                                            </td>
                                                            {/* 工程圖縮圖欄位 (3:2 比例，放大) */}
                                                            <td className="px-1 py-4 align-middle">
                                                                <div className="w-[90px] h-[60px] rounded border border-white/10 bg-black/30 flex items-center justify-center overflow-hidden mx-auto">
                                                                    {drawingStates[item.id]?.loading ? (
                                                                        <div className="w-4 h-4 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
                                                                    ) : drawingStates[item.id]?.imageUrl ? (
                                                                        <button onClick={() => openDrawingModal(item)} className="w-full h-full hover:opacity-80 transition-opacity">
                                                                            <img src={drawingStates[item.id].imageUrl!} alt="工程圖" className="w-full h-full object-cover" />
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleGenerateDrawing(item)}
                                                                            className="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                                            title="生成工程圖"
                                                                        >
                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-4 align-middle">
                                                                <input
                                                                    type="text"
                                                                    value={item.item}
                                                                    onChange={(e) => handleQuotationChange(item.id, 'item', e.target.value)}
                                                                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-gray-200 font-medium focus:border-yellow-500/50 focus:outline-none mb-1"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={item.description}
                                                                    onChange={(e) => handleQuotationChange(item.id, 'description', e.target.value)}
                                                                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-gray-500 focus:border-yellow-500/50 focus:outline-none"
                                                                    placeholder="說明..."
                                                                />
                                                            </td>
                                                            {/* 可編輯數量 */}
                                                            <td className="px-1 py-4 align-middle">
                                                                <input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleQuotationChange(item.id, 'quantity', e.target.value)}
                                                                    className="w-14 bg-black/40 border border-white/10 rounded px-1 py-1 text-xs text-white text-center focus:border-yellow-500/50 focus:outline-none"
                                                                />
                                                            </td>
                                                            {/* 可編輯單位 */}
                                                            <td className="px-1 py-4 align-middle">
                                                                <input
                                                                    type="text"
                                                                    value={item.unit}
                                                                    onChange={(e) => handleQuotationChange(item.id, 'unit', e.target.value)}
                                                                    className="w-12 bg-black/40 border border-white/10 rounded px-1 py-1 text-[10px] text-gray-400 text-center focus:border-yellow-500/50 focus:outline-none"
                                                                />
                                                            </td>
                                                            {/* 可編輯單價 */}
                                                            <td className="px-1 py-4 align-middle">
                                                                <input
                                                                    type="number"
                                                                    value={item.unitPrice}
                                                                    onChange={(e) => handleQuotationChange(item.id, 'unitPrice', e.target.value)}
                                                                    className="w-18 bg-black/40 border border-white/10 rounded px-1 py-1 text-xs text-white text-center font-mono focus:border-yellow-500/50 focus:outline-none"
                                                                />
                                                            </td>
                                                            <td className={`px-2 py-4 text-right font-medium font-mono text-sm align-middle ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                                                {item.totalPrice.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 詳細資料 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg bg-black/20 border border-white/10">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">表面資料 ({bimData.surfaces.length})</h3>
                                        <div className="space-y-2">
                                            {bimData.surfaces.map(s => (
                                                <div key={s.id} className="flex justify-between text-xs">
                                                    <span className="text-gray-300">{s.type}</span>
                                                    <span className="text-gray-500">{s.material.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-black/20 border border-white/10">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">家具項目 ({bimData.furniture.length})</h3>
                                        <div className="space-y-2">
                                            {bimData.furniture.map(f => (
                                                <div key={f.id} className="flex justify-between text-xs">
                                                    <span className="text-gray-300">{f.name}</span>
                                                    <span className="text-gray-500 font-mono">${f.estimatedPrice?.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    ) : (
                        /* 空狀態 */
                        <div className="h-full flex flex-col items-center justify-center text-gray-600">
                            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                <span className="text-4xl opacity-50">📐</span>
                            </div>
                            <h3 className="text-xl font-medium text-gray-500 mb-2">尚無分析資料</h3>
                            <p className="text-sm text-gray-600 max-w-sm text-center">
                                上傳圖片並點擊「生成 BIM 與估價單」即可查看 AI 分析結果。
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};
