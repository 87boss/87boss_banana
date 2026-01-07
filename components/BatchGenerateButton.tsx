import React from 'react';
import { ApiStatus } from '../types';

interface BatchGenerateButtonProps {
    onClick: () => void;
    disabled: boolean;
    status: ApiStatus;
    count: number;
}

export const BatchGenerateButton: React.FC<BatchGenerateButtonProps> = ({
    onClick,
    disabled,
    status,
    count
}) => {
    return (
        <div className="group relative" title={`批量生成 ${count} 張圖片`}>
            {/* 发光效果 - 紫色 */}
            <div className={`absolute -inset-3 bg-purple-500 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 animate-pulse transition-opacity duration-500 ${disabled ? 'hidden' : 'block'}`}></div>

            <button
                onClick={onClick}
                disabled={disabled || status === ApiStatus.Loading}
                className={`relative w-20 h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 ease-out
                    ${disabled
                        ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-700'
                        : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl hover:scale-105 active:scale-95 border border-white/20'
                    }
                `}
            >
                {status === ApiStatus.Loading ? (
                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <>
                        <div className="relative">
                            <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {/* Count Badge */}
                            <div className="absolute -top-1 -right-2 bg-white text-purple-600 text-[10px] font-bold px-1.5 rounded-full shadow-sm">
                                {count}
                            </div>
                        </div>
                        <span className="text-[10px] font-bold mt-0.5">批量生成</span>
                    </>
                )}
            </button>
        </div>
    );
};
