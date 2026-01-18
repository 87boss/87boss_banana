#!/usr/bin/env python3
"""
快速處理剩餘核心檔案的簡繁轉換
"""
import os
from opencc import OpenCC

cc = OpenCC('s2twp')

# 要處理的核心檔案列表
FILES = [
    r"D:\Dropbox\0000google\87boss_banana\components\SettingsModal.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\Desktop.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\CreativeLibrary.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\AddCreativeIdeaModal.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\GeneratedImageDisplay.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\HistoryStrip.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\HistoryDock.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\HistoryPanel.tsx", 
    r"D:\Dropbox\0000google\87boss_banana\components\ImageUploader.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\ImagePreviewModal.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\ImportCreativeModal.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\RunningHubGenerator.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\RunningHubProgress.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\PebblingCanvas\index.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\PebblingCanvas\CanvasNode.tsx",
    r"D:\Dropbox\0000google\87boss_banana\components\PebblingCanvas\Sidebar.tsx",
    r"D:\Dropbox\0000google\87boss_banana\services\geminiService.ts",
    r"D:\Dropbox\0000google\87boss_banana\services\veoService.ts",
    r"D:\Dropbox\0000google\87boss_banana\services\pebblingGeminiService.ts",
    r"D:\Dropbox\0000google\87boss_banana\services\storyLibrary.ts",
    r"D:\Dropbox\0000google\87boss_banana\electron\main.cjs",
]

for filepath in FILES:
    if not os.path.exists(filepath):
        print(f"⚠ 檔案不存在: {filepath}")
        continue
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        converted = cc.convert(content)
        if converted != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(converted)
            print(f"✓ {os.path.basename(filepath)}")
        else:
            print(f"- {os.path.basename(filepath)} (無需轉換)")
    except Exception as e:
        print(f"✗ {os.path.basename(filepath)}: {e}")

print("\n完成!")
