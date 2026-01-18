import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { BIMData } from './bim_types';

// --- CONFIG ---
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const MODEL_NAME = "gemini-3-pro-image-preview";

// --- LOGGING ---
const LOG_FILE = path.join(process.cwd(), 'poc_log.txt');
function log(msg: string) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}\n`;
    console.log(msg);
    try {
        fs.appendFileSync(LOG_FILE, logMsg);
    } catch (e) {
        // ignore log error
    }
}

// --- MAIN ---
async function main() {
    log("🚀 Starting Gemini Vision POC (BIM Schema Mode)...");

    try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
            log("❌ Please set GEMINI_API_KEY environment variable (or VITE_GEMINI_API_KEY).");
            // Attempt to read from .env if simpler methods fail
            try {
                const envPath = path.join(process.cwd(), '.env');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf-8');
                    const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
                    if (match) {
                        log("✅ Found API Key in .env file");
                        process.env.GEMINI_API_KEY = match[1].trim();
                    }
                }
            } catch (e) { }

            if (!process.env.GEMINI_API_KEY) return;
        }

        const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
        log("🔑 Initializing SDK...");
        const ai = new GoogleGenAI({ apiKey });

        // Mock Inputs
        // Try to use a known real image from artifacts if available
        const artifactImage = "C:\\Users\\87boss\\.gemini\\antigravity\\brain\\a3674b19-abd3-487a-826d-1c5ba6a45d80\\uploaded_image_1768727234093.jpg";
        const localImage = path.join(process.cwd(), 'uploaded_image_0_1768728760686.png');

        const imagePath = fs.existsSync(artifactImage) ? artifactImage : localImage;

        // Construct the prompt with the Schema Definition
        const schemaDefinition = `
export interface Dimensions { width: number; height: number; depth?: number; area?: number; }
export interface MaterialInfo { name: string; description?: string; estimatedCostPerUnit?: number; }
export type SurfaceType = 'wall' | 'floor' | 'ceiling' | 'window' | 'door' | 'partition';
export interface Surface { id: string; type: SurfaceType; material: MaterialInfo; dimensions: Dimensions; position?: string; }
export interface Furniture { id: string; name: string; category: string; dimensions?: Dimensions; position?: string; material?: string; estimatedPrice?: number; }
export interface QuotationItem { id: string; category: string; item: string; description: string; quantity: number; unit: string; unitPrice: number; totalPrice: number; }
export interface SpaceInfo { roomType: string; dimensions: Dimensions; designStyle: string; }
export interface BIMData { space: SpaceInfo; surfaces: Surface[]; furniture: Furniture[]; estimatedQuotation: QuotationItem[]; totalEstimatedBudget: number; usageAnalysis: string; }
`;

        const prompt = `
        You are an expert BIM (Building Information Modeling) Engineer, Interior Designer, and Quantity Surveyor.
        
        Task: 
        Analyze the provided interior image and reconstruct a detailed 3D understanding of the space.
        Identify all surfaces (walls, floor, ceiling), furniture, and materials.
        Estimate dimensions (in meters) based on standard furniture sizes (e.g., standard chair height ~0.45m).
        Generate a preliminary Quotation/Bill of Quantities (BoQ) for renovating this space provided in the image (or constructing it if it's a render).
        
        Output strictly valid JSON matching the following TypeScript interface (do not include markdown code blocks, just the raw JSON or wrapped in \`\`\`json):
        
        ${schemaDefinition}
        
        Provide realistic market rates (in TWD - New Taiwan Dollar) for the quotation estimation.
        Ensure 'totalEstimatedBudget' is the sum of all 'totalPrice' in 'estimatedQuotation'.
        `;

        log("📸 Reading image from: " + imagePath);

        let imagePart: any = null;
        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            const imageBase64 = imageBuffer.toString('base64');
            imagePart = {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/png"
                }
            };
        } else {
            // Fallback to checking other uploaded images if the first one is gone
            const dirFiles = fs.readdirSync(process.cwd());
            const fallbackImage = dirFiles.find(f => f.startsWith('uploaded_image') && (f.endsWith('.png') || f.endsWith('.jpg')));
            if (fallbackImage) {
                log("⚠️ Target image not found, using fallback: " + fallbackImage);
                const imageBuffer = fs.readFileSync(path.join(process.cwd(), fallbackImage));
                imagePart = {
                    inlineData: {
                        data: imageBuffer.toString('base64'),
                        mimeType: "image/png"
                    }
                };
            } else {
                log("❌ No image found to analyze.");
                return;
            }
        }

        const contents = [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    ...(imagePart ? [imagePart] : [])
                ]
            }
        ];

        log("🧠 Sending request to Gemini (" + MODEL_NAME + ")...");
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents
        });

        log("✅ Response received.");

        let text = "";
        const respAny = response as any;

        // Try to find candidates in various locations
        const candidates = respAny.candidates || respAny.response?.candidates;

        if (candidates && candidates.length > 0) {
            const candidate = candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                text = candidate.content.parts[0].text || "";
            }
        }

        if (!text && typeof respAny.text === 'function') {
            text = respAny.text();
        }

        // Clean up markdown
        text = text.replace(/```json\n?|\n?```/g, "").trim();

        log("--- RAW RESPONSE START ---");
        log(text.substring(0, 500) + "...");
        log("--- RAW RESPONSE END ---");

        try {
            const data: BIMData = JSON.parse(text);
            log("✅ JSON Parsed Successfully!");
            log("Spatial Analysis: " + data.space.roomType + " (" + data.space.usageAnalysis + ")");
            log(`Found ${data.surfaces.length} surfaces and ${data.furniture.length} furniture items.`);
            log(`Total Estimated Budget: ${data.totalEstimatedBudget} TWD`);

            // Save full output
            fs.writeFileSync(path.join(process.cwd(), 'poc_bim_data.json'), JSON.stringify(data, null, 2));
            log("💾 Saved full BIM data to poc_bim_data.json");

        } catch (e) {
            log("❌ Failed to parse JSON: " + e);
            log("Full text was: " + text);
        }

    } catch (error: any) {
        log("❌ FATAL ERROR: " + (error.stack || error.message));
    }
}

main();
