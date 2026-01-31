---
name: banana-image
description: Specialized skill for interacting with the Nano/Banana Image Generation API. Use this skill when the user wants to implement, debug, or modify image generation features involving the "Nano" or "ThirdParty" API, specifically for tasks like "generate image", "batch generation", or "configure generation model".
---

# Banana Image Generation Skill

This skill encapsulates the logic for using the Nano/Banana Image Generation service. It provides the standard procedures for authentication, request construction, and handling complex modes like Batch Generation and Image-to-Image.

## 1. API Configuration

Before making requests, ensure the `ThirdPartyApiConfig` is properly loaded.

-   **Base URL**: Must be configured. The service endpoint is constructed as `${baseUrl}/v1/images/generations`.
-   **API Key**: Required for the `Authorization: Bearer <token>` header.
-   **Model**: Defaults to `nano-banana-2` if not specified.

## 2. Generation Modes

### Text-to-Image (Txt2Img)
-   **Trigger**: No input files provided in the payload.
-   **Payload**: Must include `prompt`, `image_size`, and strict `aspect_ratio`.
-   **Auto Aspect Ratio**: If the user asks for "Auto", default to `1:1`.

### Image-to-Image (Img2Img)
-   **Trigger**: `image` field is populated with an array of Base64 strings.
-   **Multi-Image**: The service supports multiple input images (e.g., [Style Ref, Layout Ref]). Pass all as an array.
-   **Auto Aspect Ratio**:
    -   **Critical**: If `aspectRatio` is set to "Auto" (or undefined), **DO NOT** send the `aspect_ratio` field in the JSON payload.
    -   The API will automatically match the output ratio to the first input image.

## 3. Reference Schema

For the exact JSON structure of valid requests and responses, refer to:
[references/api-schema.md](references/api-schema.md)

## 4. Batch Generation Handling

The Nano/Banana API is a **Synchronous, Single-Task** API. It does not support a native "batch" endpoint.

**To implement Batch Generation:**
1.  **Do not** look for a batch endpoint.
2.  **Concurrency**: You must generate a unique request for each item in the batch.
3.  **Client-Side Logic**:
    -   Create placeholder UI items for all tasks immediately (for responsiveness).
    -   Use `Promise.all` (or a semaphore/queue) to send requests in parallel.
    -   Update each UI item individually as its specific Promise resolves.

## 5. Error Handling

-   **401 Unauthorized**: Prompt the user to check their API Key settings.
-   **500+ Server Errors**: These are often transient. Implement a retry mechanism with exponential backoff (default 3 retries).
-   **"No image returned"**: If `data` is empty or `url`/`b64_json` is missing, treat as a failure.

## 6. Code Implementation Pattern (TypeScript)

When implementing or refactoring code using this skill, follow this pattern:

```typescript
// 1. Validate Config
if (!config.apiKey || !config.baseUrl) throw new Error("Missing API Config");

// 2. Prepare Payload
const payload: NanoBananaRequest = {
  model: config.model || 'nano-banana-2',
  prompt: finalPrompt,
  response_format: 'url',
  image_size: uiState.imageSize, // '1K', '2K', '4K'
};

// 3. Handle Images & Aspect Ratio
if (inputFiles.length > 0) {
  // Img2Img
  payload.image = await convertFilesToBase64(inputFiles);
  
  // Only add aspect_ratio if NOT Auto
  if (uiState.aspectRatio !== 'Auto') {
    payload.aspect_ratio = uiState.aspectRatio;
  }
} else {
  // Txt2Img
  payload.aspect_ratio = uiState.aspectRatio === 'Auto' ? '1:1' : uiState.aspectRatio;
}

// 4. Send Request
const response = await fetch(`${config.baseUrl}/v1/images/generations`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});
```
