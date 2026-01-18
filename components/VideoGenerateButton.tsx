import React from 'react';
import { ApiStatus } from '../types';

interface VideoGenerateButtonProps {
    onClick: () => void;
    disabled: boolean;
    status: ApiStatus;
}

export const VideoGenerateButton: React.FC<VideoGenerateButtonProps> = ({
    onClick,
    disabled,
    status
}) => {
    // 處理載入狀態
    const isLoading = status === ApiStatus.Loading;

    return (
        <div className="group relative ml-4" title="生成影片">
            {/* Hexagon Clip Path Definition - hidden but used for shadow calculation via drop-shadow if needed, 
                but CSS clip-path is better for the button itself.
                We'll use a CSS clip-path for the hexagon shape.
            */}

            {/* Glow Effect */}
            <div
                className={`absolute inset-0 bg-purple-500 rounded-lg blur-lg opacity-40 group-hover:opacity-60 animate-pulse transition-opacity duration-500 ${disabled ? 'hidden' : 'block'}`}
                style={{
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    transform: 'scale(1.2)'
                }}
            ></div>

            <button
                onClick={onClick}
                disabled={disabled || isLoading}
                className={`relative w-16 h-16 flex items-center justify-center transition-all duration-200 ease-out
                    ${disabled
                        ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                        : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl hover:scale-105 active:scale-95'
                    }
                `}
                style={{
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                }}
            >
                {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-0.5 mt-1">
                        <svg className="w-5 h-5 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-wide">影片</span>
                    </div>
                )}
            </button>
        </div>
    );
};
