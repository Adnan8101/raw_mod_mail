/**
 * Time Utility Functions
 */

/**
 * Parse a duration string into seconds
 * Supports formats like: 1h, 30m, 4s, 1m 30s
 */
export function parseDuration(input: string): number | null {
    if (!input) return null;

    // If it's just a number, treat as seconds
    if (/^\d+$/.test(input)) {
        return parseInt(input, 10);
    }

    const regex = /(\d+)\s*(d|h|m|s)/g;
    let totalSeconds = 0;
    let match;
    let found = false;

    while ((match = regex.exec(input)) !== null) {
        found = true;
        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 'd':
                totalSeconds += value * 86400;
                break;
            case 'h':
                totalSeconds += value * 3600;
                break;
            case 'm':
                totalSeconds += value * 60;
                break;
            case 's':
                totalSeconds += value;
                break;
        }
    }

    return found ? totalSeconds : null;
}

/**
 * Format seconds into a human-readable string
 * e.g., 3665 -> "1h 1m 5s"
 */
export function formatDuration(seconds: number): string {
    if (seconds === 0) return '0s';

    const units = [
        { label: 'd', value: 86400 },
        { label: 'h', value: 3600 },
        { label: 'm', value: 60 },
        { label: 's', value: 1 },
    ];

    const parts: string[] = [];
    let remaining = seconds;

    for (const unit of units) {
        if (remaining >= unit.value) {
            const count = Math.floor(remaining / unit.value);
            remaining %= unit.value;
            parts.push(`${count}${unit.label}`);
        }
    }

    return parts.join(' ');
}

/**
 * Format seconds into a verbose human-readable string
 * e.g., 3665 -> "1 hour 1 minute 5 seconds"
 */
export function formatDurationVerbose(seconds: number): string {
    if (seconds === 0) return '0 seconds';

    const units = [
        { label: 'day', value: 86400 },
        { label: 'hour', value: 3600 },
        { label: 'minute', value: 60 },
        { label: 'second', value: 1 },
    ];

    const parts: string[] = [];
    let remaining = seconds;

    for (const unit of units) {
        if (remaining >= unit.value) {
            const count = Math.floor(remaining / unit.value);
            remaining %= unit.value;
            parts.push(`${count} ${unit.label}${count !== 1 ? 's' : ''}`);
        }
    }

    return parts.join(' ');
}
