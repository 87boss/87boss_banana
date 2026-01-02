import React, { useState, useCallback } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';
import { UploadIcon } from './icons/UploadIcon';
import { useTheme } from '../contexts/ThemeContext';

interface WelcomeScreenProps {
  onUploadClick: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onUploadClick }) => {
  const { theme } = useTheme();

  return (
    <div className="w-full h-full flex items-center justify-center p-8 text-center animate-fade-in">
      <div className="max-w-md">
        <div className="mx-auto w-16 h-16 mb-5 flex items-center justify-center rounded-full bg-blue-500 shadow-lg">
          <SparklesIcon className="w-8 h-8 text-white" />
        </div>
        <h2
          className="text-3xl font-bold mb-2"
          style={{ color: theme.colors.textPrimary }}
        >
          欢迎来到 87Boss UI
        </h2>
        <p
          className="text-base mb-6"
          style={{ color: theme.colors.textMuted }}
        >
          直接輸入提示詞生成圖片，或上傳圖片進行編輯創作
        </p>
        <button
          onClick={onUploadClick}
          className="font-medium py-2.5 px-5 rounded-lg text-sm transition-all duration-300 flex items-center justify-center gap-2 mx-auto"
          style={{
            backgroundColor: theme.colors.bgTertiary,
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          <UploadIcon className="w-4 h-4" />
          <span>上傳參考圖（可選）</span>
        </button>
      </div>
    </div>
  );
};