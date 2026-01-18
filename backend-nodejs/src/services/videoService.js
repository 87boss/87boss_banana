const { GoogleGenAI } = require('@google/genai');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const { spawn } = require('child_process');

// Constants
const CREDENTIALS_PATH = path.join(config.BASE_DIR, '87boss-veo31-ok', 'key.json');
const BUCKET_NAME = '87boss-veo31'; // Bucket used by the example
const LOCATION = 'us-central1'; // Veo 3.1 usually requires this

let storage = null;
let projectId = null;

// Initialize Storage Client for Signed URLs
function initStorage() {
    if (storage) return true;
    try {
        if (!fs.existsSync(CREDENTIALS_PATH)) {
            console.error('[VideoService] Credentials not found at:', CREDENTIALS_PATH);
            return false;
        }
        const keyContent = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        projectId = keyContent.project_id;
        storage = new Storage({
            keyFilename: CREDENTIALS_PATH,
            projectId: projectId
        });
        return true;
    } catch (e) {
        console.error('[VideoService] Storage init failed:', e);
        return false;
    }
}

/**
 * Generate a video using Veo 3.1 via Python Bridge
 * @param {string} prompt
 * @param {number} durationSeconds (4 or 8)
 * @param {string} aspectRatio (16:9 or 9:16)
 * @param {Buffer} imageBuffer (optional)
 * @param {string} mimeType (optional)
 * @returns {Promise<string>} Signed URL of the generated video
 */
async function generateVideo(prompt, durationSeconds = 8, aspectRatio = '16:9', imageBuffer = null, mimeType = null) {
    if (!initStorage()) {
        throw new Error('Storage service not initialized');
    }

    // Upload image if provided
    let imageGcsUri = null;
    if (imageBuffer) {
        try {
            const timestamp = Date.now();
            const filename = `uploads/${timestamp}-${Math.random().toString(36).substring(7)}.${mimeType.split('/')[1]}`;
            const file = storage.bucket(BUCKET_NAME).file(filename);

            console.log(`[VideoService] Uploading image to gs://${BUCKET_NAME}/${filename}`);
            await file.save(imageBuffer, {
                metadata: { contentType: mimeType }
            });
            imageGcsUri = `gs://${BUCKET_NAME}/${filename}`;
        } catch (uploadError) {
            console.error('[VideoService] Image upload failed:', uploadError);
            throw new Error('Failed to upload image to GCS');
        }
    }

    return new Promise((resolve, reject) => {
        console.log(`[VideoService] Spawning Python for: "${prompt}"`);

        const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'run_veo.py');
        const pythonExecutable = path.join(config.BASE_DIR, 'backend-nodejs', '.venv', 'Scripts', 'python.exe');

        console.log(`[VideoService] Using Python: ${pythonExecutable}`);

        const args = [
            scriptPath,
            '--prompt', prompt,
            '--duration', durationSeconds.toString(),
            '--aspect_ratio', aspectRatio,
            '--key_file', CREDENTIALS_PATH
        ];

        if (imageGcsUri) {
            args.push('--image_uri', imageGcsUri);
        }

        const pythonProcess = spawn(pythonExecutable, args);

        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            // Python logging might go to stderr, but we capture it just in case
            errorData += data.toString();
            console.log('[Python Log]', data.toString());
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                console.error('[VideoService] Python process exited with code:', code);
                console.error('[VideoService] Error output:', errorData);
                reject(new Error(`Video generation process failed: ${errorData}`));
                return;
            }

            try {
                // Parse last line of output as JSON
                const lines = outputData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                const result = JSON.parse(lastLine);

                if (result.success && result.gcsUri) {
                    const gcsUri = result.gcsUri;
                    console.log('[VideoService] Generated GCS URI:', gcsUri);

                    // Generate Signed URL
                    const matches = gcsUri.match(/gs:\/\/([^\/]+)\/(.+)/);
                    if (!matches) {
                        reject(new Error('Invalid GCS URI format'));
                        return;
                    }

                    const bucketName = matches[1];
                    const fileName = matches[2];

                    const [url] = await storage.bucket(bucketName).file(fileName).getSignedUrl({
                        version: 'v4',
                        action: 'read',
                        expires: Date.now() + 60 * 60 * 1000, // 1 hour
                    });

                    resolve(url);
                } else {
                    reject(new Error(result.error || 'Unknown python error'));
                }
            } catch (parseError) {
                console.error('[VideoService] JSON Parse Error:', parseError);
                reject(new Error('Failed to parse Python output'));
            }
        });
    });
}

module.exports = {
    generateVideo
};
