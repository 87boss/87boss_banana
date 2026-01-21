import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Star, Search, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { appService } from '../../services/runningHub/appService';
import { getFavoriteApps, getWebappDetail } from '../../services/runningHub/api';
import type { AppPoolItem } from '../../services/runningHub/types';

interface AppSelectorProps {
    apiKey: string;
    onSelectApp: (app: AppPoolItem) => void;
    isLoading?: boolean;
}

export function AppSelector({ apiKey, onSelectApp, isLoading: externalLoading }: AppSelectorProps) {
    const [apps, setApps] = useState<AppPoolItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [newAppId, setNewAppId] = useState('');
    const [isAddingApp, setIsAddingApp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 載入應用列表
    const loadApps = useCallback(() => {
        const savedApps = appService.getAppPool();
        setApps(savedApps);
    }, []);

    useEffect(() => {
        loadApps();
    }, [loadApps]);

    // 從 URL 或 ID 獲取 webapp ID
    const extractWebappId = (input: string): string => {
        const trimmed = input.trim();
        // 嘗試從 URL 提取
        const urlMatch = trimmed.match(/webapp\/([a-zA-Z0-9]+)/);
        if (urlMatch) return urlMatch[1];
        // 直接返回 ID
        return trimmed;
    };

    // 添加新應用 - 獲取詳細資訊
    const handleAddApp = useCallback(async () => {
        if (!newAppId.trim()) return;

        const webappId = extractWebappId(newAppId);
        setIsAddingApp(true);
        setError(null);

        try {
            // 獲取應用詳情
            const detail = await getWebappDetail(apiKey, webappId);

            // 創建應用資訊
            const newApp: AppPoolItem = {
                id: webappId,
                webappId: webappId,
                name: detail.webappName || `應用 ${webappId.slice(0, 8)}...`,
                thumbnailUrl: detail.covers?.[0]?.thumbnailUri || detail.covers?.[0]?.url || undefined,
                addedAt: Date.now(),
                isLocalFavorite: false,
            };

            const currentApps = appService.getAppPool();
            // 檢查是否已存在
            if (!currentApps.find(a => a.id === webappId || a.webappId === webappId)) {
                appService.saveAppPool([...currentApps, newApp]);
            }

            setNewAppId('');
            loadApps();
        } catch (err: any) {
            setError(err.message || '添加應用失敗，請確認 ID 正確');
        } finally {
            setIsAddingApp(false);
        }
    }, [apiKey, newAppId, loadApps]);

    // 過濾應用
    const filteredApps = apps.filter(app =>
        app.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 收藏的應用優先
    const sortedApps = [...filteredApps].sort((a, b) => {
        if (a.isLocalFavorite && !b.isLocalFavorite) return -1;
        if (!a.isLocalFavorite && b.isLocalFavorite) return 1;
        return (b.addedAt || 0) - (a.addedAt || 0);
    });

    return (
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* 搜索和添加 */}
            <div className="flex-shrink-0 mb-6 space-y-4">
                {/* 搜索框 */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索應用..."
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-all"
                    />
                </div>

                {/* 添加新應用 */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newAppId}
                        onChange={(e) => setNewAppId(e.target.value)}
                        placeholder="輸入 Webapp ID 或 URL"
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddApp()}
                    />
                    <button
                        onClick={handleAddApp}
                        disabled={isAddingApp || !newAppId.trim()}
                        className="px-4 py-3 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isAddingApp ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Plus className="w-5 h-5" />
                        )}
                        添加
                    </button>
                </div>

                {error && (
                    <p className="text-sm text-red-400">{error}</p>
                )}
            </div>

            {/* 應用列表 */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                    </div>
                ) : sortedApps.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p className="mb-2">尚無應用</p>
                        <p className="text-sm">輸入 Webapp ID 添加您的第一個應用</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sortedApps.map((app) => (
                            <button
                                key={app.id}
                                onClick={() => onSelectApp(app)}
                                disabled={externalLoading}
                                className="group relative p-4 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10 hover:border-purple-500/30 transition-all disabled:opacity-50"
                            >
                                {/* 收藏標記 */}
                                {app.isLocalFavorite && (
                                    <Star className="absolute top-3 right-3 w-4 h-4 text-yellow-400 fill-yellow-400" />
                                )}

                                {/* 縮略圖 */}
                                <div className="w-full aspect-video mb-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center overflow-hidden">
                                    {app.thumbnailUrl ? (
                                        <img
                                            src={app.thumbnailUrl}
                                            alt={app.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <ExternalLink className="w-8 h-8 text-purple-400" />
                                    )}
                                </div>

                                {/* 名稱 */}
                                <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                                    {app.name || app.id}
                                </h3>

                                {/* 描述 */}
                                {app.intro && (
                                    <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                                        {app.intro}
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
