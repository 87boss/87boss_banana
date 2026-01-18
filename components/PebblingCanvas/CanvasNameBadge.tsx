import React from 'react';
import { Icons } from './Icons';

interface CanvasNameBadgeProps {
  canvasName: string;
  isLoading?: boolean;
  hasUnsavedChanges?: boolean;
}

/**
 * 畫布名稱標識元件
 * 獨立模組，顯示當前畫布名稱
 * 位置：左上角，側邊欄右側
 */
const CanvasNameBadge: React.FC<CanvasNameBadgeProps> = ({
  canvasName,
  isLoading = false,
  hasUnsavedChanges = false,
}) => {
  return (
    <div className="fixed left-24 top-6 z-30 pointer-events-auto">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg">
        {/* 畫布圖示 */}
        <div className="w-5 h-5 flex items-center justify-center">
          {isLoading ? (
            <svg className="w-4 h-4 text-zinc-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <Icons.Layout className="w-4 h-4 text-emerald-400" />
          )}
        </div>
        
        {/* 畫布名稱 */}
        <span className="text-sm font-medium text-white max-w-[160px] truncate">
          {isLoading ? '載入中...' : canvasName}
        </span>
        
        {/* 未儲存標記 */}
        {hasUnsavedChanges && !isLoading && (
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="有未儲存的修改" />
        )}
      </div>
    </div>
  );
};

export default CanvasNameBadge;
