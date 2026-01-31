import React, { useState } from 'react';
import { GenerateButton } from '../../components/GenerateButton'; // Assuming we can reuse or use a simple button
import { ApiStatus } from '../../types';
import { Sparkles, Layers, Type, AlignLeft, Hash, Share2, MapPin, BookOpen } from 'lucide-react';

interface BatchCoverData {
    theme: string;
    title: string;
    subtitle: string;
    footer: string;
    textEffect: string;
    count: number;
    // scene: string; // Removed
    // plot: string; // Removed
    media: string;
}

interface BatchCoverPanelProps {
    onGenerate: (data: BatchCoverData) => Promise<string[] | void>;
    onStartBatch: (prompts: string[], mode: 'banana' | 'runninghub') => void;
    isLoading: boolean;
}

const BatchCoverPanel: React.FC<BatchCoverPanelProps> = ({ onGenerate, onStartBatch, isLoading }) => {
    const [media, setMedia] = useState('Instagram');
    const [theme, setTheme] = useState('');
    // const [scene, setScene] = useState(''); // Removed
    // const [plot, setPlot] = useState(''); // Removed
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [footer, setFooter] = useState('');
    const [textEffect, setTextEffect] = useState('無特效 (None)');
    const [count, setCount] = useState(4);

    const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
    const [isReviewing, setIsReviewing] = useState(false);
    const [promptsText, setPromptsText] = useState('');

    const [customStyle, setCustomStyle] = useState('');

    const mediaOptions = [
        'VOGUE (時尚)',
        'TIME (時代雜誌)',
        'National Geographic (國家地理)',
        'POPEYE (日系潮流)',
        'BRUTUS (日系生活)',
        'NON-NO (日系清新)',
        'FUDGE (英倫復古)',
        'GQ (紳士風格)',
        'Esquire (君子雜誌)',
        'Kinfolk (極簡生活)',
        'W Korea (韓系前衛)',
        '隨機風格 (Random)',
        '自訂風格 (Custom)'
    ];

    const textEffectOptions = [
        '無特效 (None)', '金屬質感 (Metal)', '玻璃質感 (Glass)', '水晶質感 (Crystal)',
        '霓虹 (Neon)', '火焰 (Fire)', '冰霜 (Ice)', '木質 (Wood)', '石質感 (Stone)', '3D立體 (3D)'
    ];

    const handleGeneratePrompts = async () => {
        if (!theme) {
            alert('請輸入封面主題 (Theme is required)');
            return;
        }

        // Determine final style
        let finalStyle = media;
        if (media.includes('Custom') || media === '自訂風格 (Custom)') {
            if (!customStyle.trim()) {
                alert('請輸入自訂風格 (Please enter a custom style)');
                return;
            }
            finalStyle = customStyle;
        } else if (media.includes('Random') || media === '隨機風格 (Random)') {
            // Let backend handle random, or pick here? 
            // Logic: Pass "Random" to backend and let it decide to ensure variety per prompt?
            // Or pick one random local?
            // Prompt says "distinct prompts", so "Random" passed to backend is better for variety.
            finalStyle = 'Random Magazine Style';
        }

        const prompts = await onGenerate({ theme, title, subtitle, footer, textEffect, count, media: finalStyle } as any);
        if (prompts && Array.isArray(prompts) && prompts.length > 0) {
            setGeneratedPrompts(prompts);
            setPromptsText(prompts.join('\n\n'));
            setIsReviewing(true);
        }
    };

    const handleStartValues = (mode: 'banana' | 'runninghub') => {
        const finalPrompts = promptsText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        if (finalPrompts.length === 0) {
            alert("請先生成提示詞 (Please generate prompts first)");
            return;
        }
        onStartBatch(finalPrompts, mode);
    };

    return (
        <div className="flex flex-col h-full bg-black/20 backdrop-blur-sm text-white select-none">
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b border-white/10">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-sm">批量封面 (Batch Cover)</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar">
                {/* Magazine Style Select */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3" /> 雜誌風格 (Magazine Style)
                    </label>
                    <select
                        value={media}
                        onChange={(e) => setMedia(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer hover:bg-white/5"
                    >
                        {mediaOptions.map(opt => (
                            <option key={opt} value={opt} className="bg-gray-900">{opt}</option>
                        ))}
                    </select>

                    {/* Custom Style Input */}
                    {(media === '自訂風格 (Custom)' || media.includes('Custom')) && (
                        <input
                            type="text"
                            value={customStyle}
                            onChange={(e) => setCustomStyle(e.target.value)}
                            placeholder="輸入您的自訂風格..."
                            className="w-full mt-2 bg-black/40 border border-purple-500/30 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all animate-in fade-in slide-in-from-top-1"
                        />
                    )}
                </div>

                {/* Theme Input */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> 封面主題 (Theme)
                    </label>
                    <textarea
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        placeholder="例如：科技感、極簡主義、大自然風格..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none h-32"
                    />
                </div>

                {/* Title Input */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Type className="w-3 h-3" /> 主標題 (Main Title)
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="封面大標題"
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    />
                </div>

                {/* Subtitle Input */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <AlignLeft className="w-3 h-3" /> 副標題 (Subtitle)
                    </label>
                    <input
                        type="text"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="補充說明文字"
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    />
                </div>

                {/* Footer Input */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Type className="w-3 h-3" /> 右下角小字 (Footer)
                    </label>
                    <input
                        type="text"
                        value={footer}
                        onChange={(e) => setFooter(e.target.value)}
                        placeholder="例如：作者、日期、公司名"
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    />
                </div>

                {/* Text Effect Select */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> 文字特效 (Text Effect)
                    </label>
                    <select
                        value={textEffect}
                        onChange={(e) => setTextEffect(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer hover:bg-white/5"
                    >
                        {textEffectOptions.map(opt => (
                            <option key={opt} value={opt} className="bg-gray-900">{opt}</option>
                        ))}
                    </select>
                </div>

                {/* Count Input */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Hash className="w-3 h-3" /> 生成數量 (Quantity: 1-10)
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                            className="flex-1 accent-purple-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="w-8 text-center text-xs font-medium text-white bg-white/10 rounded px-1 py-0.5">
                            {count}
                        </span>
                    </div>
                </div>

                {/* Prompt Editor */}
                {isReviewing && (
                    <div className="space-y-2 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <AlignLeft className="w-3 h-3" /> 編輯提示詞 (Edit Prompts)
                        </label>
                        <textarea
                            value={promptsText}
                            onChange={(e) => setPromptsText(e.target.value)}
                            placeholder="Generated prompts will appear here..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none h-40 font-mono"
                        />
                    </div>
                )}
            </div>


            {/* Footer / Action */}
            <div className="p-4 border-t border-white/10 bg-black/20 space-y-2">
                <button
                    onClick={handleGeneratePrompts}
                    disabled={isLoading}
                    className="w-full h-10 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>生成設計中...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isReviewing ? "重新生成提示詞 (Regenerate)" : "生成提示詞 (Generate Prompts)"}</span>
                        </>
                    )}
                </button>

                {isReviewing && !isLoading && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                            onClick={() => handleStartValues('banana')}
                            className="h-10 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-500 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
                        >
                            <span>🍌 Banana (Gemini)</span>
                        </button>
                        <button
                            onClick={() => handleStartValues('runninghub')}
                            className="h-10 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
                        >
                            <span>🏃 RunningHub</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BatchCoverPanel;
