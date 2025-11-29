import vision from '@google-cloud/vision';
import { CONFIG } from '../config';

// Initialize the client with credentials from env
const client = new vision.ImageAnnotatorClient({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.GOOGLE_PROJECT_ID
    }
});

export const performOCR = async (imageBuffer: Buffer) => {
    try {
        const [result] = await client.textDetection(imageBuffer);
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            return { text: '', fullText: '' };
        }

        return {
            text: detections[0].description || '',
            fullText: detections[0].description || ''
        };
    } catch (error) {
        console.error('❌ OCR Error:', error);
        throw error;
    }
};
