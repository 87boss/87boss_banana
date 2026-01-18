import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';

async function main() {
    if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        console.error('Please set GEMINI_API_KEY');
        return;
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    try {
        console.log('Listing models...');
        const result = await ai.models.list(); // Correct method for new SDK? Or listModels?
        // SDK 1.x signature might be different. Let's try likely one or check docs if failed.
        // The previous error trace mentioned `ai.models.generateContent`, so `ai.models.list` seems plausible.
        // Or `ai.models.listModels`.
        // Actually, looking at docs for @google/genai (new SDK), it is `ai.models.list()`.

        // Iterate async iterable if needed or just print result
        for await (const model of result) {
            console.log(`- ${model.name} (${model.displayName})`);
            console.log(`  Supported methods: ${model.supportedGenerationMethods?.join(', ')}`);
        }

    } catch (e) {
        console.error('Error listing models:', e);
    }
}

main();
