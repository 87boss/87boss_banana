import React from 'react';
import BatchCoverPanel from './BatchCoverPanel';
import { ApiStatus, DesktopItem, DesktopImageItem, ThirdPartyApiConfig } from '../../types';
import { generateCoverPrompts, editImageWithGemini } from '../../services/geminiService';
import { saveToHistory } from '../../services/api/history';

interface BatchCoverContainerProps {
    status: ApiStatus;
    setStatus: (status: ApiStatus) => void;
    setError: (error: string | null) => void;
    apiKey?: string;
    thirdPartyApiConfig: ThirdPartyApiConfig;
    desktopItems: DesktopItem[];
    setDesktopItems: React.Dispatch<React.SetStateAction<DesktopItem[]>>;
    safeDesktopSave: (items: DesktopItem[]) => void;
    files: File[];
    aspectRatio: string;
    imageSize: string;
}

const BatchCoverContainer: React.FC<BatchCoverContainerProps> = ({
    status,
    setStatus,
    setError,
    apiKey,
    thirdPartyApiConfig,
    desktopItems,
    setDesktopItems,
    safeDesktopSave,
    files,
    aspectRatio,
    imageSize,
}) => {
    return (
        <BatchCoverPanel
            isLoading={status === ApiStatus.Loading || status === ApiStatus.Generating}

            // 1. 生成提示詞
            onGenerate={async (data) => {
                setStatus(ApiStatus.Generating);
                try {
                    const { theme, title, subtitle, footer, count, scene, plot, media } = data as any; // Cast to any if interface is not shared, or rely on inference
                    console.log('[Batch Cover] Generating prompts...', data);

                    const prompts = await generateCoverPrompts(
                        theme, title, subtitle, footer, count,
                        scene, plot, media,
                        apiKey, thirdPartyApiConfig
                    );

                    console.log('[Batch Cover] Generated prompts:', prompts);

                    if (!prompts || prompts.length === 0) {
                        throw new Error("No prompts generated");
                    }

                    setStatus(ApiStatus.Success);
                    return prompts;
                } catch (e: any) {
                    console.error('[Batch Cover] Failed:', e);
                    setError(e.message);
                    setStatus(ApiStatus.Error);
                }
            }}

            // 2. 開始執行 (並行生成)
            // 2. 開始執行 (並行生成)
            onStartBatch={async (prompts) => {
                // DON'T set global status to Generating here, to keep the UI unlocked for the next task.
                // The individual items have their own isLoading state.
                try {
                    // 準備生成
                    const gridSize = 100;
                    const maxCols = 10;
                    const baseItemName = "Batch";

                    // 1. 同步計算所有占位符 (Create placeholders synchronously using current desktopItems prop)
                    // Note: We use the prop 'desktopItems' here. If state updates are pending, this might have a slight race,
                    // but for this button click it is generally safe.
                    const currentItems = desktopItems; // capture current prop
                    const occupied = new Set(currentItems.map(i => `${Math.round(i.position.x / gridSize)},${Math.round(i.position.y / gridSize)}`));

                    const findFreePosition = (ignoreSet: Set<string>) => {
                        for (let r = 0; r < 100; r++) {
                            for (let c = 0; c < maxCols; c++) {
                                const key = `${c},${r}`;
                                if (!occupied.has(key) && !ignoreSet.has(key)) {
                                    return { x: c * gridSize, y: r * gridSize };
                                }
                            }
                        }
                        return { x: 0, y: 0 };
                    };

                    const newPlaceholders: DesktopImageItem[] = [];
                    const tempOccupied = new Set<string>();

                    prompts.forEach((promptText, i) => {
                        const taskId = Date.now() + i;
                        const pos = findFreePosition(tempOccupied);
                        tempOccupied.add(`${Math.round(pos.x / gridSize)},${Math.round(pos.y / gridSize)}`);

                        const placeholder: DesktopImageItem = {
                            id: `cover-${taskId}`,
                            type: 'image',
                            name: `Cover ${i + 1}: ${baseItemName}`,
                            position: pos,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            imageUrl: '',
                            prompt: promptText,
                            model: thirdPartyApiConfig.enabled ? 'nano-banana-2' : 'Gemini',
                            isThirdParty: thirdPartyApiConfig.enabled,
                            isLoading: true
                        };
                        newPlaceholders.push(placeholder);
                    });

                    // 2. 一次性更新状态 (Update state once)
                    const nextItems = [...currentItems, ...newPlaceholders];
                    setDesktopItems(nextItems);
                    safeDesktopSave(nextItems);

                    // 3. 并发执行所有请求 (Execute concurrently using the local newPlaceholders array)
                    // We do NOT await this Promise.all, so the UI returns immediately.
                    const generatePromises = prompts.map(async (promptText, i) => {
                        const placeholder = newPlaceholders[i]; // Now this is safe!
                        const taskId = placeholder.id;

                        try {
                            const result = await editImageWithGemini(
                                files,
                                promptText,
                                {
                                    aspectRatio: aspectRatio,
                                    imageSize: imageSize
                                }
                            );

                            // 保存並更新
                            const saveRes = await saveToHistory(
                                result.imageUrl!,
                                promptText,
                                true,
                                thirdPartyApiConfig
                            );

                            setDesktopItems(current => current.map(item =>
                                item.id === taskId
                                    ? {
                                        ...item,
                                        imageUrl: saveRes.localImageUrl || result.imageUrl!,
                                        thumbnailUrl: saveRes.localThumbnailUrl,
                                        isLoading: false,
                                        historyId: saveRes.historyId
                                    }
                                    : item
                            ));
                        } catch (err: any) {
                            console.error(`[Batch Cover] Image ${i + 1} failed:`, err);
                            setDesktopItems(current => current.map(item =>
                                item.id === taskId
                                    ? { ...item, isLoading: false, loadingError: err.message || 'Failed' }
                                    : item
                            ));
                        }
                    });

                    // Fire and forget (in the background)
                    Promise.all(generatePromises).then(() => {
                        console.log('[Batch Cover] All background tasks completed');
                    });

                } catch (e: any) {
                    console.error('[Batch Cover] Failed to start:', e);
                    setError(e.message);
                }
            }}
        />
    );
};

export default BatchCoverContainer;
