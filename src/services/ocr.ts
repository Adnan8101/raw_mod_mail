import vision from '@google-cloud/vision';
import { Jimp } from 'jimp'; // Correct named import for this version
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
        const image = await Jimp.read(buffer);

        // Preprocessing steps:
        // 0. Auto-rotate based on EXIF
        image.rotate(0);

        // 1. Resize if too small (upscale for better text recognition)
        if (image.bitmap.width < 1000) {
            image.resize({ w: 1000 });
        }

        // 2. Enhance image for OCR
        image.greyscale();
        image.contrast(0.3); // Increased contrast
        image.normalize();   // Normalize to stretch histogram

        // Use getBuffer with callback wrapped in Promise as getBufferAsync is not available in types
        return await new Promise((resolve, reject) => {
            image.getBuffer("image/png", (err: Error, buffer: Buffer) => {
                if (err) reject(err);
                else resolve(buffer);
            });
        });
    } catch (error) {
        console.error('⚠️ Image preprocessing failed, using original image:', error);
        return buffer;
    }
};

export const performOCR = async (imageBuffer: Buffer) => {
    try {
        const processedBuffer = await preprocessImage(imageBuffer);

        // Use robust object format for Google Vision API
        const [result] = await client.textDetection({
            image: { content: processedBuffer }
        });

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
