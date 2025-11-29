import { Client, Interaction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { VerificationModel } from '../database/schema';
import { CONFIG } from '../config';
import { sendToManualReview } from './messageCreate';
import { getTargetRoleName, deleteModMailThread, getRoleMemberCount, sendVerificationLog } from '../utils/discord';

export const onInteractionCreate = async (client: Client, interaction: Interaction) => {
    if (!interaction.isButton()) return;

    const { customId, user } = interaction;
    const userId = user.id;

    try {
        if (customId === 'start_verification_flow') {
            await interaction.deferReply({ ephemeral: false });

            let userRecord = await VerificationModel.findOne({ userId });
            if (!userRecord) {
                userRecord = await VerificationModel.create({ userId });
            }

            // Check actual role status in the guild
            try {
                const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);

                    if (member && member.roles.cache.has(CONFIG.ROLES.EARLY_SUPPORTER)) {
                        // User HAS role -> Ensure DB says verified
                        if (!userRecord.roleGiven) {
                            userRecord.roleGiven = true;
                            await userRecord.save();
                        }
                        await interaction.editReply({ content: '<:tcet_tick:1437995479567962184> You are already verified as an Early Supporter.' });
                        return;
                    } else {
                        // User does NOT have role -> Ensure DB says NOT verified (allow re-verify)
                        if (userRecord.roleGiven) {
                            userRecord.roleGiven = false;
                            await userRecord.save();
                        }
                    }
                }
            } catch (e) {
                console.error('Error checking role:', e);
                // If we can't check, fallback to DB but warn? 
                // Or just proceed if DB says false.
                // If DB says true but we failed to check, we might block them. 
                // Let's assume if check fails, we rely on DB, but usually it won't fail if config is right.
                if (userRecord.roleGiven) {
                    await interaction.editReply({ content: '<:tcet_tick:1437995479567962184> You are already verified as an Early Supporter.' });
                    return;
                }
            }

            const roleName = await getTargetRoleName(client);

            const embed = new EmbedBuilder()
                .setTitle('Early Supporter Verification')
                .setDescription(`Welcome! Follow the steps to get **${roleName}**.\nMake sure each screenshot contains a **visible timestamp**.\nYou must subscribe & follow the official accounts.`)
                .addFields(
                    { name: '1. Subscribe YouTube', value: '[Link](https://www.youtube.com/@rashikasartwork)' },
                    { name: '2. Follow Instagram', value: '[Link](https://www.instagram.com/rashika.agarwal.79/)' }
                )
                .setColor('#0099ff');

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Subscribe YouTube')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://www.youtube.com/@rashikasartwork'),
                    new ButtonBuilder()
                        .setLabel('Follow Instagram')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://www.instagram.com/rashika.agarwal.79/')
                );

            const row2 = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('start_verification')
                        .setLabel('Start')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️'),
                    new ButtonBuilder()
                        .setCustomId('restart_verification')
                        .setLabel('Restart')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setCustomId('reset_verification')
                        .setLabel('Reset')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔴')
                );

            await interaction.editReply({ embeds: [embed], components: [row, row2] });

        } else if (customId === 'open_ticket') {
            await interaction.deferReply({ ephemeral: false });

            // Create ModMail thread if not exists
            const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
            if (logsChannel) {
                const activeThreads = await logsChannel.threads.fetchActive();
                let thread = activeThreads.threads.find(t => t.name.endsWith(userId));

                if (!thread) {
                    thread = await logsChannel.threads.create({
                        name: `ModMail - ${user.username} - ${userId}`,
                        autoArchiveDuration: 1440,
                        reason: 'New ModMail thread via Button'
                    });
                    await thread.send(`**ModMail Thread Started**\nUser: **${user.username}** (\`${userId}\`)\n\nUser opened a ticket via the menu.`);
                }

                await interaction.editReply({ content: '<:tcet_tick:1437995479567962184> **Ticket Created.**\nPlease type your message here to send it to our support team.' });
            } else {
                await interaction.editReply({ content: '❌ Error creating ticket. Please contact staff directly.' });
            }

        } else if (customId === 'start_verification') {
            await interaction.deferReply({ ephemeral: false });

            // Just show the steps again or check status
            let userRecord = await VerificationModel.findOne({ userId });
            if (!userRecord) {
                userRecord = await VerificationModel.create({ userId });
            }

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Subscribe YouTube')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://www.youtube.com/@rashikasartwork')
                );

            await interaction.editReply({
                content: 'Please upload your **YouTube** screenshot now.',
                components: [row]
            });

        } else if (customId === 'restart_verification') {
            await interaction.deferReply({ ephemeral: true });

            // Clear progress
            await VerificationModel.findOneAndUpdate({ userId }, {
                progress: { youtube: false, instagram: false },
                data: { youtubeScreenshot: null, instagramScreenshot: null, ocrYT: null, ocrIG: null },
                submittedForReview: false
            });

            await interaction.editReply({
                content: '🔄 **Verification Restarted.**\nPlease upload your **YouTube** screenshot to begin again.'
            });

        } else if (customId === 'reset_verification') {
            await interaction.deferReply({ ephemeral: true });

            // Delete record
            await VerificationModel.findOneAndDelete({ userId });

            const roleName = await getTargetRoleName(client);

            const embed = new EmbedBuilder()
                .setTitle('Early Supporter Verification')
                .setDescription(`Welcome! Follow the steps to get **${roleName}**.\nMake sure each screenshot contains a **visible timestamp**.\nYou must subscribe & follow the official accounts.`)
                .addFields(
                    { name: '1. Subscribe YouTube', value: '[Link](https://www.youtube.com/@rashikasartwork)' }
                )
                .setColor('#0099ff');

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('start_verification')
                        .setLabel('Start')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️'),
                    new ButtonBuilder()
                        .setCustomId('restart_verification')
                        .setLabel('Restart')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setCustomId('reset_verification')
                        .setLabel('Reset')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔴')
                );

            await interaction.editReply({
                content: '<:tcet_tick:1437995479567962184> **User Reset Complete.** Starting fresh...'
            });

            // Since ephemeral, we can't DM easily from here if we want to keep it clean, 
            // but the user asked for "once view visible to author". 
            // So we just show the menu again ephemerally.
            await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });

        } else if (customId === 'request_manual_review_yt' || customId === 'request_manual_review_ig') {
            await interaction.deferReply({ ephemeral: true });

            const userRecord = await VerificationModel.findOne({ userId });
            if (!userRecord) {
                await interaction.editReply({ content: '❌ No verification record found. Please start over.' });
                return;
            }

            if (customId === 'request_manual_review_yt') {
                userRecord.progress.youtube = true;
            }
            if (customId === 'request_manual_review_ig') {
                userRecord.progress.instagram = true;
            }

            await interaction.editReply({ content: '📝 **Manual Review Requested.**\nOur staff will review your screenshot shortly.' });

            if (!userRecord.progress.instagram && customId === 'request_manual_review_yt') {
                await user.send('Please now upload your **Instagram** screenshot.');
            } else {
                await sendToManualReview(client, userRecord, user);
            }

            await userRecord.save();
        } else if (customId.startsWith('admin_approve_')) {
            await interaction.deferReply({ ephemeral: false });

            const targetUserId = customId.split('_')[2];
            const userRecord = await VerificationModel.findOne({ userId: targetUserId });

            if (!userRecord) {
                await interaction.editReply({ content: '❌ User record not found.' });
                return;
            }

            // Check if already verified
            if (userRecord.roleGiven) {
                await interaction.editReply({ content: '⚠️ **User is already verified.**' });
                return;
            }

            try {
                // Use CONFIG.GUILD_ID to fetch guild
                const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
                if (!guild) {
                    await interaction.editReply({ content: '❌ Error: Configured Guild not found.' });
                    return;
                }

                const roleId = CONFIG.ROLES.EARLY_SUPPORTER;

                // Check limit
                const currentCount = await getRoleMemberCount(guild, roleId);
                if (currentCount >= CONFIG.MAX_EARLY_SUPPORTERS) {
                    await interaction.editReply({ content: `❌ **Verification Failed**\nThe maximum limit of **${CONFIG.MAX_EARLY_SUPPORTERS}** Early Supporters has been reached.` });
                    return;
                }

                const member = await guild.members.fetch(targetUserId);
                await member.roles.add(roleId);

                userRecord.roleGiven = true;
                userRecord.submittedForReview = false; // Done
                await userRecord.save();

                // Delete ModMail thread if exists
                await deleteModMailThread(client, targetUserId);

                const roleName = await getTargetRoleName(client);

                await member.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('Verification Successful!')
                        .setDescription(`You have been verified and given the **${roleName}** role.`)
                        .setColor('#00ff00')
                    ]
                });

                await interaction.editReply({ content: `<:tcet_tick:1437995479567962184> **Approved** by <@${user.id}>. Role assigned.` });

                // Log success
                await sendVerificationLog(client, member.user, currentCount + 1);

                // Disable buttons on the original message
                const message = interaction.message;
                const row = ActionRowBuilder.from(message.components[0] as any);
                row.components.forEach((component: any) => component.setDisabled(true));
                await message.edit({ components: [row as any] });

            } catch (error) {
                console.error('Error approving user:', error);
                await interaction.editReply({ content: '❌ Error assigning role. Check bot permissions.' });
            }

        } else if (customId.startsWith('admin_reject_')) {
            await interaction.deferReply({ ephemeral: false });

            const targetUserId = customId.split('_')[2];
            const userRecord = await VerificationModel.findOne({ userId: targetUserId });

            if (userRecord) {
                userRecord.submittedForReview = false;
                userRecord.progress.youtube = false;
                userRecord.progress.instagram = false;
                await userRecord.save();
            }

            try {
                const targetUser = await client.users.fetch(targetUserId);
                await targetUser.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Verification Rejected')
                        .setDescription('Your verification request was rejected by staff.\nPlease ensure your screenshots are valid and try again.')
                        .setColor('#ff0000')
                    ]
                });
            } catch (e) {
                console.log('Could not DM user');
            }

            await interaction.editReply({ content: `❌ **Rejected** by <@${user.id}>. User notified.` });

            // Disable buttons
            const message = interaction.message;
            const row = ActionRowBuilder.from(message.components[0] as any);
            row.components.forEach((component: any) => component.setDisabled(true));
            await message.edit({ components: [row as any] });
        } else if (customId.startsWith('admin_start_chat_')) {
            await interaction.deferReply({ ephemeral: true }); // Keep this ephemeral as it's just a link

            const targetUserId = customId.split('_')[3];

            try {
                const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
                if (logsChannel) {
                    // Find or create thread
                    const activeThreads = await logsChannel.threads.fetchActive();
                    let thread = activeThreads.threads.find((t: any) => t.name.endsWith(targetUserId));

                    if (!thread) {
                        const targetUser = await client.users.fetch(targetUserId);
                        thread = await logsChannel.threads.create({
                            name: `ModMail - ${targetUser.username} - ${targetUserId}`,
                            autoArchiveDuration: 1440,
                            reason: 'Manual Chat Start'
                        });

                        await thread.send(`**ModMail Thread Started**\nUser: **${targetUser.username}** (\`${targetUserId}\`)\n\nType a message here to reply to the user.`);
                    }

                    await interaction.editReply({
                        content: `<:tcet_tick:1437995479567962184> **Chat Thread Ready:** <#${thread.id}> \nYou can chat with the user there.`
                    });
                } else {
                    await interaction.editReply({ content: '❌ Logs channel not found.' });
                }
            } catch (error) {
                console.error('Error starting chat:', error);
                await interaction.editReply({ content: '❌ Error starting chat.' });
            }
        }
    } catch (error) {
        console.error('Interaction Error:', error);
        // Try to reply if not already replied/deferred
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => { });
            } else {
                await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true }).catch(() => { });
            }
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
};

