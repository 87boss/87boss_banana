import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { useTheme } from '../../contexts/ThemeContext';
import { FileItem } from './FileExplorerPanel';
import { FolderIcon } from '../icons/FolderIcon';

interface FileGridProps {
    items: FileItem[];
    onItemClick: (item: FileItem) => void;
    onDragStart?: (imagePath: string) => void;
    onCopyToDesktop?: (localUrl: string, fileName: string) => void;
}

// 縮圖快取
const thumbnailCache = new Map<string, string>();

// 右鍵選單項目
interface ContextMenuItem {
    label: string;
    icon: string;
    action: () => void;
    divider?: boolean;
}

export const FileGrid: React.FC<FileGridProps> = ({
    items,
    onItemClick,
    onDragStart,
    onCopyToDesktop
}) => {
    const { theme, themeName } = useTheme();
    const isDark = themeName !== 'light';
    const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());

    // 右鍵選單狀態
    const [contextMenu, setContextMenu] = useState<{
        show: boolean;
        x: number;
        y: number;
        item: FileItem | null;
    }>({ show: false, x: 0, y: 0, item: null });

    // 關閉右鍵選單
    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, show: false }));
        window.addEventListener('click', handleClick);
        window.addEventListener('contextmenu', handleClick);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('contextmenu', handleClick);
        };
    }, []);

    // 載入縮圖
    const loadThumbnail = useCallback(async (item: FileItem) => {
        if (item.isDirectory) return;
        if (thumbnailCache.has(item.path)) {
            setThumbnails(prev => new Map(prev).set(item.path, thumbnailCache.get(item.path)!));
            return;
        }

        try {
            const api = (window as any).electronAPI?.fileExplorer;
            if (!api) return;

            const result = await api.getThumbnail(item.path, 160);
            if (result.success) {
                thumbnailCache.set(item.path, result.dataUrl);
                setThumbnails(prev => new Map(prev).set(item.path, result.dataUrl));
            }
        } catch (e) {
            console.error('Failed to load thumbnail:', e);
        }
    }, []);

    // 右鍵選單處理
    const handleContextMenu = useCallback((e: React.MouseEvent, item: FileItem) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            item
        });
    }, []);

    // 右鍵選單動作
    const handleOpenInExplorer = useCallback(async () => {
        if (!contextMenu.item) return;
        const api = (window as any).electronAPI?.fileExplorer;
        if (api) await api.openInExplorer(contextMenu.item.path);
    }, [contextMenu.item]);

    const handleCopyPath = useCallback(async () => {
        if (!contextMenu.item) return;
        const api = (window as any).electronAPI?.fileExplorer;
        if (api) await api.copyPath(contextMenu.item.path);
    }, [contextMenu.item]);

    const handleCopyToDesktop = useCallback(async () => {
        if (!contextMenu.item || contextMenu.item.isDirectory) return;
        const api = (window as any).electronAPI?.fileExplorer;
        if (api) {
            const result = await api.copyToDesktop(contextMenu.item.path);
            if (result.success && onCopyToDesktop) {
                onCopyToDesktop(result.localUrl, result.fileName);
            }
        }
    }, [contextMenu.item, onCopyToDesktop]);

    // 拖拽處理
    const handleDragStart = useCallback((e: React.DragEvent, item: FileItem) => {
        if (item.isDirectory) return;
        e.dataTransfer.setData('text/plain', item.path);
        e.dataTransfer.setData('application/x-file-explorer-path', item.path);
        onDragStart?.(item.path);
    }, [onDragStart]);

    // 格式化檔案大小
    const formatSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // 渲染單個項目
    const ItemComponent = useCallback(({ item }: { item: FileItem }) => {
        const thumbnail = thumbnails.get(item.path);

        // 延遲載入縮圖
        useEffect(() => {
            if (!item.isDirectory && !thumbnail && !thumbnailCache.has(item.path)) {
                const timer = setTimeout(() => loadThumbnail(item), 50);
                return () => clearTimeout(timer);
            }
        }, [item, thumbnail]);

        return (
            <div
                className="flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all hover:scale-105 group"
                style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                }}
                onClick={() => onItemClick(item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                draggable={!item.isDirectory}
                onDragStart={(e) => handleDragStart(e, item)}
            >
                {/* 縮圖/圖示 */}
                <div
                    className="w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center mb-2"
                    style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    }}
                >
                    {item.isDirectory ? (
                        <FolderIcon className="w-12 h-12 text-amber-400" />
                    ) : thumbnail ? (
                        <img
                            src={thumbnail}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                </div>

                {/* 名稱 */}
                <p
                    className="text-[11px] text-center truncate w-full font-medium"
                    style={{ color: theme.colors.textPrimary }}
                    title={item.name}
                >
                    {item.name}
                </p>

                {/* 大小 (僅檔案) */}
                {!item.isDirectory && item.size && (
                    <p
                        className="text-[9px] text-center"
                        style={{ color: theme.colors.textMuted }}
                    >
                        {formatSize(item.size)}
                    </p>
                )}
            </div>
        );
    }, [thumbnails, isDark, theme, onItemClick, handleDragStart, loadThumbnail, handleContextMenu]);

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: theme.colors.textMuted }}>
                <FolderIcon className="w-16 h-16 opacity-30" />
                <p className="text-sm">此資料夾是空的</p>
            </div>
        );
    }

    return (
        <>
            <VirtuosoGrid
                style={{ height: '100%' }}
                totalCount={items.length}
                overscan={10}
                listClassName="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-3"
                itemContent={(index) => <ItemComponent item={items[index]} />}
            />

            {/* 右鍵選單 */}
            {contextMenu.show && contextMenu.item && (
                <div
                    className="fixed z-[9999] py-1 rounded-lg shadow-xl border min-w-[160px]"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                        background: isDark ? 'rgba(30,30,40,0.98)' : 'rgba(255,255,255,0.98)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        backdropFilter: 'blur(12px)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 複製到桌面 (僅圖片) */}
                    {!contextMenu.item.isDirectory && (
                        <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-500/20 transition-colors"
                            style={{ color: theme.colors.textPrimary }}
                            onClick={handleCopyToDesktop}
                        >
                            <span>📥</span>
                            <span>複製到桌面</span>
                        </button>
                    )}

                    {/* 在檔案總管中開啟 */}
                    <button
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-500/20 transition-colors"
                        style={{ color: theme.colors.textPrimary }}
                        onClick={handleOpenInExplorer}
                    >
                        <span>📂</span>
                        <span>在檔案總管中開啟</span>
                    </button>

                    {/* 分隔線 */}
                    <div className="my-1 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />

                    {/* 複製路徑 */}
                    <button
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-500/20 transition-colors"
                        style={{ color: theme.colors.textPrimary }}
                        onClick={handleCopyPath}
                    >
                        <span>📋</span>
                        <span>複製路徑</span>
                    </button>
                </div>
            )}
        </>
    );
};

export default FileGrid;
