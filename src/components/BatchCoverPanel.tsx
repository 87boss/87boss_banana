import React, { useState } from 'react';
import { GenerateButton } from '../../components/GenerateButton'; // Assuming we can reuse or use a simple button
import { ApiStatus } from '../../types';
import { Sparkles, Layers, Type, AlignLeft, Hash, Share2, MapPin, BookOpen } from 'lucide-react';

interface BatchCoverData {
    theme: string;
    title: string;
    subtitle: string;
    footer: string;
    count: number;
    scene: string;
    plot: string;
    media: string;
}

interface BatchCoverPanelProps {
    onGenerate: (data: BatchCoverData) => Promise<string[] | void>; // Changed to return prompts
    onStartBatch: (prompts: string[]) => void;
    isLoading: boolean;
}

const BatchCoverPanel: React.FC<BatchCoverPanelProps> = ({ onGenerate, onStartBatch, isLoading }) => {
    const [media, setMedia] = useState('Instagram');
    const [theme, setTheme] = useState('');
    const [scene, setScene] = useState('');
    const [plot, setPlot] = useState('');
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [footer, setFooter] = useState('');
    const [count, setCount] = useState(4);

    const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
    const [isReviewing, setIsReviewing] = useState(false);
    const [promptsText, setPromptsText] = useState('');

    const mediaOptions = [
        'Instagram',
        'Facebook',
        'YouTube',
        'TikTok',
        'LINE',
        'LinkedIn',
        'Twitter (X)',
        'Threads',
        'Pinterest'
    ];

    const handleGeneratePrompts = async () => {
        if (!theme) {
            alert('請輸入封面主題 (Theme is required)');
            return;
        }
        const prompts = await onGenerate({ theme, title, subtitle, footer, count, scene, plot, media });
        if (prompts && Array.isArray(prompts) && prompts.length > 0) {
            setGeneratedPrompts(prompts);
            setPromptsText(prompts.join('\n\n'));
            setIsReviewing(true);

            // Auto-start generation as requested
            const finalPrompts = prompts.filter(p => p.trim().length > 0);
            onStartBatch(finalPrompts);
        }
    };

    const handleStartBatch = () => {
        // Split by double newline to get array back
        const finalPrompts = promptsText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        onStartBatch(finalPrompts);
        setIsReviewing(false);
        setGeneratedPrompts([]);
        setPromptsText('');
    };

    return (
        <div className="flex flex-col h-full bg-black/20 backdrop-blur-sm text-white select-none">
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b border-white/10">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-sm">批量封面 (Batch Cover)</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar">
                {/* Media Select */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Share2 className="w-3 h-3" /> 媒體平台 (Media)
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
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none h-20"
                    />
                </div>

                {/* Scene Input */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> 場景 (Scene)
                    </label>
                    <input
                        type="text"
                        value={scene}
                        onChange={(e) => setScene(e.target.value)}
                        placeholder="例如：繁忙的咖啡廳、外太空、寧靜的書房..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    />
                </div>

                {/* Plot Input */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3" /> 劇情 (Plot)
                    </label>
                    <textarea
                        value={plot}
                        onChange={(e) => setPlot(e.target.value)}
                        placeholder="簡述故事背景或情節..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none h-16"
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
                            <span>生成並開始繪圖 (Generate & Start)</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default BatchCoverPanel;
