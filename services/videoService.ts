
import { ApiStatus } from '../types';

interface VideoGenerationResponse {
    id: string;
    status: 'processing' | 'completed' | 'failed' | 'rejected';
    result?: {
        video_url: string;
        cover_image_url?: string;
    };
    error?: {
        message: string;
    };
}

const API_BASE_URL = 'https://api.openai.com/v1/videos';

export interface VideoGenerationParams {
    prompt: string;
    model?: string;
    size?: string;
    seconds?: number;
}

export const generateVideoWithSora = async (
    apiKey: string,
    params: VideoGenerationParams
): Promise<{ videoUrl: string; imageUrl: string }> => {
    if (!apiKey) {
        throw new Error('Missing OpenAI API Key');
    }

    // 1. Initiate Generation
    const response = await fetch(`${API_BASE_URL}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: params.model || 'sora-2',
            prompt: params.prompt,
            size: params.size || '1920x1080',
            seconds: String(params.seconds || 4), // Conversion to string as required by API
        }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to initiate video generation');
    }

    const data: VideoGenerationResponse = await response.json();
    const videoId = data.id;

    // 2. Poll for Completion
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max (assuming 1s interval? No, usually longer) -> let's do 5 mins with 5s interval
    // Actually video gen takes time.

    // Exponential backoff or simple polling
    while (attempts < 60) { // Poll for up to 5 minutes (5s * 60)
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusRes = await fetch(`${API_BASE_URL}/${videoId}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!statusRes.ok) {
            // Warning but continue? or throw?
            console.warn('Failed to check status, retrying...');
        } else {
            const statusData: VideoGenerationResponse = await statusRes.json();

            if (statusData.status === 'completed' && statusData.result) {
                return {
                    videoUrl: statusData.result.video_url,
                    imageUrl: statusData.result.cover_image_url || '', // Fallback?
                };
            }

            if (statusData.status === 'failed' || statusData.status === 'rejected') {
                throw new Error(statusData.error?.message || 'Video generation failed');
            }
        }

        attempts++;
    }

    throw new Error('Video generation timed out');
};
