const express = require('express');
const router = express.Router();
const videoService = require('../services/videoService');

// Generate video
router.post('/generate', async (req, res) => {
    try {
        const { prompt, duration, aspectRatio, image } = req.body;

        let imageBuffer = null;
        let mimeType = null;

        // Process base64 image if provided
        if (image) {
            // Expect base64 string like "data:image/png;base64,..."
            const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                mimeType = matches[1];
                imageBuffer = Buffer.from(matches[2], 'base64');
            } else {
                // If just base64 string without prefix, optional but better to stick to standard
                // Let's assume standard data URI
                console.warn('[VideoRoute] Invalid base64 image format, skipping image');
            }
        }

        const videoUrl = await videoService.generateVideo(prompt, duration, aspectRatio, imageBuffer, mimeType);
        res.json({ success: true, data: { videoUrl } });
    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
