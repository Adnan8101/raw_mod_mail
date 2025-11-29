import vision from '@google-cloud/vision';
import sharp from 'sharp';
import { CONFIG } from '../config';

// Initialize the client with credentials from env
const client = new vision.ImageAnnotatorClient({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.GOOGLE_PROJECT_ID
    }
});

const preprocessImage = async (buffer: Buffer): Promise<Buffer> => {
    try {
        console.time('Sharp Process');
        const image = sharp(buffer);

        // Preprocessing steps:
        // 1. Resize if too small (upscale for better text recognition)
        const metadata = await image.metadata();
        if (metadata.width && metadata.width < 1000) {
            image.resize({ width: 1000 });
        }

        // 2. Enhance image for OCR
        // Sharp doesn't have direct 'contrast' method like Jimp, but we can use linear or modulate
        // modulate: brightness, saturation, hue, lightness
        // linear: a * input + b
        // To increase contrast: linear(a > 1)

        image
            .grayscale() // Convert to grayscale
            .linear(1.2, -20) // Increase contrast (slope 1.2, offset -20)
            .normalize(); // Normalize to stretch histogram

        const resultBuffer = await image.png().toBuffer();
        console.timeEnd('Sharp Process');

        return resultBuffer;
    } catch (error) {
        console.error('⚠️ Image preprocessing failed, using original image:', error);
        return buffer;
    }
};

export const performOCR = async (imageBuffer: Buffer) => {
    try {
        console.log('[OCR] Starting Preprocessing...');
        const processedBuffer = await preprocessImage(imageBuffer);
        console.log('[OCR] Preprocessing Complete.');

        // Use robust object format for Google Vision API
        console.log('[OCR] Calling Google Vision API...');
        console.time('Google Vision API');
        const [result] = await client.textDetection({
            image: { content: processedBuffer }
        });
        console.timeEnd('Google Vision API');

        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            return { text: '', fullText: '', detections: [] };
        }

        return {
            text: detections[0].description || '',
            fullText: detections[0].description || '',
            detections: detections // Return full detections for bounding box analysis
        };
    } catch (error) {
        console.error('❌ OCR Error:', error);
        throw error;
    }
};
