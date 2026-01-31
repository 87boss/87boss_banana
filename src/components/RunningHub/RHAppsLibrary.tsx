import React, { useState, useEffect } from 'react';
import { Trash2, Box, CheckCircle } from "lucide-react";
import { getTranslation, rhTranslations } from "../../utils/rhTranslations";
import { simplifiedToTraditional } from "../../utils/cn2tw";
import { getWebappDetail } from "../../services/runningHub/api";
import { RefreshCw, Loader2 } from "lucide-react";

interface SavedApp {
    id: string;
    name: string;
    iconUrl?: string;
    timestamp: number;
}

interface RHAppsLibraryProps {
    onSelectApp: (appId: string) => void;
    className?: string;
    disableScroll?: boolean;
}

export const RHAppsLibrary: React.FC<RHAppsLibraryProps> = ({ onSelectApp, className, disableScroll = false }) => {
    const [savedApps, setSavedApps] = useState<SavedApp[]>([]);

    // 加载保存的应用
    const loadApps = () => {
        try {
            const stored = localStorage.getItem('rh_saved_apps');
            if (stored) {
                setSavedApps(JSON.parse(stored));
            } else {
                setSavedApps([]);
            }
        } catch (e) {
            console.error('Failed to load saved apps:', e);
            setSavedApps([]);
        }
    };

    useEffect(() => {
        loadApps();
        // 监听 storage 事件以支持跨组件更新
        window.addEventListener('storage', loadApps);
        window.addEventListener('rh_apps_updated', loadApps);
        return () => {
            window.removeEventListener('storage', loadApps);
            window.removeEventListener('rh_apps_updated', loadApps);
        };
    }, []);



    // [NEW] API Key for Sync
    const getStoredApiKey = () => localStorage.getItem('rh_api_key') || '';
    const [isSyncing, setIsSyncing] = useState(false);

    // [NEW] Sync Names Logic
    const handleSyncNames = async () => {
        const apiKey = getStoredApiKey();
        if (!apiKey) {
            alert(getTranslation('labels.configureApiKey'));
            return;
        }

        setIsSyncing(true);
        const stored = localStorage.getItem('rh_saved_apps');
        const currentApps: SavedApp[] = stored ? JSON.parse(stored) : [];
        let updatedCount = 0;

        // Deep copy to modify
        const updatedApps = [...currentApps];

        try {
            for (let i = 0; i < updatedApps.length; i++) {
                const app = updatedApps[i];
                try {
                    const detail = await getWebappDetail(apiKey, app.id);
                    // [NEW] Logic: Extract name from description (strip HTML) first
                    let newName = '';
                    if (detail.description && detail.description.trim()) {
                        newName = detail.description.replace(/<[^>]*>/g, '').trim();
                    }

                    if (!newName && detail.webappName) {
                        newName = detail.webappName;
                    }

                    if (newName) {
                        // Priority: Mapped -> (Simplified->Traditional of extracted name)
                        const mappedName = (rhTranslations.appNames as Record<string, string>)[newName];
                        const localizedName = mappedName || simplifiedToTraditional(newName);

                        let hasChange = false;
                        if (localizedName && localizedName !== app.name) {
                            updatedApps[i].name = localizedName;
                            hasChange = true;
                        }

                        // [NEW] Logic: Sync Icon URL from covers
                        let newIconUrl = app.iconUrl;
                        if (detail.covers && detail.covers.length > 0) {
                            newIconUrl = detail.covers[0].thumbnailUri || detail.covers[0].url || '';
                        }

                        if (newIconUrl !== app.iconUrl) {
                            updatedApps[i].iconUrl = newIconUrl;
                            hasChange = true;
                        }

                        if (hasChange) {
                            updatedCount++;
                            console.log(`[RHAppsLibrary] Updated app ${app.id}: name=${localizedName}, icon=${!!newIconUrl}`);
                        }
                    }
                } catch (err) {
                    console.warn(`[RHAppsLibrary] Failed to sync app ${app.id}`, err);
                }
                // Small delay to avoid rate limits
                await new Promise(r => setTimeout(r, 200));
            }

            if (updatedCount > 0) {
                localStorage.setItem('rh_saved_apps', JSON.stringify(updatedApps));
                setSavedApps(updatedApps);
                window.dispatchEvent(new Event('rh_apps_updated'));
                alert(getTranslation('labels.syncComplete', { count: updatedCount }));
            } else {
                alert(getTranslation('labels.syncNoChanges'));
            }

        } catch (e) {
            console.error('Sync failed:', e);
            alert(getTranslation('labels.syncFailed'));
        } finally {
            setIsSyncing(false);
        }
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleDelete = (e: React.MouseEvent, appId: string) => {
        e.stopPropagation();
        if (confirmDeleteId === appId) {
            try {
                // 读取最新的 storage 数据，防止闭包陈旧
                const stored = localStorage.getItem('rh_saved_apps');
                const currentApps: SavedApp[] = stored ? JSON.parse(stored) : [];
                const newApps = currentApps.filter(app => app.id !== appId);

                localStorage.setItem('rh_saved_apps', JSON.stringify(newApps));
                setSavedApps(newApps);

                // 触发自定义事件通知其他组件
                window.dispatchEvent(new Event('rh_apps_updated'));
                setConfirmDeleteId(null);
            } catch (err) {
                console.error('Delete failed:', err);
            }
        } else {
            setConfirmDeleteId(appId);
            setTimeout(() => setConfirmDeleteId(null), 3000);
        }
    };

    return (
        <div className={`flex flex-col ${disableScroll ? 'h-auto' : 'h-full'} bg-[#1e1e24] text-white ${className}`}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <Box className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-semibold">{getTranslation('labels.sidePanelTitle')}</h3>
                <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] text-white/40">{savedApps.length} 個</span>

                    {/* Size=icon button for sync */}
                    <button
                        onClick={handleSyncNames}
                        disabled={isSyncing || savedApps.length === 0}
                        className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={getTranslation('labels.syncNames')}
                    >
                        {isSyncing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            </div>

            <div className={`${disableScroll ? '' : 'flex-1 overflow-y-auto custom-scrollbar'} p-2 space-y-2`}>
                {savedApps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-20 text-white/30 text-[10px]">
                        <p>{getTranslation('labels.noSavedApps')}</p>
                        <p className="mt-1">{getTranslation('labels.addInPanel')}</p>
                    </div>
                ) : (
                    savedApps.map(app => (
                        <div
                            key={app.id}
                            onClick={() => onSelectApp(app.id)}
                            className="group relative flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer"
                        >
                            <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center overflow-hidden">
                                {app.iconUrl ? (
                                    <img src={app.iconUrl} alt="icon" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs font-bold text-purple-400">{app.name.charAt(0).toUpperCase()}</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0" title={`ID: ${app.id}`}>
                                <h4 className="text-[11px] font-medium text-gray-200 group-hover:text-white leading-tight line-clamp-2">
                                    {(rhTranslations.appNames as Record<string, string>)[app.name] || simplifiedToTraditional(app.name) || getTranslation('labels.unnamedApp')}
                                </h4>
                            </div>

                            <button
                                onClick={(e) => handleDelete(e, app.id)}
                                className={`p-1.5 rounded transition-all ${confirmDeleteId === app.id
                                    ? 'opacity-100 bg-red-500/20 text-red-500 hover:bg-red-500/30'
                                    : 'opacity-0 group-hover:opacity-100 bg-black/20 hover:bg-red-500/20 text-gray-400 hover:text-red-400'
                                    }`}
                                title={confirmDeleteId === app.id ? getTranslation('labels.confirmDelete') : getTranslation('labels.delete')}
                            >
                                {confirmDeleteId === app.id ? <CheckCircle className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    ))
                )}
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
        </div>
    );
};
