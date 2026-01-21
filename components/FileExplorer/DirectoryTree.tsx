import React, { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { DriveInfo } from './FileExplorerPanel';
import { FolderIcon } from '../icons/FolderIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';

interface TreeNode {
    path: string;
    name: string;
    isExpanded: boolean;
    children: TreeNode[];
    isLoading: boolean;
}

interface DirectoryTreeProps {
    drives: DriveInfo[];
    currentPath: string;
    onDriveSelect: (drive: DriveInfo) => void;
    onFolderSelect: (path: string) => void;
}

export const DirectoryTree: React.FC<DirectoryTreeProps> = ({
    drives,
    currentPath,
    onDriveSelect,
    onFolderSelect
}) => {
    const { theme, themeName } = useTheme();
    const isDark = themeName !== 'light';

    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [folderContents, setFolderContents] = useState<Map<string, TreeNode[]>>(new Map());
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

    // 載入資料夾的子目錄
    const loadChildren = useCallback(async (parentPath: string) => {
        if (loadingPaths.has(parentPath)) return;

        setLoadingPaths(prev => new Set([...prev, parentPath]));

        try {
            const api = (window as any).electronAPI?.fileExplorer;
            if (!api) return;

            const result = await api.readDir(parentPath);
            if (result.success) {
                const folders = result.items
                    .filter((item: any) => item.isDirectory)
                    .map((item: any) => ({
                        path: item.path,
                        name: item.name,
                        isExpanded: false,
                        children: [],
                        isLoading: false
                    }));

                setFolderContents(prev => new Map(prev).set(parentPath, folders));
            }
        } catch (e) {
            console.error('Failed to load children:', e);
        } finally {
            setLoadingPaths(prev => {
                const next = new Set(prev);
                next.delete(parentPath);
                return next;
            });
        }
    }, [loadingPaths]);

    // 切換資料夾展開/收合
    const toggleExpand = useCallback((path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
                // 載入子目錄
                if (!folderContents.has(path)) {
                    loadChildren(path);
                }
            }
            return next;
        });
    }, [folderContents, loadChildren]);

    // 渲染樹節點
    const renderTreeNode = (node: TreeNode, depth: number = 0) => {
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = currentPath === node.path || currentPath.startsWith(node.path + '\\');
        const isLoading = loadingPaths.has(node.path);
        const children = folderContents.get(node.path) || [];

        return (
            <div key={node.path}>
                <div
                    className="flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors rounded-md group"
                    style={{
                        marginLeft: depth * 12,
                        background: isSelected ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)') : 'transparent'
                    }}
                    onClick={() => onFolderSelect(node.path)}
                >
                    {/* 展開箭頭 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(node.path);
                        }}
                        className={`w-4 h-4 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        style={{ color: theme.colors.textMuted }}
                    >
                        {isLoading ? (
                            <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <ChevronRightIcon className="w-3 h-3" />
                        )}
                    </button>

                    {/* 資料夾圖示 */}
                    <FolderIcon
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: isExpanded ? '#fbbf24' : '#60a5fa' }}
                    />

                    {/* 名稱 */}
                    <span
                        className="text-xs truncate flex-1"
                        style={{ color: isSelected ? '#60a5fa' : theme.colors.textPrimary }}
                        title={node.name}
                    >
                        {node.name}
                    </span>
                </div>

                {/* 子節點 */}
                {isExpanded && children.length > 0 && (
                    <div>
                        {children.map(child => renderTreeNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="py-2">
            {/* 磁碟列表 */}
            <div className="px-2 mb-2">
                <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: theme.colors.textMuted }}
                >
                    磁碟
                </p>
            </div>

            {drives.map(drive => {
                const drivePath = drive.letter + '\\';
                const isExpanded = expandedPaths.has(drivePath);
                const isSelected = currentPath.startsWith(drivePath);
                const children = folderContents.get(drivePath) || [];

                return (
                    <div key={drive.letter}>
                        <div
                            className="flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors rounded-md mx-1"
                            style={{
                                background: isSelected ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)') : 'transparent'
                            }}
                            onClick={() => onDriveSelect(drive)}
                        >
                            {/* 展開箭頭 */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(drivePath);
                                }}
                                className={`w-4 h-4 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                style={{ color: theme.colors.textMuted }}
                            >
                                {loadingPaths.has(drivePath) ? (
                                    <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ChevronRightIcon className="w-3 h-3" />
                                )}
                            </button>

                            {/* 磁碟圖示 */}
                            <svg className="w-4 h-4 flex-shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H5v-2h9v2zm5-4H5v-2h14v2zm0-4H5V7h14v2z" />
                            </svg>

                            {/* 名稱 */}
                            <span
                                className="text-xs truncate flex-1 font-medium"
                                style={{ color: isSelected ? '#60a5fa' : theme.colors.textPrimary }}
                            >
                                {drive.label || drive.letter}
                            </span>
                        </div>

                        {/* 子資料夾 */}
                        {isExpanded && children.length > 0 && (
                            <div className="ml-2">
                                {children.map(child => renderTreeNode(child, 1))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default DirectoryTree;
