import moment from 'moment';
import { CONFIG } from '../config';

interface OCRResult {
    text: string;
    fullText: string;
}

interface ValidationResult {
    valid: boolean;
    error?: string;
    timestampDetected?: string;
}

export const validateYouTubeScreenshot = (ocrResult: OCRResult): ValidationResult => {
    const text = ocrResult.fullText;

    // Check for channel name
    if (!CONFIG.REGEX.YOUTUBE_CHANNEL.test(text)) {
        return { valid: false, error: 'Channel name "Rashika\'s Art Work" not found.' };
    }

    // STRICT CHECK: Fail if "Subscribe" button is visible (meaning not subscribed)
    // or if "Unsubscribed" is visible.
    if (/\bSubscribe\b/i.test(text)) {
        return { valid: false, error: 'Found "Subscribe" button. You must be subscribed.' };
    }
    if (/Unsubscribed/i.test(text)) {
        return { valid: false, error: 'Found "Unsubscribed" text. You must be subscribed.' };
    }

    // Check for "Subscribed"
    if (!CONFIG.REGEX.YOUTUBE_SUBSCRIPTION.test(text)) {
        return { valid: false, error: 'Subscription status not visible. Make sure you are subscribed.' };
    }

    // Check Timestamp
    const timestampMatch = text.match(CONFIG.REGEX.TIMESTAMP);
    if (!timestampMatch) {
        return { valid: false, error: 'No timestamp detected. Please ensure the time is visible.' };
    }

    const detectedTime = timestampMatch[1];
    if (!isTimeValid(detectedTime)) {
        return { valid: false, error: `Timestamp ${detectedTime} is not within ±5 minutes of current time.` };
    }

    return { valid: true, timestampDetected: detectedTime };
};

export const validateInstagramScreenshot = (ocrResult: OCRResult): ValidationResult => {
    const text = ocrResult.fullText;

    // Check for account name
    if (!CONFIG.REGEX.INSTAGRAM_ACCOUNT.test(text)) {
        return { valid: false, error: 'Account "rashika.agarwal.79" not found.' };
    }

    // STRICT CHECK: Fail if "Follow" or "Follow Back" is visible
    // "Following" in stats (e.g. "210 Following") will match the positive regex, 
    // so we MUST fail if we see the "Follow" button.
    if (/\bFollow\b/i.test(text)) {
        return { valid: false, error: 'Found "Follow" button. You must be following.' };
    }
    if (/Follow Back/i.test(text)) {
        return { valid: false, error: 'Found "Follow Back" button. You must be following.' };
    }

    // Check for "Following" (Positive check)
    // Note: This matches "Following" in stats too, but the negative checks above protect us.
    if (!CONFIG.REGEX.INSTAGRAM_FOLLOWING.test(text)) {
        return { valid: false, error: 'Follow status not visible. Make sure you are following.' };
    }

    // Check Timestamp
    const timestampMatch = text.match(CONFIG.REGEX.TIMESTAMP);
    if (!timestampMatch) {
        return { valid: false, error: 'No timestamp detected. Please ensure the time is visible.' };
    }

    const detectedTime = timestampMatch[1];
    if (!isTimeValid(detectedTime)) {
        return { valid: false, error: `Timestamp ${detectedTime} is not within ±5 minutes of current time.` };
    }

    return { valid: true, timestampDetected: detectedTime };
};

const isTimeValid = (timeStr: string): boolean => {
    const now = moment();

    // Try parsing as is (24h or AM)
    const detected = moment(timeStr, 'HH:mm');
    detected.set({
        year: now.year(),
        month: now.month(),
        date: now.date()
    });

    // Check direct match (e.g. 16:07 vs 16:07 or 04:07 vs 04:07)
    if (Math.abs(now.diff(detected, 'minutes')) <= 5) return true;

    // Check 12-hour offset (e.g. 04:07 vs 16:07)
    // If detected is < 12:00, try adding 12 hours
    if (detected.hours() < 12) {
        detected.add(12, 'hours');
        if (Math.abs(now.diff(detected, 'minutes')) <= 5) return true;
    }
    // If detected is > 12:00, try subtracting 12 hours (unlikely for "4:07" but good for completeness)
    else {
        detected.subtract(12, 'hours');
        if (Math.abs(now.diff(detected, 'minutes')) <= 5) return true;
    }

    return false;
};
