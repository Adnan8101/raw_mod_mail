import { Client, TextChannel } from 'discord.js';
import { CONFIG } from '../config';

export const getTargetRoleName = async (client: Client): Promise<string> => {
    try {
        const channel = await client.channels.fetch(CONFIG.CHANNELS.MANUAL_REVIEW) as TextChannel;
        if (!channel) return 'Early Supporter';

        const guild = channel.guild;
        const role = await guild.roles.fetch(CONFIG.ROLES.EARLY_SUPPORTER);
        return role ? role.name : 'Early Supporter';
    } catch (error) {
        console.error('Error fetching role name:', error);
        return 'Early Supporter';
    }
};

export const deleteModMailThread = async (client: Client, userId: string) => {
    try {
        const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
        if (!logsChannel) return;

        const activeThreads = await logsChannel.threads.fetchActive();
        const thread = activeThreads.threads.find(t => t.name.endsWith(userId));

        if (thread) {
            await thread.delete('User Verified');
        }
    } catch (error) {
        console.error('Error deleting ModMail thread:', error);
    }
};
