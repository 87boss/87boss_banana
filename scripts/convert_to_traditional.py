#!/usr/bin/env python3
"""
將專案中的簡體中文轉換為繁體中文
"""
import os
import sys
from opencc import OpenCC

# 初始化 OpenCC 轉換器 (簡體 -> 繁體台灣)
cc = OpenCC('s2twp')

# 要處理的檔案副檔名
EXTENSIONS = {'.tsx', '.ts', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.html', '.bat', '.py', '.cjs', '.command'}

# 要跳過的目錄
SKIP_DIRS = {'node_modules', '.git', 'dist', 'release', 'magic_0116', '.qoder', 'node_modules_trash_01', '.venv', 'venv', '__pycache__', '.gemini'}

# 要跳過的檔案
SKIP_FILES = {'package-lock.json', 'convert_to_traditional.py'}

def convert_file(filepath):
    """轉換單個檔案"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 轉換
        converted = cc.convert(content)
        
        # 如果有變化則寫入
        if converted != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(converted)
            return True
        return False
    except Exception as e:
        print(f"  錯誤處理 {filepath}: {e}")
        return False

def main():
    base_dir = r"D:\Dropbox\0000google\87boss_banana"
    converted_count = 0
    scanned_count = 0
    
    for root, dirs, files in os.walk(base_dir):
        # 跳過指定目錄
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        
        for filename in files:
            # 檢查副檔名
            ext = os.path.splitext(filename)[1].lower()
            if ext not in EXTENSIONS:
                continue
            
            # 跳過指定檔案
            if filename in SKIP_FILES:
                continue
            
            filepath = os.path.join(root, filename)
            scanned_count += 1
            
            if convert_file(filepath):
                rel_path = os.path.relpath(filepath, base_dir)
                print(f"✓ 已轉換: {rel_path}")
                converted_count += 1
    
    print(f"\n完成! 掃描 {scanned_count} 個檔案，轉換 {converted_count} 個檔案")

if __name__ == '__main__':
    main()
