import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { DirectoryTree } from './DirectoryTree';
import { FileGrid } from './FileGrid';
import { FolderIcon } from '../icons/FolderIcon';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { SearchIcon } from '../icons/SearchIcon';

// 類型定義
export interface FileItem {
    name: string;
    path: string;
    isDirectory: boolean;
    size?: number;
    mtime?: number;
    ext?: string;
}

export interface DriveInfo {
    letter: string;
    label: string;
    size?: number | string;
    freeSpace?: number | string;
}

interface FileExplorerPanelProps {
    onImageSelect?: (imagePath: string) => void;
    onDragToDesktop?: (imagePath: string) => void;
}

export const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({
    onImageSelect,
    onDragToDesktop
}) => {
    const { theme, themeName } = useTheme();
    const isDark = themeName !== 'light';

    // 狀態
    const [drives, setDrives] = useState<DriveInfo[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [pathHistory, setPathHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // 取得磁碟列表
    const loadDrives = useCallback(async () => {
        try {
            const api = (window as any).electronAPI?.fileExplorer;
            if (!api) {
                setError('File Explorer API not available');
                return;
            }
            const result = await api.listDrives();
            if (result.success) {
                setDrives(result.drives);
            } else {
                setError(result.error || 'Failed to list drives');
            }
        } catch (e: any) {
            setError(e.message);
        }
    }, []);

    // 讀取資料夾內容
    const loadDirectory = useCallback(async (dirPath: string) => {
        setLoading(true);
        setError(null);
        try {
            const api = (window as any).electronAPI?.fileExplorer;
            if (!api) {
                setError('File Explorer API not available');
                return;
            }
            const result = await api.readDir(dirPath);
            if (result.success) {
                setItems(result.items);
                setCurrentPath(dirPath);

                // 更新歷史紀錄
                const newHistory = pathHistory.slice(0, historyIndex + 1);
                newHistory.push(dirPath);
                setPathHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);

                // 開始監聽此資料夾
                await api.watchPath(dirPath);
            } else {
                setError(result.error || 'Failed to read directory');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [pathHistory, historyIndex]);

    // 返回上一層
    const goUp = useCallback(() => {
        if (!currentPath) return;
        const parent = currentPath.split(/[\\/]/).slice(0, -1).join('\\') || currentPath.slice(0, 3);
        if (parent && parent !== currentPath) {
            loadDirectory(parent);
        }
    }, [currentPath, loadDirectory]);

    // 歷史導航
    const goBack = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            const targetPath = pathHistory[newIndex];
            setCurrentPath(targetPath);

            const api = (window as any).electronAPI?.fileExplorer;
            if (api) {
                api.readDir(targetPath).then((result: any) => {
                    if (result.success) setItems(result.items);
                });
            }
        }
    }, [historyIndex, pathHistory]);

    const goForward = useCallback(() => {
        if (historyIndex < pathHistory.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            const targetPath = pathHistory[newIndex];
            setCurrentPath(targetPath);

            const api = (window as any).electronAPI?.fileExplorer;
            if (api) {
                api.readDir(targetPath).then((result: any) => {
                    if (result.success) setItems(result.items);
                });
            }
        }
    }, [historyIndex, pathHistory]);

    // 刷新
    const refresh = useCallback(() => {
        if (currentPath) {
            loadDirectory(currentPath);
        } else {
            loadDrives();
        }
    }, [currentPath, loadDirectory, loadDrives]);

    // 處理項目點擊
    const handleItemClick = useCallback((item: FileItem) => {
        if (item.isDirectory) {
            loadDirectory(item.path);
        } else {
            onImageSelect?.(item.path);
        }
    }, [loadDirectory, onImageSelect]);

    // 處理磁碟選擇
    const handleDriveSelect = useCallback((drive: DriveInfo) => {
        loadDirectory(drive.letter + '\\');
    }, [loadDirectory]);

    // 初始化 - 預設載入 output 資料夾
    useEffect(() => {
        const initExplorer = async () => {
            await loadDrives();

            // 嘗試載入預設 output 資料夾
            const api = (window as any).electronAPI?.fileExplorer;
            if (api?.getDefaultPath) {
                try {
                    const result = await api.getDefaultPath();
                    if (result.success && result.path) {
                        loadDirectory(result.path);
                    }
                } catch (e) {
                    console.error('Failed to load default path:', e);
                }
            }
        };

        initExplorer();

        // 監聽資料夾變化
        const api = (window as any).electronAPI?.fileExplorer;
        if (api?.onFolderChange) {
            const unsubscribe = api.onFolderChange((data: { type: string; path: string }) => {
                // 重新載入當前資料夾
                if (currentPath) {
                    api.readDir(currentPath).then((result: any) => {
                        if (result.success) setItems(result.items);
                    });
                }
            });
            return () => unsubscribe();
        }
    }, []);

    // 過濾項目
    const filteredItems = searchQuery
        ? items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : items;

    // 分隔路徑為麵包屑
    const breadcrumbs = currentPath
        ? currentPath.split(/[\\/]/).filter(Boolean)
        : [];

    return (
        <div className="flex flex-col h-full" style={{ background: theme.colors.bgPrimary }}>
            {/* 工具欄 */}
            <div
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{ borderColor: theme.colors.border }}
            >
                {/* 導航按鈕 */}
                <button
                    onClick={goBack}
                    disabled={historyIndex <= 0}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ color: theme.colors.textMuted }}
                    title="上一頁"
                >
                    <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                    onClick={goForward}
                    disabled={historyIndex >= pathHistory.length - 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 rotate-180"
                    style={{ color: theme.colors.textMuted }}
                    title="下一頁"
                >
                    <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                    onClick={goUp}
                    disabled={!currentPath}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ color: theme.colors.textMuted }}
                    title="上一層"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                </button>

                {/* 麵包屑導航 */}
                <div className="flex-1 flex items-center gap-1 overflow-x-auto">
                    <button
                        onClick={() => { setCurrentPath(''); setItems([]); }}
                        className="px-2 py-1 rounded text-xs font-medium hover:bg-white/10"
                        style={{ color: theme.colors.textPrimary }}
                    >
                        本機
                    </button>
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                            <span style={{ color: theme.colors.textMuted }}>/</span>
                            <button
                                onClick={() => {
                                    const targetPath = breadcrumbs.slice(0, index + 1).join('\\');
                                    loadDirectory(targetPath + (index === 0 ? '\\' : ''));
                                }}
                                className="px-2 py-1 rounded text-xs font-medium hover:bg-white/10 truncate max-w-[120px]"
                                style={{ color: theme.colors.textPrimary }}
                                title={crumb}
                            >
                                {crumb}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* 搜尋 & 刷新 */}
                <div className="flex items-center gap-2">
                    <div
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                    >
                        <SearchIcon className="w-3.5 h-3.5" style={{ color: theme.colors.textMuted }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜尋..."
                            className="bg-transparent border-none outline-none text-xs w-24"
                            style={{ color: theme.colors.textPrimary }}
                        />
                    </div>
                    <button
                        onClick={refresh}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
                        style={{ color: theme.colors.textMuted }}
                        title="重新整理"
                    >
                        <RefreshIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 主內容區 */}
            <div className="flex flex-1 min-h-0">
                {/* 左側樹狀目錄 */}
                <div
                    className="w-48 flex-shrink-0 border-r overflow-y-auto"
                    style={{ borderColor: theme.colors.border }}
                >
                    <DirectoryTree
                        drives={drives}
                        currentPath={currentPath}
                        onDriveSelect={handleDriveSelect}
                        onFolderSelect={(path) => loadDirectory(path)}
                    />
                </div>

                {/* 右側網格 */}
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: theme.colors.textMuted }}>
                            <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-sm">{error}</p>
                            <button
                                onClick={refresh}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                            >
                                重試
                            </button>
                        </div>
                    ) : !currentPath ? (
                        // 顯示磁碟列表
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {drives.map((drive) => (
                                <button
                                    key={drive.letter}
                                    onClick={() => handleDriveSelect(drive)}
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:scale-105"
                                    style={{
                                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                        border: `1px solid ${theme.colors.border}`
                                    }}
                                >
                                    <svg className="w-10 h-10 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H5v-2h9v2zm5-4H5v-2h14v2zm0-4H5V7h14v2z" />
                                    </svg>
                                    <div className="text-center">
                                        <p className="text-sm font-medium" style={{ color: theme.colors.textPrimary }}>
                                            {drive.label || drive.letter}
                                        </p>
                                        <p className="text-[10px]" style={{ color: theme.colors.textMuted }}>
                                            {drive.letter}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <FileGrid
                            items={filteredItems}
                            onItemClick={handleItemClick}
                            onDragStart={onDragToDesktop}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileExplorerPanel;
