import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log('✅ Connected to PostgreSQL via Prisma');
    } catch (error) {
        console.error('❌ Prisma Connection Error:', error);
        process.exit(1);
    }
};
