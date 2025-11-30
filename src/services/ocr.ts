import vision from '@google-cloud/vision';
import sharp from 'sharp';
import { CONFIG } from '../config';
const client = new vision.ImageAnnotatorClient({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.GOOGLE_PROJECT_ID
    }
});
const preprocessImage = async (buffer: Buffer): Promise<Buffer> => {
    try {
        const image = sharp(buffer);
        const metadata = await image.metadata();
        if (metadata.width && metadata.width < 1000) {
            image.resize({ width: 1000 });
        }
        image
            .grayscale() 
            .linear(1.2, -20) 
            .normalize(); 
        const resultBuffer = await image.png().toBuffer();
        return resultBuffer;
    } catch (error) {
        console.error('⚠️ Image preprocessing failed, using original image:', error);
        return buffer;
    }
};
export const performOCR = async (imageBuffer: Buffer) => {
    try {
        const processedBuffer = await preprocessImage(imageBuffer);
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
            detections: detections 
        };
    } catch (error) {
        console.error('❌ OCR Error:', error);
        throw error;
    }
};
