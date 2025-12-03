import dotenv from 'dotenv';
dotenv.config();
export const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN || '',
    CLIENT_ID: process.env.CLIENT_ID || '',
    MONGO_URI: process.env.MONGO_URI || '',
    MAX_EARLY_SUPPORTERS: 100,
    GUILD_ID: '1443827225291129004',
    CHANNELS: {
        MANUAL_REVIEW: '1444266836915916900',
        LOGS: '1444266836915916900'
    },
    ROLES: {
        EARLY_SUPPORTER: '1444266526520901734'
    },
    REGEX: {
        YOUTUBE_SUBSCRIPTION: /(?<!Un)Subscribed/i,
        YOUTUBE_CHANNEL: /Rashika's Art Work/i,
        INSTAGRAM_FOLLOWING: /\bFollowing\b/i,
        INSTAGRAM_ACCOUNT: /rashika\.agarwal\.79/i,
        TIMESTAMP: /(\d{1,2}:\d{2})/
    }
};
