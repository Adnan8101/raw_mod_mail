import moment from 'moment';
import { CONFIG } from '../config';

export interface OCRResult {
    text: string;
    fullText: string;
    detections?: any[]; // Google Cloud Vision detections
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
    timestampDetected?: string;
}

const repairTimestamp = (detectedTime: string): string[] => {
    const variations: Set<string> = new Set();
    variations.add(detectedTime);

    // Common OCR misinterpretations
    const replacements: { [key: string]: string[] } = {
        '1': ['7', 'I', 'l'],
        '7': ['1'],
        '3': ['8', '1'],
        '8': ['3'], // Removed '0' to prevent 8 <-> 0 timestamp jumps
        // '5': ['6', 'S'], // Removed 5 <-> 6 to prevent bypassing 5m window
        // '6': ['5'],
        'S': ['5'],
        '0': ['O', 'o'], // Removed '8' to prevent 0 <-> 8 timestamp jumps
        'O': ['0'],
        'o': ['0'],
        'I': ['1'],
        'l': ['1']
    };

    // Better approach: Normalize the string by replacing ALL confusing chars
    // This is tricky because mapping is one-to-many.

    // Alternative: Just generate variations for single swaps, and maybe double swaps?
    // Or just iterate through the string and build all combinations? (Can be expensive)
    // Given the string is short (4-5 chars), we can recurse.

    const generateVariations = (current: string, index: number) => {
        if (index === current.length) {
            if (CONFIG.REGEX.TIMESTAMP.test(current)) {
                variations.add(current);
            }
            // Also try replacing dot/space with colon if present
            if (current.includes('.') || current.includes(' ')) {
                const normalized = current.replace(/[. ]/g, ':');
                if (CONFIG.REGEX.TIMESTAMP.test(normalized)) {
                    variations.add(normalized);
                }
            }
            return;
        }

        const char = current[index];
        const options = [char];
        if (replacements[char]) {
            options.push(...replacements[char]);
        }

        // Also check reverse mappings
        for (const [key, values] of Object.entries(replacements)) {
            if (values.includes(char)) {
                options.push(key);
            }
        }

        for (const option of options) {
            generateVariations(current.substring(0, index) + option + current.substring(index + 1), index + 1);
        }
    };

    // Limit recursion depth/complexity? "14:00" is 5 chars. 
    // If every char has 2 options, that's 2^5 = 32. Very fast.
    generateVariations(detectedTime, 0);

    return Array.from(variations);
};

const getTimestampPriority = (detection: any, imageHeight: number): number => {
    if (!detection || !detection.boundingPoly || !detection.boundingPoly.vertices) return 0;

    const vertices = detection.boundingPoly.vertices;
    const yValues = vertices.map((v: any) => v.y || 0);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const avgY = (minY + maxY) / 2;

    const relativeY = avgY / imageHeight;

    // Priority 2: Top 15% (Status Bar) or Bottom 15% (Taskbar)
    if (relativeY <= 0.15 || relativeY >= 0.85) return 2;

    // Priority 0: Middle (Likely content/video duration)
    return 0;
};

// Regex to find potential timestamps, including those with OCR errors (letters)
// Fixed regex to include '5' (via \d) and 'S' explicitly if needed, but \d covers 5.
// User requested [\dIOSl] to be safe.
const FUZZY_TIMESTAMP_REGEX = /\b[\dIOSl]{1,2}[:;. ][\dIOloS]{2}\b/g;

// Helper to combine adjacent detections that might form a timestamp (e.g. "1" ":" "37")
const combineDetections = (detections: any[]): string[] => {
    const combined: string[] = [];
    // Sort by Y then X to ensure reading order
    const sorted = detections.slice(1).sort((a: any, b: any) => {
        const yDiff = (a.boundingPoly.vertices[0].y || 0) - (b.boundingPoly.vertices[0].y || 0);
        if (Math.abs(yDiff) > 10) return yDiff; // Different lines
        return (a.boundingPoly.vertices[0].x || 0) - (b.boundingPoly.vertices[0].x || 0);
    });

    for (let i = 0; i < sorted.length - 2; i++) {
        const p1 = sorted[i];
        const p2 = sorted[i + 1];
        const p3 = sorted[i + 2];

        // Normalize text to handle bullets, thin spaces, etc.
        const clean = (s: string) => s.replace(/[•·‧∙]/g, '.').replace(/[\u2000-\u200B]/g, ' ');

        // Check if they are close horizontally
        // Simple check: "1" + ":" + "37"
        const str = clean(p1.description + p2.description + p3.description);
        // Fix: Use new RegExp to avoid global state issues
        if (new RegExp(FUZZY_TIMESTAMP_REGEX).test(str)) {
            combined.push(str);
        }

        // Also check pairs: "1:" + "37" or "1" + ":37"
        const str2 = clean(p1.description + p2.description);
        if (new RegExp(FUZZY_TIMESTAMP_REGEX).test(str2)) {
            combined.push(str2);
        }
    }
    return combined;
};

export const validateYouTubeScreenshot = (ocrResult: OCRResult, referenceTime?: moment.Moment): ValidationResult => {
    const text = ocrResult.fullText;
    const detections = ocrResult.detections || [];

    // Check for Fake Screenshot (Gallery, Photos, etc.)
    if (/(Gallery|Photos|Screenshot|Recent|Files)/i.test(text)) {
        // Only fail if these are at the top or bottom (UI chrome)
        // But user said "If found near bottom". Let's be safe and just warn or fail if obvious.
        // "Do not upload gallery screenshot"
        // We'll check if it's a standalone word line or header.
        // For now, simple regex check as requested.
        return { valid: false, error: 'Do not upload gallery screenshot. Please upload the original screenshot.' };
    }

    // Check for channel name
    if (!CONFIG.REGEX.YOUTUBE_CHANNEL.test(text)) {
        return { valid: false, error: 'Channel name "Rashika\'s Art Work" not found.' };
    }

    // STRICT CHECK: Fail if "Subscribe" button is visible (meaning not subscribed)
    // or if "Unsubscribed" is visible.
    // Improved Regex to avoid matching "Subscribe" in recommendations
    // We only fail if "Subscribe" is found in the top 30% of the screen (header area)
    // OR if we don't have detections (fallback to strict check but safer regex)

    let subscribeFound = false;
    if (detections.length > 0) {
        const imageHeight = detections[0].boundingPoly.vertices.reduce((max: number, v: any) => Math.max(max, v.y || 0), 0);
        const subscribeDetections = detections.slice(1).filter((d: any) => /(^|\s)Subscribe(\s|$)/i.test(d.description));

        for (const d of subscribeDetections) {
            const y = d.boundingPoly.vertices[0].y || 0;
            if (y / imageHeight < 0.3) { // Top 30%
                subscribeFound = true;
                break;
            }
        }
    } else {
        // Fallback: Strict check if no detections
        if (/(^|\s)Subscribe(\s|$)/i.test(text)) {
            subscribeFound = true;
        }
    }

    if (subscribeFound) {
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
    // We iterate through detections to find timestamps and check their positions
    // If detections are missing (e.g. from older OCR calls), we fall back to text scan.

    let candidates: { time: string, priority: number }[] = [];

    // 1. Scan detections for timestamps
    if (detections.length > 0) {
        // The first detection is usually the full text, skip it.
        const wordDetections = detections.slice(1);
        const imageHeight = detections[0].boundingPoly.vertices.reduce((max: number, v: any) => Math.max(max, v.y || 0), 0);

        for (const detection of wordDetections) {
            const description = detection.description;
            // Fix: Use new RegExp or reset lastIndex to avoid state issues with global flag
            if (new RegExp(FUZZY_TIMESTAMP_REGEX).test(description)) {
                let priority = getTimestampPriority(detection, imageHeight);
                // Improvement: Add confidence weighting
                if (detection.confidence) {
                    priority += detection.confidence * 2;
                }
                candidates.push({ time: description, priority });
            }
        }

        // Improvement: Combine detections
        const combined = combineDetections(detections);
        for (const time of combined) {
            candidates.push({ time, priority: 2.5 }); // High priority for combined
        }
    }

    // 2. Fallback: Scan full text if no candidates found via detections (or if detections failed to split time correctly)
    // Sometimes "1:37" is split into "1" ":" "37" in detections, making it hard to find via regex on individual words.
    // So we ALSO scan the full text and try to match it to detections if possible, or just add it with low priority.
    const timestampMatches = [...text.matchAll(FUZZY_TIMESTAMP_REGEX)];

    for (const match of timestampMatches) {
        const detectedTime = match[0];
        // Check if we already have this candidate from detections (approximate check)
        if (!candidates.some(c => c.time.includes(detectedTime))) {
            candidates.push({ time: detectedTime, priority: 1 }); // Default priority for regex matches
        }
    }

    if (candidates.length === 0) {
        return { valid: false, error: 'No timestamp detected. Please ensure the time is visible.' };
    }

    // Sort candidates by priority (High -> Low)
    candidates.sort((a, b) => b.priority - a.priority);

    let validTimeFound = false;
    let validTime = '';

    for (const candidate of candidates) {
        const possibleTimes = repairTimestamp(candidate.time);

        for (const time of possibleTimes) {
            if (isTimeValid(time, referenceTime)) {
                validTimeFound = true;
                validTime = time;
                break;
            }
        }
        if (validTimeFound) break;
    }

    if (!validTimeFound) {
        const detectedTimes = candidates.map(c => `${c.time} (P${c.priority.toFixed(1)})`).join(', ');
        return { valid: false, error: `No valid timestamp found. Detected: [${detectedTimes}]. None are within ±5 minutes of current time.` };
    }

    return { valid: true, timestampDetected: validTime };
};

export const validateInstagramScreenshot = (ocrResult: OCRResult, referenceTime?: moment.Moment): ValidationResult => {
    const text = ocrResult.fullText;
    const detections = ocrResult.detections || [];

    // Check for Fake Screenshot
    if (/(Gallery|Photos|Screenshot|Recent|Files)/i.test(text)) {
        return { valid: false, error: 'Do not upload gallery screenshot. Please upload the original screenshot.' };
    }

    // Check for account name
    if (!CONFIG.REGEX.INSTAGRAM_ACCOUNT.test(text)) {
        return { valid: false, error: 'Account "rashika.agarwal.79" not found.' };
    }

    // STRICT CHECK: Fail if "Follow" or "Follow Back" is visible
    // Improved: Check each line. Only fail if the line contains "Follow"/"Follow Back" AND is short (likely a button).
    // This avoids matching "Follow my other account" or "Followers".
    const lines = text.split('\n');
    const followFound = lines.some(line => {
        const cleanLine = line.trim();
        // Check for exact match or word match in a short line
        if (/(^|\s)(Follow|Follow Back)(\s|$)/i.test(cleanLine)) {
            // If line is short (e.g. < 20 chars), it's likely the button or status
            return cleanLine.length < 20;
        }
        return false;
    });

    if (followFound) {
        return { valid: false, error: 'Found "Follow" button. You must be following.' };
    }

    // Check for "Following" (Positive check)
    // Note: This matches "Following" in stats too, but the negative checks above protect us.
    if (!CONFIG.REGEX.INSTAGRAM_FOLLOWING.test(text)) {
        return { valid: false, error: 'Follow status not visible. Make sure you are following.' };
    }

    // Check Timestamp
    let candidates: { time: string, priority: number }[] = [];

    // 1. Scan detections for timestamps
    if (detections.length > 0) {
        const wordDetections = detections.slice(1);
        const imageHeight = detections[0].boundingPoly.vertices.reduce((max: number, v: any) => Math.max(max, v.y || 0), 0);

        for (const detection of wordDetections) {
            const description = detection.description;
            // Fix: Use new RegExp
            if (new RegExp(FUZZY_TIMESTAMP_REGEX).test(description)) {
                let priority = getTimestampPriority(detection, imageHeight);
                // Improvement: Add confidence weighting
                if (detection.confidence) {
                    priority += detection.confidence * 2;
                }
                candidates.push({ time: description, priority });
            }
        }

        // Improvement: Combine detections
        const combined = combineDetections(detections);
        for (const time of combined) {
            candidates.push({ time, priority: 2.5 });
        }
    }

    // 2. Fallback: Scan full text
    const timestampMatches = [...text.matchAll(FUZZY_TIMESTAMP_REGEX)];

    for (const match of timestampMatches) {
        const detectedTime = match[0];
        if (!candidates.some(c => c.time.includes(detectedTime))) {
            candidates.push({ time: detectedTime, priority: 1 });
        }
    }

    if (candidates.length === 0) {
        return { valid: false, error: 'No timestamp detected. Please ensure the time is visible.' };
    }

    // Sort candidates by priority (High -> Low)
    candidates.sort((a, b) => b.priority - a.priority);

    let validTimeFound = false;
    let validTime = '';

    for (const candidate of candidates) {
        const possibleTimes = repairTimestamp(candidate.time);

        for (const time of possibleTimes) {
            if (isTimeValid(time, referenceTime)) {
                validTimeFound = true;
                validTime = time;
                break;
            }
        }
        if (validTimeFound) break;
    }

    if (!validTimeFound) {
        const detectedTimes = candidates.map(c => `${c.time} (P${c.priority.toFixed(1)})`).join(', ');
        return { valid: false, error: `No valid timestamp found. Detected: [${detectedTimes}]. None are within ±5 minutes of current time.` };
    }

    return { valid: true, timestampDetected: validTime };
};

const isTimeValid = (timeStr: string, referenceTime?: moment.Moment): boolean => {
    // Use provided reference time or default to current time
    const baseTime = referenceTime ? referenceTime.clone() : moment();

    // Check against System Time (UTC on VPS or passed reference)
    if (checkTimeMatch(timeStr, baseTime)) return true;

    // Check against IST (UTC + 5:30)
    if (!referenceTime) {
        if (checkTimeMatch(timeStr, moment().add(5, 'hours').add(30, 'minutes'))) return true;
    } else {
        if (checkTimeMatch(timeStr, baseTime.clone().add(5, 'hours').add(30, 'minutes'))) return true;
    }

    return false;
};

const checkTimeMatch = (timeStr: string, referenceTime: moment.Moment): boolean => {
    // Try parsing as is (24h or AM)
    const detected = moment(timeStr, 'HH:mm');

    // Check for date rollover (Yesterday, Today, Tomorrow)
    // This handles cases where screenshot was taken just before midnight but processed after
    const offsets = [-1, 0, 1];

    for (const offset of offsets) {
        const comparisonTime = detected.clone().set({
            year: referenceTime.year(),
            month: referenceTime.month(),
            date: referenceTime.date()
        }).add(offset, 'days');

        const diff = Math.abs(referenceTime.diff(comparisonTime, 'minutes'));
        if (diff <= 5) return true;

        // Also check 12h offset (AM/PM ambiguity)
        const comparisonTimePM = comparisonTime.clone().add(12, 'hours');
        const diffPM = Math.abs(referenceTime.diff(comparisonTimePM, 'minutes'));
        if (diffPM <= 5) return true;

        const comparisonTimeAM = comparisonTime.clone().subtract(12, 'hours');
        const diffAM = Math.abs(referenceTime.diff(comparisonTimeAM, 'minutes'));
        if (diffAM <= 5) return true;
    }

    return false;
};
