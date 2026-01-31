import React, { useState, useEffect } from 'react';
import BatchCoverPanel from './BatchCoverPanel';
import { generateCoverPrompts, editImageWithGemini, initializeAiClient } from '../../services/geminiService';
import { ApiStatus, DesktopItem, DesktopImageItem, ThirdPartyApiConfig } from '../../types';

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
    onRunRunningHub?: (prompts: string[]) => void;
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
    onRunRunningHub
}) => {

    const [isGenerating, setIsGenerating] = useState(false);

    // API Configurations
    // We reuse props for config where possible, or local state if we want to override?
    // The original container used props for config. Let's stick to that for consistency with App.tsx
    // But we also need to handle the new "Traditional Chinese" prompt generation which might need different handling.

    // We actually don't need local apiKey state if it's passed in.
    // But initializeAiClient might need to be called.

    useEffect(() => {
        if (apiKey) {
            initializeAiClient(apiKey);
        }
    }, [apiKey]);

    const handleGeneratePrompts = async (data: any) => {
        setIsGenerating(true);
        setStatus(ApiStatus.Generating);
        try {
            // Re-initialize to ensure latest config/key
            if (apiKey) initializeAiClient(apiKey);

            // Generate prompts
            const prompts = await generateCoverPrompts(
                data.theme,
                data.title,
                data.subtitle,
                data.footer,
                data.textEffect || '無特效 (None)',
                data.count,
                "", // scene removed
                "", // plot removed
                data.media,
                apiKey,
                thirdPartyApiConfig
            );
            setStatus(ApiStatus.Success);
            return prompts;
        } catch (error) {
            console.error("Prompt Generation Error:", error);
            alert("生成失敗: " + (error instanceof Error ? error.message : String(error)));
            setError(error instanceof Error ? error.message : String(error));
            setStatus(ApiStatus.Error);
            return [];
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStartBatch = async (prompts: string[], mode: 'banana' | 'runninghub') => {
        if (!prompts || prompts.length === 0) return;

        if (mode === 'runninghub') {
            if (onRunRunningHub) {
                onRunRunningHub(prompts);
            } else {
                alert("RunningHub integration not connected!");
            }
            return;
        }

        // Banana Mode
        setIsGenerating(true);
        // setStatus(ApiStatus.Generating); // Optional, might lock UI
        try {
            // 準備生成
            const gridSize = 100;
            const maxCols = 10;
            const occupied = new Set(desktopItems.map(i => `${Math.round(i.position.x / gridSize)},${Math.round(i.position.y / gridSize)}`));

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

            const tempOccupied = new Set<string>();
            const newPlaceholders: DesktopImageItem[] = [];

            // 1. Create Placeholders
            prompts.forEach((promptText, i) => {
                const pos = findFreePosition(tempOccupied);
                tempOccupied.add(`${Math.round(pos.x / gridSize)},${Math.round(pos.y / gridSize)}`);

                const placeholder: DesktopImageItem = {
                    id: `cover-${Date.now()}-${i}`,
                    type: 'image',
                    name: `Batch ${i + 1}`,
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

            // Update Desktop
            const nextItems = [...desktopItems, ...newPlaceholders];
            setDesktopItems(nextItems);
            safeDesktopSave(nextItems);

            // 2. Execute Async
            newPlaceholders.forEach(async (item) => {
                try {
                    const result = await editImageWithGemini(
                        [],
                        item.prompt || '',
                        { aspectRatio: '1:1', imageSize: '1K' } // Default
                    );

                    if (result.imageUrl) {
                        // Save to history? (Optional, existing code did it)
                        // Update item
                        setDesktopItems(current => current.map(i =>
                            i.id === item.id
                                ? { ...i, imageUrl: result.imageUrl!, isLoading: false }
                                : i
                        ));
                        // Note: safeDesktopSave call needed after update? 
                        // For now relies on auto-save or effect in App.
                    }
                } catch (e) {
                    console.error("Item generation failed", e);
                    setDesktopItems(current => current.map(i =>
                        i.id === item.id
                            ? { ...i, isLoading: false, loadingError: 'Failed' }
                            : i
                    ));
                }
            });

        } catch (error) {
            console.error("Batch Execution Error:", error);
            alert("批量執行部分失敗");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <BatchCoverPanel
            onGenerate={handleGeneratePrompts}
            onStartBatch={handleStartBatch}
            isLoading={isGenerating}
        />
    );
};

export default BatchCoverContainer;
