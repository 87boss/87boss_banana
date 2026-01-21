const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const JsonStorage = require('../utils/jsonStorage');
const FileHandler = require('../utils/fileHandler');
const https = require('https');
const http = require('http');

// Settings file path
const RH_SETTINGS_FILE = path.join(config.DATA_DIR, 'rh_settings.json');

// Initialize settings if not exists
if (!fs.existsSync(RH_SETTINGS_FILE)) {
    JsonStorage.init(RH_SETTINGS_FILE, {
        apiKey: '',
        webappId: '', // Default generic webapp ID if needed
        autoSave: true,
        autoDecode: true
    });
}

// === Configuration Endpoints ===

// Get Settings
router.get('/config', (req, res) => {
    try {
        const settings = JsonStorage.read(RH_SETTINGS_FILE);
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Settings
router.post('/config', (req, res) => {
    try {
        const updates = req.body;
        const current = JsonStorage.read(RH_SETTINGS_FILE);
        const newSettings = { ...current, ...updates };
        JsonStorage.write(RH_SETTINGS_FILE, newSettings);
        res.json({ success: true, data: newSettings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// === File Operations ===

// Save File (Auto-save feature)
// Expects: { url: string, name: string, subDir?: string }
router.post('/save-file', async (req, res) => {
    try {
        const { url, name, subDir } = req.body;

        if (!url || !name) {
            return res.status(400).json({ success: false, error: 'Missing url or name' });
        }

        // Determine output directory
        let outputDir = config.OUTPUT_DIR;
        if (subDir) {
            outputDir = path.join(config.OUTPUT_DIR, subDir);
            FileHandler.ensureDir(outputDir);
        }

        const filePath = path.join(outputDir, name);

        // Handle Base64
        if (url.startsWith('data:')) {
            const base64Data = url.split(';base64,').pop();
            fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
            return res.json({ success: true, path: filePath });
        }

        // Handle Remote URL
        if (url.startsWith('http')) {
            const fileStream = fs.createWriteStream(filePath);
            const protocol = url.startsWith('https') ? https : http;

            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    return res.status(500).json({ success: false, error: `Failed to download: ${response.statusCode}` });
                }

                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    res.json({ success: true, path: filePath });
                });
            }).on('error', (err) => {
                fs.unlink(filePath, () => { }); // Delete failed file
                res.status(500).json({ success: false, error: err.message });
            });
            return; // Configured callback handles response
        }

        res.status(400).json({ success: false, error: 'Unsupported URL format' });

    } catch (error) {
        console.error('[RH-Backend] Save file error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
