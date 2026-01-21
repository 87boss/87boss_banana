import React, { useState, useEffect } from 'react';
import { Trash2, Box, CheckCircle } from "lucide-react";
import { getTranslation, rhTranslations } from "../../utils/rhTranslations";
import { simplifiedToTraditional } from "../../utils/cn2tw";

interface SavedApp {
    id: string;
    name: string;
    timestamp: number;
}

interface RHAppsLibraryProps {
    onSelectApp: (appId: string) => void;
    className?: string;
}

export const RHAppsLibrary: React.FC<RHAppsLibraryProps> = ({ onSelectApp, className }) => {
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
        <div className={`flex flex-col h-full bg-[#1e1e24] text-white ${className}`}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <Box className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-semibold">{getTranslation('labels.sidePanelTitle')}</h3>
                <span className="text-[10px] text-white/40 ml-auto">{savedApps.length} 個</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
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
                            <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center">
                                <span className="text-xs font-bold text-purple-400">{app.name.charAt(0).toUpperCase()}</span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="text-[11px] font-medium truncate text-gray-200 group-hover:text-white">
                                    {(rhTranslations.appNames as Record<string, string>)[app.name] || simplifiedToTraditional(app.name) || getTranslation('labels.unnamedApp')}
                                </h4>
                                <p className="text-[9px] text-gray-500 truncate font-mono mt-0.5">
                                    ID: {app.id}
                                </p>
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
