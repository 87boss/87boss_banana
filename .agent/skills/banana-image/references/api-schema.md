# Banana/Nano Image Generation API Schema

This document defines the schema for interacting with the Banana/Nano image generation service.

## API Endpoint

- **Path**: `/v1/images/generations`
- **Method**: `POST`
- **Authentication**: Bearer Token (API Key)
- **Content-Type**: `application/json`

## Request Schema

```typescript
interface NanoBananaRequest {
  /**
   * Model identifier
   * Default: "nano-banana-2"
   */
  model: string;

  /**
   * The prompt generation instruction
   */
  prompt: string;

  /**
   * Response format
   * Value: "url"
   */
  response_format: 'url';

  /**
   * Output image resolution
   */
  image_size: '1K' | '2K' | '4K';

  /**
   * Aspect Ratio
   * 
   * Valid values:
   * '1:1', '4:3', '3:4', '16:9', '9:16', 
   * '2:3', '3:2', '4:5', '5:4', '21:9'
   * 
   * Constraint:
   * - Must be omitted if config.aspectRatio is "Auto" AND input images are provided (Image-to-Image).
   * - Should default to '1:1' if "Auto" is used in Text-to-Image mode.
   */
  aspect_ratio?: string;

  /**
   * Input images for Image-to-Image generation.
   * Format: Array of Base64 Data URI strings.
   * Example: ["data:image/png;base64,...", "data:image/png;base64,..."]
   */
  image?: string[];

  /**
   * Random seed for reproducibility
   */
  seed?: number;
}
```

## Response Schema

```typescript
interface NanoBananaResponse {
  created: number;
  data: Array<{
    /**
     * URL to the generated image
     */
    url?: string;
    
    /**
     * Base64 JSON (alternative to URL)
     */
    b64_json?: string;
    
    revised_prompt?: string;
  }>;
  
  error?: {
    message: string;
    type: string;
    param: any;
    code: any;
  }
}
```

## Key Constraints

1.  **Multiple Inputs**: The `image` field supports an array of strings, allowing for multi-image input (e.g., style reference + sketch).
2.  **Auto Aspect Ratio**:
    -   **Img2Img**: If the user selects "Auto" aspect ratio and provides input images, the `aspect_ratio` field MUST be excluded from the request payload. The API will infer the ratio from the input image.
    -   **Txt2Img**: If "Auto" is selected for text-only generation, default to `1:1`.
3.  **Batch Generation**:
    -   The API processes one generation task per request.
    -   For batch generation, the client must implement concurrency (e.g., `Promise.all`) to send multiple distinct requests.

## Known Models

-   `nano-banana-2` (Default)
