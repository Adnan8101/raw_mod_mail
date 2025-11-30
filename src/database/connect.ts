import mongoose from 'mongoose';
import { CONFIG } from '../config';
export const connectDB = async () => {
    try {
        await mongoose.connect(CONFIG.MONGO_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};
