import { Client, MessageReaction, PartialMessageReaction, User, PartialUser, TextChannel, EmbedBuilder, Partials } from 'discord.js';
import { prisma } from '../database/connect';
import { CONFIG } from '../config';
import { logToChannel } from '../utils/logger';

export const onMessageReactionAdd = async (client: Client, reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) return;
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }
    const message = reaction.message;
    if (message.channelId === CONFIG.CHANNELS.MANUAL_REVIEW) {
        const embed = message.embeds[0];
        if (!embed) return;
        const userIdField = embed.fields.find(f => f.name === 'User ID');
        if (!userIdField) return;
        const targetUserId = userIdField.value;

        const userRecord = await prisma.verification.findUnique({ where: { userId: targetUserId } });
        if (!userRecord) return;

        if (reaction.emoji.name === '✅' || reaction.emoji.id === '1437995479567962184') {
            try {
                const guild = await client.guilds.fetch(message.guildId!);
                const member = await guild.members.fetch(targetUserId);
                await member.roles.add(CONFIG.ROLES.EARLY_SUPPORTER, 'Verified by bot');

                await prisma.verification.update({
                    where: { userId: targetUserId },
                    data: { roleGiven: true }
                });

                try {
                    await member.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🎉 You\'re Verified!')
                            .setDescription('You have been approved manually by our staff team.\nThe Early Supporter role is now added.')
                            .setColor('#00ff00')]
                    });
                } catch (e) {
                    console.log('Could not DM user');
                }
                await logToChannel(client, `<:tcet_tick:1437995479567962184> **Verified:** <@${targetUserId}>\nRole Granted by Bot\nTimestamp: ${new Date().toLocaleString()}`);
                await message.reply(`<:tcet_tick:1437995479567962184> Approved by <@${user.id}>`);
            } catch (error) {
                console.error('Error approving user:', error);
                await message.reply('❌ Error assigning role. Check permissions.');
            }
        } else if (reaction.emoji.name === '❌') {
            try {
                await prisma.verification.update({
                    where: { userId: targetUserId },
                    data: {
                        youtubeProgress: false,
                        instagramProgress: false,
                        youtubeScreenshot: null,
                        instagramScreenshot: null,
                        submittedForReview: false
                    }
                });

                try {
                    const userObj = await client.users.fetch(targetUserId);
                    await userObj.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('❌ Verification Rejected')
                            .setDescription('Your verification was rejected by the review team.\nPlease re-submit both screenshots again.\nRestarting your verification process.')
                            .setColor('#ff0000')]
                    });
                } catch (e) {
                    console.log('Could not DM user');
                }
                await logToChannel(client, `❌ **Rejected:** <@${targetUserId}>\nVerification reset by <@${user.id}>.`);
                await message.reply(`❌ Rejected by <@${user.id}>`);
            } catch (error) {
                console.error('Error rejecting user:', error);
            }
        }
    }
};
