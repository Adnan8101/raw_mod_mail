import { Client, Interaction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { VerificationModel } from '../database/schema';
import { CONFIG } from '../config';
import { sendToManualReview } from './messageCreate';
import { getTargetRoleName, deleteModMailThread, getRoleMemberCount, sendVerificationLog } from '../utils/discord';

export const onInteractionCreate = async (client: Client, interaction: Interaction) => {
    if (!interaction.isButton()) return;

    const { customId, user } = interaction;
    const userId = user.id;

    if (customId === 'start_verification') {
        // Just show the steps again or check status
        let userRecord = await VerificationModel.findOne({ userId });
        if (!userRecord) {
            userRecord = await VerificationModel.create({ userId });
        }

        const roleName = await getTargetRoleName(client);

        const embed = new EmbedBuilder()
            .setTitle('Early Supporter Verification')
            .setDescription(`Welcome! Follow the steps to get ** ${roleName}**.\nMake sure each screenshot contains a ** visible timestamp **.\nYou must subscribe & follow the official accounts.`)
            .addFields(
                { name: '1. Subscribe YouTube', value: '[Link](https://www.youtube.com/@rashikasartwork)' },
                { name: '2. Follow Instagram', value: '[Link](https://www.instagram.com/rashika.agarwal.79/)' }
            )
            .setColor('#0099ff');

        await interaction.reply({ embeds: [embed], ephemeral: false });

    } else if (customId === 'restart_verification') {
        // Clear progress
        await VerificationModel.findOneAndUpdate({ userId }, {
            progress: { youtube: false, instagram: false },
            data: { youtubeScreenshot: null, instagramScreenshot: null, ocrYT: null, ocrIG: null },
            submittedForReview: false
        });

        await interaction.reply({
            content: '🔄 **Verification Restarted.**\nPlease upload your **YouTube** screenshot to begin again.',
            ephemeral: false
        });

    } else if (customId === 'reset_verification') {
        // Delete record
        await VerificationModel.findOneAndDelete({ userId });

        const roleName = await getTargetRoleName(client);

        const embed = new EmbedBuilder()
            .setTitle('Early Supporter Verification')
            .setDescription(`Welcome! Follow the steps to get ** ${roleName}**.\nMake sure each screenshot contains a ** visible timestamp **.\nYou must subscribe & follow the official accounts.`)
            .addFields(
                { name: '1. Subscribe YouTube', value: '[Link](https://www.youtube.com/@rashikasartwork)' },
                { name: '2. Follow Instagram', value: '[Link](https://www.instagram.com/rashika.agarwal.79/)' }
            )
            .setColor('#0099ff');

        // We can't reply with the "Welcome" message effectively if we want it to look like a fresh start in DM, 
        // but we can send a new message.
        // However, since this is a button click, we should reply to the interaction.

        // Create buttons again
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

        await interaction.reply({
            content: '✅ **User Reset Complete.** Starting fresh...',
            ephemeral: false
        });

        await user.send({ embeds: [embed], components: [row] });

    } else if (customId === 'request_manual_review_yt' || customId === 'request_manual_review_ig') {
        const userRecord = await VerificationModel.findOne({ userId });
        if (!userRecord) {
            await interaction.reply({ content: '❌ No verification record found. Please start over.', ephemeral: false });
            return;
        }

        // Mark as submitted for review even if OCR failed
        // We might want to mark which step failed, but for now just sending what we have
        if (customId === 'request_manual_review_yt') {
            userRecord.progress.youtube = true; // Skip YT check effectively for the bot flow, but manual review will see it failed
        }
        if (customId === 'request_manual_review_ig') {
            userRecord.progress.instagram = true;
        }

        await interaction.reply({ content: '📝 **Manual Review Requested.**\nOur staff will review your screenshot shortly.', ephemeral: false });

        // If both are now "done" (or skipped), send to manual review
        // But wait, if they request manual review for YT, they still need to do IG?
        // The user said "if verify is doubtful send image to manually verify".
        // If they fail YT and request manual review, should they proceed to IG?
        // Probably yes, otherwise they are stuck.

        if (!userRecord.progress.instagram && customId === 'request_manual_review_yt') {
            await user.send('Please now upload your **Instagram** screenshot.');
        } else {
            // If this was IG, or if they already did IG (unlikely order but possible), send to review
            await sendToManualReview(client, userRecord, user);
        }

        await userRecord.save();
    } else if (customId.startsWith('admin_approve_')) {
        const targetUserId = customId.split('_')[2];
        const userRecord = await VerificationModel.findOne({ userId: targetUserId });

        if (!userRecord) {
            await interaction.reply({ content: '❌ User record not found.', ephemeral: false });
            return;
        }

        try {
            const guild = interaction.guild;
            if (!guild) return;

            const roleId = CONFIG.ROLES.EARLY_SUPPORTER;

            // Check limit
            const currentCount = await getRoleMemberCount(guild, roleId);
            if (currentCount >= CONFIG.MAX_EARLY_SUPPORTERS) {
                await interaction.reply({ content: `❌ **Verification Failed**\nThe maximum limit of **${CONFIG.MAX_EARLY_SUPPORTERS}** Early Supporters has been reached.`, ephemeral: false });
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
                    .setTitle(' Verification Successful!')
                    .setDescription(`You have been verified and given the ** ${roleName}** role.`)
                    .setColor('#00ff00')
                ]
            });

            await interaction.reply({ content: `✅ ** Approved ** by < @${user.id}>.Role assigned.`, ephemeral: false });

            // Log success
            await sendVerificationLog(client, member.user, currentCount + 1);

            // Disable buttons on the original message
            const message = interaction.message;
            const row = ActionRowBuilder.from(message.components[0] as any);
            row.components.forEach((component: any) => component.setDisabled(true));
            await message.edit({ components: [row as any] });

        } catch (error) {
            console.error('Error approving user:', error);
            await interaction.reply({ content: '❌ Error assigning role. Check bot permissions.', ephemeral: false });
        }

    } else if (customId.startsWith('admin_reject_')) {
        const targetUserId = customId.split('_')[2];
        const userRecord = await VerificationModel.findOne({ userId: targetUserId });

        if (userRecord) {
            // Reset progress so they can try again? Or just notify?
            // Usually reject means try again.
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

        await interaction.reply({ content: `❌ ** Rejected ** by < @${user.id}>.User notified.`, ephemeral: false });

        // Disable buttons
        const message = interaction.message;
        const row = ActionRowBuilder.from(message.components[0] as any);
        row.components.forEach((component: any) => component.setDisabled(true));
        await message.edit({ components: [row as any] });
    } else if (customId.startsWith('admin_start_chat_')) {
        const targetUserId = customId.split('_')[3];

        try {
            const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
            if (logsChannel) {
                // Find or create thread
                const activeThreads = await logsChannel.threads.fetchActive();
                let thread = activeThreads.threads.find((t: any) => t.name.endsWith(targetUserId));

                if (!thread) {
                    // Need username, but we only have ID here. 
                    // We can fetch the user.
                    const targetUser = await client.users.fetch(targetUserId);
                    thread = await logsChannel.threads.create({
                        name: `ModMail - ${targetUser.username} - ${targetUserId}`,
                        autoArchiveDuration: 1440,
                        reason: 'Manual Chat Start'
                    });

                    await thread.send(`**ModMail Thread Started**\nUser: **${targetUser.username}** (\`${targetUserId}\`)\n\nType a message here to reply to the user.`);
                }

                await interaction.reply({
                    content: `✅ ** Chat Thread Ready:** <#${thread.id}> \nYou can chat with the user there.`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({ content: '❌ Logs channel not found.', ephemeral: true });
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            await interaction.reply({ content: '❌ Error starting chat.', ephemeral: true });
        }
    }
};
