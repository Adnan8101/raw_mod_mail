import mongoose, { Schema, Document } from 'mongoose';
export interface IVerificationState extends Document {
    userId: string;
    progress: {
        youtube: boolean;
        instagram: boolean;
    };
    data: {
        youtubeScreenshot: string | null;
        instagramScreenshot: string | null;
        ocrYT: any;
        ocrIG: any;
    };
    submittedForReview: boolean;
    roleGiven: boolean;
    status: 'IDLE' | 'VERIFYING' | 'TICKET';
    createdAt: Date;
    updatedAt: Date;
}
const VerificationSchema: Schema = new Schema({
    userId: { type: String, required: true, unique: true },
    progress: {
        youtube: { type: Boolean, default: false },
        instagram: { type: Boolean, default: false }
    },
    data: {
        youtubeScreenshot: { type: String, default: null },
        instagramScreenshot: { type: String, default: null },
        ocrYT: { type: Schema.Types.Mixed, default: null },
        ocrIG: { type: Schema.Types.Mixed, default: null }
    },
    submittedForReview: { type: Boolean, default: false },
    roleGiven: { type: Boolean, default: false },
    status: { type: String, enum: ['IDLE', 'VERIFYING', 'TICKET'], default: 'IDLE' }
}, { timestamps: true });
export const VerificationModel = mongoose.model<IVerificationState>('Verification', VerificationSchema);
