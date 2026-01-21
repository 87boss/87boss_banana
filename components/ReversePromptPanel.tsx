
import React, { useState, useEffect } from 'react';
import { analyzeImageForPrompt } from '../services/geminiService';
import { useTheme } from '../contexts/ThemeContext';

interface ReversePromptPanelProps {
    files: File[];
    onPromptGenerate: (prompt: string) => void;
}

const ReversePromptPanel: React.FC<ReversePromptPanelProps> = ({ files, onPromptGenerate }) => {
    const { theme, themeName } = useTheme();
    const isDark = themeName !== 'light';

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    // keywords 現在是分類數組
    const [categories, setCategories] = useState<{ name: string; keywords: string[] }[]>([]);
    const [activeKeywords, setActiveKeywords] = useState<Set<string>>(new Set());
    const [fullPrompt, setFullPrompt] = useState('');
    const [finalPrompt, setFinalPrompt] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [promptMode, setPromptMode] = useState<'general' | 'interior'>('general');

    // 當選取的關鍵字改變時，更新最終的 Prompt
    // 當選取的關鍵字改變時，更新最終的 Prompt
    useEffect(() => {
        if (categories.length === 0) return;

        const activeList = Array.from(activeKeywords);

        // 找出所有關鍵字
        const allKeywords = categories.flatMap(c => c.keywords);
        const negativeList = allKeywords.filter(k => !activeKeywords.has(k));

        let newPrompt = activeList.join(', ');

        if (negativeList.length > 0) {
            newPrompt += `\n\n禁止元素 (Negative): ${negativeList.join(', ')}`;
        }

        setFinalPrompt(newPrompt);
    }, [activeKeywords, categories]);

    const handleAnalyze = async () => {
        if (files.length === 0) return;

        setIsAnalyzing(true);
        setError(null);
        setCategories([]);
        setActiveKeywords(new Set());
        setFullPrompt('');
        setFinalPrompt('');

        try {
            // 只分析第一張圖
            const result = await analyzeImageForPrompt(files[0], promptMode);

            setCategories(result.categories);

            // 預設全選所有關鍵字
            const allKeywords = result.categories.flatMap(c => c.keywords);
            setActiveKeywords(new Set(allKeywords));

            setFullPrompt(result.detailedPrompt);

            setFinalPrompt(allKeywords.join(', '));

        } catch (err) {
            setError(err instanceof Error ? err.message : '分析失敗');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleKeyword = (keyword: string) => {
        const newActive = new Set(activeKeywords);
        if (newActive.has(keyword)) {
            newActive.delete(keyword);
        } else {
            newActive.add(keyword);
        }
        setActiveKeywords(newActive);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(finalPrompt);
        // 可以加個 toast 提示
    };

    const applyToMain = () => {
        onPromptGenerate(finalPrompt);
    };

    if (files.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center opacity-50">
                <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <p className="text-xs">請先上傳圖片以使用反推功能</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">
            {/* Top Section: Analyze Button */}
            <div className="flex-shrink-0 flex flex-col gap-2">
                {/* Mode Selector */}
                <div className="flex bg-gray-500/10 p-1 rounded-xl">
                    <button
                        onClick={() => setPromptMode('general')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${promptMode === 'general'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        通用
                    </button>
                    <button
                        onClick={() => setPromptMode('interior')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${promptMode === 'interior'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        室內設計
                    </button>
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all ${isAnalyzing
                        ? 'bg-gray-500/10 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white shadow-lg hover:shadow-blue-500/25 active:scale-95'
                        }`}
                >
                    {isAnalyzing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>AI 分析中...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            <span>圖片反推提示詞</span>
                        </>
                    )}
                </button>
                {error && (
                    <div className="mt-2 text-xs text-red-400 text-center bg-red-500/10 py-1 px-2 rounded">
                        {error}
                    </div>
                )}
            </div>

            {/* Middle Section: Keywords */}
            <div className="flex-1 min-h-0 flex flex-col">
                <h3 className="text-xs font-semibold mb-2 opacity-70 flex items-center justify-between">
                    <span>AI 提取關鍵字</span>
                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                        {activeKeywords.size} / {categories.reduce((acc, c) => acc + c.keywords.length, 0)}
                    </span>
                </h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                    {categories.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            {categories.map((category, catIdx) => (
                                <div key={catIdx} className="space-y-2">
                                    {/* 只有當有多個分類時，或分類名稱不是預設值時才顯示標題 */}
                                    {(categories.length > 1 || category.name !== '關鍵字' && category.name !== '通用關鍵字') && (
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1 border-l-2 border-blue-500/30">
                                            {category.name}
                                        </h4>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        {category.keywords.map((keyword, idx) => (
                                            <button
                                                key={`${catIdx}-${idx}`}
                                                onClick={() => toggleKeyword(keyword)}
                                                className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 text-left ${activeKeywords.has(keyword)
                                                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                                                    : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/5'
                                                    }`}
                                            >
                                                {keyword}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs italic">
                            尚未分析，請點擊上方按鈕
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Section: Prompt Result */}
            <div className="flex-shrink-0 h-[25%] flex flex-col min-h-[80px]">
                <h3 className="text-xs font-semibold mb-2 opacity-70">組合提示詞</h3>
                <textarea
                    value={finalPrompt}
                    onChange={(e) => setFinalPrompt(e.target.value)}
                    className="flex-1 w-full p-3 rounded-xl resize-none text-xs leading-relaxed transition-all focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    style={{
                        background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                        color: isDark ? '#e5e7eb' : '#374151',
                    }}
                    placeholder="生成的提示詞將顯示在這裡..."
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        onClick={copyToClipboard}
                        disabled={!finalPrompt}
                        className="col-span-1 py-2 text-xs rounded-lg font-medium transition-colors bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-50"
                    >
                        複製
                    </button>
                    <button
                        onClick={applyToMain}
                        disabled={!finalPrompt}
                        className="col-span-1 py-2 text-xs rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:bg-gray-600"
                    >
                        應用到創作
                    </button>
                    <button
                        onClick={() => {
                            const stylePrompt = `(風格遷移) 請參考這張圖片的風格特徵：${finalPrompt}。將此風格應用於輸入的圖片，保持原圖內容但轉換為此藝術風格。`;
                            onPromptGenerate(stylePrompt);
                        }}
                        disabled={!finalPrompt}
                        className="col-span-2 py-2 text-xs rounded-lg font-medium transition-colors bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:bg-gray-600 flex items-center justify-center gap-2"
                        title="將提取的風格應用到新的創作中"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        風格遷移
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReversePromptPanel;
