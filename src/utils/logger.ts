import { Client, TextChannel } from 'discord.js';
import { CONFIG } from '../config';
export const logToChannel = async (client: Client, message: string) => {
    try {
        const channel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
        if (channel) {
            await channel.send(message);
        }
    } catch (error) {
        console.error('Failed to log to channel:', error);
    }
};
