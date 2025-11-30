import { Client, TextChannel, Guild, User, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
export const getRoleMemberCount = async (guild: Guild, roleId: string): Promise<number> => {
    try {
        await guild.members.fetch(); 
        const role = await guild.roles.fetch(roleId);
        return role ? role.members.size : 0;
    } catch (error) {
        console.error('Error fetching role member count:', error);
        return 0;
    }
};
export const sendVerificationLog = async (client: Client, user: User, count: number, imageURLs: string[] = []) => {
    try {
        const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
        if (!logsChannel) return;
        const embed = new EmbedBuilder()
            .setTitle('User Verified')
            .setDescription(`**User:** ${user.tag} (${user.id})\n**Count:** ${count}/${CONFIG.MAX_EARLY_SUPPORTERS}`)
            .setColor('#00ff00')
            .setTimestamp();
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`revoke_verification_${user.id}`)
                    .setLabel('Revoke')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );
        await logsChannel.send({
            embeds: [embed],
            files: imageURLs,
            components: [row]
        });
    } catch (error) {
        console.error('Error sending verification log:', error);
    }
};
