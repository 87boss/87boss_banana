const express = require('express');
const router = express.Router();

router.post('/generate-image', async (req, res) => {
    try {
        const { apiKey, prompt, model, n = 1, size = "1024x1024", quality = "standard", style = "vivid", image } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: { message: 'OpenAI API Key is required' } });
        }

        console.log('[OpenAI Proxy] Generating image with prompt:', prompt);

        // Map internal model names to OpenAI models
        let apiModel = req.body.model || "dall-e-3";
        let apiStyle = style; // Default style

        // Allow image-1.5 to pass through
        if (apiModel === 'image-1.5') {
            // image-1.5 specific logic if any (optional)
        }

        const requestPayload = {
            model: apiModel,
            prompt: prompt,
            n: n,
            size: size,
            quality: quality,
            style: apiStyle,
            response_format: "b64_json"
        };

        // Add reference image if present
        if (image) {
            console.log('[OpenAI Proxy] Image received. Size:', image.length);
            requestPayload.image = image;
            // Add extra parameter for image-1.5 if needed, e.g. "image_strength"? 
            // For now assuming "image" is the key.
        } else {
            console.log('[OpenAI Proxy] No image received in request body.');
        }

        console.log('[OpenAI Proxy] Sending payload keys:', Object.keys(requestPayload));

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[OpenAI Proxy] API Error:', data);
            return res.status(response.status).json(data);
        }

        console.log('[OpenAI Proxy] Generation successful');
        res.json(data);

    } catch (error) {
        console.error('[OpenAI Proxy] Internal Error:', error);
        res.status(500).json({ error: { message: error.message } });
    }
});

module.exports = router;
