import { GoogleGenAI } from '@google/genai';

console.log('Attempting to import GoogleGenAI...');
try {
    const ai = new GoogleGenAI({ apiKey: 'test' });
    console.log('✅ GoogleGenAI instantiated successfully class:', GoogleGenAI.name);
} catch (e) {
    console.error('❌ Error instantiating:', e);
}
