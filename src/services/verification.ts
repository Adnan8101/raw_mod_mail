import moment from 'moment';
import { CONFIG } from '../config';
export interface OCRResult {
    text: string;
    fullText: string;
    detections?: any[];
}
export interface ValidationResult {
    valid: boolean;
    error?: string;
    timestampDetected?: string;
}
const getTimestampPriority = (detection: any, imageHeight: number): number => {
    if (!detection || !detection.boundingPoly || !detection.boundingPoly.vertices) return 0;
    const vertices = detection.boundingPoly.vertices;
    const yValues = vertices.map((v: any) => v.y || 0);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const avgY = (minY + maxY) / 2;
    const relativeY = avgY / imageHeight;
    if (relativeY <= 0.07 || relativeY >= 0.93) return 3;
    if (relativeY <= 0.15 || relativeY >= 0.85) return 2;
    return -1;
};
const FUZZY_TIMESTAMP_REGEX = /\b[\dIOSl]{1,2}[:;. ][\dIOloS]{2}\b/g;
const combineDetections = (detections: any[]): string[] => {
    const combined: string[] = [];
    const sorted = detections.slice(1).sort((a: any, b: any) => {
        const yDiff = (a.boundingPoly.vertices[0].y || 0) - (b.boundingPoly.vertices[0].y || 0);
        if (Math.abs(yDiff) > 10) return yDiff;
        return (a.boundingPoly.vertices[0].x || 0) - (b.boundingPoly.vertices[0].x || 0);
    });
    for (let i = 0; i < sorted.length - 2; i++) {
        const p1 = sorted[i];
        const p2 = sorted[i + 1];
        const p3 = sorted[i + 2];
        const clean = (s: string) => s.replace(/[•·‧∙]/g, '.').replace(/[\u2000-\u200B]/g, ' ');
        const str = clean(p1.description + p2.description + p3.description);
        if (new RegExp(FUZZY_TIMESTAMP_REGEX).test(str)) {
            combined.push(str);
        }
        const str2 = clean(p1.description + p2.description);
        if (new RegExp(FUZZY_TIMESTAMP_REGEX).test(str2)) {
            combined.push(str2);
        }
    }
    return combined;
};
export const detectPlatform = (text: string): 'YOUTUBE' | 'INSTAGRAM' | 'UNKNOWN' => {
    if (CONFIG.REGEX.YOUTUBE_CHANNEL.test(text) || /Subscribe|Subscribed|videos|channel/i.test(text)) {
        return 'YOUTUBE';
    }
    if (CONFIG.REGEX.INSTAGRAM_ACCOUNT.test(text) || /Follow|Following|Followers|Posts/i.test(text)) {
        return 'INSTAGRAM';
    }
    return 'UNKNOWN';
};
export const validateYouTubeScreenshot = (ocrResult: OCRResult, referenceTime?: moment.Moment): ValidationResult => {
    const text = ocrResult.fullText;
    const detections = ocrResult.detections || [];
    if (detectPlatform(text) === 'INSTAGRAM') {
        return { valid: false, error: 'This looks like an Instagram screenshot. Please upload your **YouTube** proof.' };
    }
    if (!CONFIG.REGEX.YOUTUBE_CHANNEL.test(text)) {
        return { valid: false, error: 'Channel name "Rashika\'s Art Work" not found. Please ensure you are on the correct channel.' };
    }
    let subscribeFound = false;
    if (detections.length > 0) {
        const imageHeight = detections[0].boundingPoly.vertices.reduce((max: number, v: any) => Math.max(max, v.y || 0), 0);
        const subscribeDetections = detections.slice(1).filter((d: any) => /(^|\s)Subscribe(\s|$)/i.test(d.description));
        for (const d of subscribeDetections) {
            const y = d.boundingPoly.vertices[0].y || 0;
            if (y / imageHeight < 0.3) {
                subscribeFound = true;
                break;
            }
        }
    } else {
        if (/(^|\s)Subscribe(\s|$)/i.test(text)) {
            subscribeFound = true;
        }
    }
    if (subscribeFound) {
        return { valid: false, error: 'Found "Subscribe" button. You must be **Subscribed**.' };
    }
    if (/Unsubscribed/i.test(text)) {
        return { valid: false, error: 'Found "Unsubscribed" text. You must be **Subscribed**.' };
    }
    if (!CONFIG.REGEX.YOUTUBE_SUBSCRIPTION.test(text)) {
        return { valid: false, error: 'Subscription status not visible. Please make sure the "Subscribed" button is clearly visible.' };
    }
    let candidates: { time: string, priority: number }[] = [];
    if (detections.length > 0) {
        const wordDetections = detections.slice(1);
        const imageHeight = detections[0].boundingPoly.vertices.reduce((max: number, v: any) => Math.max(max, v.y || 0), 0);
        for (const detection of wordDetections) {
            const description = detection.description;
            if (new RegExp(FUZZY_TIMESTAMP_REGEX).test(description)) {
                let priority = getTimestampPriority(detection, imageHeight);
                if (detection.confidence) {
                    priority += detection.confidence * 2;
                }
                candidates.push({ time: description, priority });
            }
        }
        const combined = combineDetections(detections);
        for (const time of combined) {
            candidates.push({ time, priority: 2.5 });
        }
    }
    const timestampMatches = [...text.matchAll(FUZZY_TIMESTAMP_REGEX)];
    for (const match of timestampMatches) {
        const detectedTime = match[0];
        if (!candidates.some(c => c.time.includes(detectedTime))) {
            candidates.push({ time: detectedTime, priority: 1 });
        }
    }
    if (candidates.length === 0) {
        return { valid: false, error: 'No timestamp detected. Please ensure the system clock is visible in the screenshot.' };
    }
    candidates = candidates.filter(c => c.priority > 0);
    if (candidates.length === 0) {
        return { valid: false, error: 'No timestamp detected in status bar area. Please ensure the system clock at the top or bottom of your screen is visible.' };
    }
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
        const detectedTimes = candidates.map(c => c.time).join(', ');
        return { valid: false, error: `Timestamp verification failed. Ensure your device time is correct and visible. If this persists due to timezone issues, please request manual verification.` };
    }
    return { valid: true, timestampDetected: validTime };
};
export const validateInstagramScreenshot = (ocrResult: OCRResult, referenceTime?: moment.Moment): ValidationResult => {
    const text = ocrResult.fullText;
    const detections = ocrResult.detections || [];
    if (detectPlatform(text) === 'YOUTUBE') {
        return { valid: false, error: 'This looks like a YouTube screenshot. Please upload your **Instagram** proof.' };
    }
    if (!CONFIG.REGEX.INSTAGRAM_ACCOUNT.test(text)) {
        return { valid: false, error: 'Account "rashika.agarwal.79" not found. Please ensure you are on the correct profile.' };
    }
    const lines = text.split('\n');
    const followFound = lines.some(line => {
        const cleanLine = line.trim();
        if (/(^|\s)(Follow|Follow Back)(\s|$)/i.test(cleanLine)) {
            return cleanLine.length < 20;
        }
        return false;
    });
    if (followFound) {
        return { valid: false, error: 'Found "Follow" button. You must be **Following**.' };
    }
    if (!CONFIG.REGEX.INSTAGRAM_FOLLOWING.test(text)) {
        return { valid: false, error: 'Follow status not visible. Please make sure the "Following" button is clearly visible.' };
    }
    let candidates: { time: string, priority: number, isStrict: boolean }[] = [];
    const addCandidate = (time: string, priority: number, isStrict: boolean) => {
        if (!candidates.some(c => c.time === time)) {
            candidates.push({ time, priority, isStrict });
        }
    };
    if (detections.length > 0) {
        const wordDetections = detections.slice(1);
        const imageHeight = detections[0].boundingPoly.vertices.reduce((max: number, v: any) => Math.max(max, v.y || 0), 0);
        for (let i = 0; i < wordDetections.length; i++) {
            const detection = wordDetections[i];
            const description = detection.description;
            if (new RegExp(FUZZY_TIMESTAMP_REGEX).test(description)) {
                let timeStr = description;
                let isStrict = false;
                if (i + 1 < wordDetections.length) {
                    const next = wordDetections[i + 1];
                    if (/^(AM|PM)$/i.test(next.description)) {
                        const y1 = detection.boundingPoly.vertices[0].y || 0;
                        const y2 = next.boundingPoly.vertices[0].y || 0;
                        if (Math.abs(y1 - y2) < 20) {
                            timeStr = `${description} ${next.description}`;
                            isStrict = true;
                        }
                    }
                }
                if (/AM|PM/i.test(timeStr)) isStrict = true;
                let priority = getTimestampPriority(detection, imageHeight);
                if (detection.confidence) priority += detection.confidence * 2;
                if (isStrict) priority += 3;
                addCandidate(timeStr, priority, isStrict);
            }
        }
        const combined = combineDetections(detections);
        for (const time of combined) {
            const isStrict = /AM|PM/i.test(time);
            addCandidate(time, isStrict ? 5.5 : 2.5, isStrict);
        }
    }
    const timestampMatches = [...text.matchAll(FUZZY_TIMESTAMP_REGEX)];
    for (const match of timestampMatches) {
        const detectedTime = match[0];
        const index = match.index! + detectedTime.length;
        const nextChars = text.substring(index, index + 5);
        let finalTime = detectedTime;
        let isStrict = false;
        if (/^\s*(AM|PM)/i.test(nextChars)) {
            const meridiem = nextChars.match(/^\s*(AM|PM)/i)![0];
            finalTime = `${detectedTime}${meridiem}`;
            isStrict = true;
        }
        addCandidate(finalTime, isStrict ? 4 : 1, isStrict);
    }
    if (candidates.length === 0) {
        return { valid: false, error: 'No timestamp detected. Please ensure the system clock is visible in the screenshot.' };
    }
    const hasStrict = candidates.some(c => c.isStrict);
    if (hasStrict) {
        candidates = candidates.filter(c => c.isStrict);
    }
    candidates = candidates.filter(c => c.priority > 0 || c.isStrict);
    if (candidates.length === 0) {
        return { valid: false, error: 'No timestamp detected in status bar area. Please ensure the system clock at the top or bottom of your screen is visible.' };
    }
    candidates.sort((a, b) => b.priority - a.priority);
    const dateRegex = /\b(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{2,4})\b/;
    const dateMatch = text.match(dateRegex);
    let detectedDate: moment.Moment | null = null;
    if (dateMatch) {
        const dateStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
        const d1 = moment(dateStr, ['MM/DD/YYYY', 'DD/MM/YYYY', 'M/D/YYYY', 'D/M/YYYY'], true);
        if (d1.isValid()) {
            detectedDate = d1;
        }
    }
    let validTimeFound = false;
    let validTime = '';
    for (const candidate of candidates) {
        const possibleTimes = repairTimestamp(candidate.time);
        for (const time of possibleTimes) {
            if (isTimeValid(time, referenceTime, detectedDate)) {
                validTimeFound = true;
                validTime = time;
                break;
            }
        }
        if (validTimeFound) break;
    }
    if (!validTimeFound) {
        const detectedTimes = candidates.map(c => c.time).join(', ');
        return { valid: false, error: `Timestamp verification failed. Detected: [${detectedTimes}]. Ensure your device time is correct and visible. If this persists due to timezone issues, please request manual verification.` };
    }
    return { valid: true, timestampDetected: validTime };
};
function repairTimestamp(timeStr: string): string[] {
    const variations = new Set<string>();
    variations.add(timeStr);
    const fixed = timeStr
        .replace(/O/g, '0')
        .replace(/o/g, '0')
        .replace(/l/g, '1')
        .replace(/I/g, '1')
        .replace(/B/g, '8')
        .replace(/S/g, '5');
    variations.add(fixed);
    if (/AM|PM/i.test(timeStr)) {
        return Array.from(variations);
    }
    return Array.from(variations);
}
function isTimeValid(timeStr: string, referenceTime?: moment.Moment, detectedDate?: moment.Moment | null): boolean {
    const baseTime = referenceTime ? referenceTime.clone() : moment();
    if (checkTimeMatch(timeStr, baseTime, detectedDate)) return true;
    return false;
}
function checkTimeMatch(timeStr: string, referenceTime: moment.Moment, detectedDate?: moment.Moment | null): boolean {
    const hasMeridiem = /AM|PM/i.test(timeStr);
    const formats = hasMeridiem
        ? ['h:mm A', 'h:mm a', 'hh:mm A', 'hh:mm a']
        : ['HH:mm', 'H:mm'];
    const detected = moment(timeStr, formats, true);
    if (!detected.isValid()) {
        const looseDetected = moment(timeStr, ['HH:mm', 'h:mm A', 'h:mm a']);
        if (!looseDetected.isValid()) return false;
        detected.set({
            hour: looseDetected.hour(),
            minute: looseDetected.minute()
        });
    }
    if (detectedDate) {
        if (!detectedDate.isSame(referenceTime, 'day')) {
            return false;
        }
        detected.set({
            year: detectedDate.year(),
            month: detectedDate.month(),
            date: detectedDate.date()
        });
    } else {
        detected.set({
            year: referenceTime.year(),
            month: referenceTime.month(),
            date: referenceTime.date()
        });
    }
    const offsets = detectedDate ? [0] : [-1, 0, 1];
    for (const offset of offsets) {
        const comparisonTime = detected.clone().add(offset, 'days');
        const diff = Math.abs(referenceTime.diff(comparisonTime, 'minutes'));
        if (diff <= 720) return true;
        if (!hasMeridiem) {
            const comparisonTimePM = comparisonTime.clone().add(12, 'hours');
            const diffPM = Math.abs(referenceTime.diff(comparisonTimePM, 'minutes'));
            if (diffPM <= 720) {
                return true;
            }
            const comparisonTimeAM = comparisonTime.clone().subtract(12, 'hours');
            const diffAM = Math.abs(referenceTime.diff(comparisonTimeAM, 'minutes'));
            if (diffAM <= 720) {
                return true;
            }
        }
    }
    return false;
}
