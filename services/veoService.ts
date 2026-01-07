
import { ApiStatus } from '../types';

interface VeoGenerationResponse {
    predictions?: Array<{
        video?: {
            content: string; // Base64 encoded video
            mimeType: string;
        };
        bytesBase64Encoded?: string; // Alternative field
    }>;
    error?: {
        code: number;
        message: string;
        status: string;
    };
}

// User provided generic endpoint base: https://aiplatform.googleapis.com/v1/publishers/google/models/
// We target veo-3.1-generate-001:predict
// Note: Vertex AI usually requires region/project, but the API Key path logic provided by user suggests this publisher endpoint.
const MODEL_ID = 'veo-2.0-generate-001'; // Fallback to 2.0 if 3.1 not public, but trying 3.1 as requested
// Update: User asked for Veo 3.1.
// Verified model IDs often include 'veo-2.0-generate-001'. Let's try to make it configurable or stick to 2.0 if 3.1 is unknown, but I will put 3.1 as requested.
const VEO_MODEL_ID = 'veo-3.1-generate-001';

// Default to global, but we will prefer regional if project/location provided
// const API_BASE_URL = 'https://aiplatform.googleapis.com/v1/publishers/google/models';

export interface VeoGenerationParams {
    prompt: string;
    image?: string; // Base64 string (without data:image/xxx;base64, prefix)
    seconds?: number; // default 5? Veo often supports 24fps, ~5s
    aspectRatio?: string; // 16:9, etc.
    resolution?: string; // 720p, 1080p
}

export const generateVideoWithVeo = async (
    apiKey: string,
    params: VeoGenerationParams,
    config: { projectId: string; location: string }
): Promise<{ videoUrl: string; }> => {
    if (!apiKey) {
        throw new Error('Missing Google Veo API Key');
    }
    if (!config.projectId || !config.location) {
        throw new Error('Missing Google Cloud Project ID or Location for Veo');
    }

    // Regional Endpoint: https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL}:predict
    const url = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${VEO_MODEL_ID}:predict?key=${apiKey}`;

    // Map params to Veo specs
    // Veo expect 'instances' and 'parameters'
    // Aspect Ratio mapping: "16:9" -> "16:9"
    // Resolution: "720p" -> "1280x720"? No, Veo usually takes distinct params.
    // NOTE: Without official public docs for Veo 3.1 API JSON schema, we assume Vertex Video Gen AI schema.

    // Common Vertex Video Schema:
    // {
    //   "instances": [ { "prompt": "..." } ],
    //   "parameters": { "sampleCount": 1, "videoLengthSeconds": 5, "aspectRatio": "16:9" }
    // }

    // Construct Input Instance
    const instance: any = {
        prompt: params.prompt
    };

    // Add Image if present
    if (params.image) {
        // Vertex AI prediction usually expects 'image' object with 'bytesBase64Encoded'
        instance.image = {
            bytesBase64Encoded: params.image
        };
    }

    const requestBody = {
        instances: [instance],
        parameters: {
            sampleCount: 1,
            videoLengthSeconds: params.seconds || 4, // Veo supports specific lengths
            aspectRatio: params.aspectRatio || "16:9",
            // quality, etc?
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Veo API Error:', err);
            throw new Error(err.error?.message || `Veo API Failed: ${response.status}`);
        }

        const data: VeoGenerationResponse = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        if (!data.predictions || data.predictions.length === 0) {
            throw new Error('No predictions returned');
        }

        const prediction = data.predictions[0];

        // Handle Base64 output
        // Vertex AI often returns 'bytesBase64Encoded' or nested video content
        let base64Video = '';
        if (prediction.bytesBase64Encoded) {
            base64Video = prediction.bytesBase64Encoded;
        } else if (prediction.video?.content) {
            base64Video = prediction.video.content;
        } else {
            // check for raw bytes?
            // throw new Error('Unknown response format');
            // For safety, log complete response if dev
            console.warn('Unknown Veo Format:', prediction);
            throw new Error('Failed to parse video content');
        }

        // Convert base64 to Blob URL
        const byteCharacters = atob(base64Video);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'video/mp4' }); // Assuming MP4
        const videoUrl = URL.createObjectURL(blob);

        return { videoUrl };

    } catch (error: any) {
        console.error('Veo Generation Error:', error);
        throw error;
    }
};
