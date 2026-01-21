
/**
 * Frontend Adapter for RunningHub (Pure IPC Mode)
 * Exclusively uses Electron IPC. Fails if not in Electron.
 */
export const rhAdapter = {

    // === File Operations ===

    saveFile: async (url: string, name: string, subDir?: string): Promise<{ success: boolean, path?: string, error?: string }> => {
        const api = (window as any).electronAPI?.runningHub;
        if (!api) {
            console.error('[Adapter] Electron IPC not available');
            return { success: false, error: 'Not in Electron environment' };
        }
        return await api.saveFile(url, name, subDir);
    },

    // === Configuration ===

    getConfig: async (): Promise<any> => {
        const api = (window as any).electronAPI?.runningHub;
        if (!api) return {};
        const res = await api.getConfig();
        return res.success ? res.data : {};
    },

    saveConfig: async (settings: any): Promise<boolean> => {
        const api = (window as any).electronAPI?.runningHub;
        if (!api) return false;
        const res = await api.saveConfig(settings);
        return res.success;
    },

    // === System Interaction ===

    openExternal: (url: string) => {
        (window as any).electronAPI?.openExternal?.(url); // Using standard API exposed in preload
    },

    showItemInFolder: (path: string) => {
        (window as any).electronAPI?.showItemInFolder?.(path);
    }
};
