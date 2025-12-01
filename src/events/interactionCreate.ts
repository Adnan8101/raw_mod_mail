import { Client, Interaction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, DMChannel, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } from 'discord.js';
import { VerificationModel } from '../database/schema';
import { CONFIG } from '../config';
import { sendToManualReview } from './messageCreate';
import { getTargetRoleName, deleteModMailThread, getRoleMemberCount, sendVerificationLog } from '../utils/discord';
export const onInteractionCreate = async (client: Client, interaction: Interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const { getGameManager } = await import('../commands/Guess the Number/gameInstance');
            const { handleGuessTheNumberCommand } = await import('../commands/Guess the Number/gtn');
            const { handleMemoryCommand } = await import('../commands/Memory Game/memory');
            const { handleMathCommand } = await import('../commands/Math Game/math');
            const { handleHiddenNumberCommand } = await import('../commands/Hidden Number/hidden');
            const { handleSetPrefixCommand } = await import('../commands/Moderation/setprefix');
            const { handleStealCommand } = await import('../commands/Moderation/steal');
            const { handleRestrictCommand } = await import('../commands/Name Prevention/restrict');
            const { handleEquationCommand } = await import('../commands/Emoji Equation/equation');

            const gameManager = getGameManager(client);
            await handleGuessTheNumberCommand(interaction, gameManager);
            await handleMemoryCommand(interaction);
            await handleMathCommand(interaction);
            await handleHiddenNumberCommand(interaction);
            await handleSetPrefixCommand(interaction);
            await handleStealCommand(interaction);
            await handleRestrictCommand(interaction);
            await handleEquationCommand(interaction);

            if (interaction.replied || interaction.deferred) return;

            if (interaction.commandName === 'clear-my-dm') {
                await interaction.deferReply({ ephemeral: true });
                if (!interaction.channel?.isDMBased()) {
                    await interaction.editReply('This command can only be used in DMs.');
                    return;
                }
                try {
                    const channel = interaction.channel as DMChannel;
                    const messages = await channel.messages.fetch({ limit: 100 });
                    const botMessages = messages.filter(m => m.author.id === client.user?.id);
                    if (botMessages.size === 0) {
                        await interaction.editReply('No messages found to delete.');
                        return;
                    }
                    await interaction.editReply(`Found ${botMessages.size} messages.Deleting...`);
                    for (const msg of botMessages.values()) {
                        try {
                            await msg.delete();
                        } catch (e) {
                            console.error(`Failed to delete message ${msg.id}: `, e);
                        }
                    }
                    await interaction.followUp({ content: '✅ **Cleared all my messages.**', ephemeral: true });
                } catch (error) {
                    console.error('Error clearing DMs:', error);
                    await interaction.editReply('❌ An error occurred while clearing messages.');
                }
            }
            return;
        }
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('reject_reason_')) {
                await interaction.deferReply({ ephemeral: false });
                const targetUserId = interaction.customId.split('_')[2];
                const reason = interaction.fields.getTextInputValue('reason');
                const adminUser = interaction.user;
                const userRecord = await VerificationModel.findOne({ userId: targetUserId });
                if (userRecord) {
                    userRecord.submittedForReview = false;
                    userRecord.progress.youtube = false;
                    userRecord.progress.instagram = false;
                    userRecord.roleGiven = false;
                    await userRecord.save();
                }
                try {
                    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
                    const member = await guild.members.fetch(targetUserId).catch(() => null);
                    if (member) {
                        await member.roles.remove(CONFIG.ROLES.EARLY_SUPPORTER).catch(() => { });
                    }
                } catch (e) {
                    console.error('Error removing role:', e);
                }
                try {
                    const targetUser = await client.users.fetch(targetUserId);
                    await targetUser.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('❌ Verification Rejected')
                            .setDescription(`Your verification request was rejected by staff.\n\n ** Reason:** ${reason} \n\nPlease ensure your screenshots are valid and try again.`)
                            .setColor('#ff0000')
                        ]
                    });
                } catch (e) {
                }
                await interaction.editReply({ content: `❌ ** Rejected ** by < @${adminUser.id}>.\n ** Reason:** ${reason} \nUser notified and role removed(if present).` });
                if (interaction.message) {
                    try {
                        const row = ActionRowBuilder.from(interaction.message.components[0] as any);
                        row.components.forEach((component: any) => component.setDisabled(true));
                        await interaction.message.edit({ components: [row as any] });
                    } catch (e) {
                    }
                }
            } else if (interaction.customId.startsWith('revoke_reason_')) {
                await interaction.deferReply({ ephemeral: false });
                const targetUserId = interaction.customId.split('_')[2];
                const reason = interaction.fields.getTextInputValue('reason');
                const adminUser = interaction.user;
                try {
                    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
                    const member = await guild.members.fetch(targetUserId).catch(() => null);
                    if (member) {
                        await member.roles.remove(CONFIG.ROLES.EARLY_SUPPORTER).catch(() => { });
                    }
                } catch (e) {
                    console.error('Error removing role:', e);
                }
                await VerificationModel.findOneAndDelete({ userId: targetUserId });
                if (interaction.message) {
                    try {
                        const row = ActionRowBuilder.from(interaction.message.components[0] as any);
                        row.components.forEach((component: any) => component.setDisabled(true));
                        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
                        embed.setColor('#ff0000');
                        embed.addFields({ name: 'Revoked By', value: `${adminUser.tag} (${adminUser.id})`, inline: false });
                        embed.addFields({ name: 'Reason', value: reason, inline: false });
                        await interaction.message.edit({ embeds: [embed], components: [row as any] });
                    } catch (e) {
                        console.error('Error updating log message:', e);
                    }
                }
                await interaction.editReply({ content: `✅ **Verification Revoked** for <@${targetUserId}>.\n**Revoked by:** <@${adminUser.id}>\n**Reason:** ${reason}` });
                try {
                    const targetUser = await client.users.fetch(targetUserId);
                    await targetUser.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('Verification Revoked')
                            .setDescription(`Your Early Supporter status has been revoked by staff.\n\n ** Reason:** ${reason} \n\nYou may re - apply if you believe this is an error.`)
                            .setColor('#ff0000')
                        ]
                    });
                } catch (e) {
                }
            }
            return;
        }
        if (interaction.isButton()) {
            const { customId, user } = interaction;
            const userId = user.id;
            if (customId === 'start_verification_flow') {
                await interaction.deferReply({ ephemeral: true });
                let userRecord = await VerificationModel.findOne({ userId });
                if (!userRecord) {
                    userRecord = await VerificationModel.create({ userId, status: 'VERIFYING' });
                } else {
                    userRecord.status = 'VERIFYING';
                    await userRecord.save();
                }
                try {
                    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
                    if (guild) {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member && member.roles.cache.has(CONFIG.ROLES.EARLY_SUPPORTER)) {
                            if (!userRecord.roleGiven) {
                                userRecord.roleGiven = true;
                                await userRecord.save();
                            }
                            await interaction.editReply({ content: '<:tcet_tick:1437995479567962184> You are already verified as an Early Supporter.' });
                            return;
                        } else {
                            if (userRecord.roleGiven) {
                                userRecord.roleGiven = false;
                                await userRecord.save();
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error checking role:', e);
                    if (userRecord.roleGiven) {
                        await interaction.editReply({ content: '<:tcet_tick:1437995479567962184> You are already verified as an Early Supporter.' });
                        return;
                    }
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
                if (interaction.channel) {
                    await (interaction.channel as TextChannel).send({ content: `<@${userId}>`, embeds: [embed], components: [row, row2] });
                    await interaction.editReply({ content: '✅ Verification started below.', embeds: [], components: [] });
                } else {
                    await interaction.editReply({ embeds: [embed], components: [row, row2] });
                }
            } else if (customId === 'open_ticket') {
                await interaction.deferReply({ ephemeral: true });
                await VerificationModel.findOneAndUpdate({ userId }, { status: 'TICKET' }, { upsert: true });
                const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
                if (logsChannel) {
                    const activeThreads = await logsChannel.threads.fetchActive();
                    let thread = activeThreads.threads.find(t => t.name.endsWith(userId));
                    if (!thread) {
                        thread = await logsChannel.threads.create({
                            name: `ModMail - ${user.username} - ${userId} `,
                            autoArchiveDuration: 1440,
                            reason: 'New ModMail thread via Button'
                        });
                        await thread.send(`** ModMail Thread Started **\nUser: ** ${user.username}** (\`${userId}\`)\n\nUser opened a ticket via the menu.`);
                    }
                    if (interaction.channel && interaction.channel.type === ChannelType.GuildText) {
                        await (interaction.channel as TextChannel).send({
                            embeds: [new EmbedBuilder()
                                .setDescription('<:tcet_tick:1437995479567962184> **Ticket Created.**\nPlease type your message here to send it to our support team.')
                                .setColor('#00ff00')
                            ]
                        });
                    }
                    await interaction.editReply({ content: '✅ Ticket created.' });
                } else {
                    await interaction.editReply({ content: '❌ Error creating ticket. Please contact staff directly.' });
                }
            } else if (customId === 'start_verification') {
                await interaction.deferReply({ ephemeral: true });
                let userRecord = await VerificationModel.findOne({ userId });
                if (!userRecord) {
                    userRecord = await VerificationModel.create({ userId, status: 'VERIFYING' });
                } else {
                    userRecord.status = 'VERIFYING';
                    await userRecord.save();
                }
                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Subscribe YouTube')
                            .setStyle(ButtonStyle.Link)
                            .setURL('https://www.youtube.com/@rashikasartwork')
                    );
                if (interaction.channel) {
                    await (interaction.channel as TextChannel).send({
                        content: `<@${userId}> Please upload your **YouTube** screenshot now.`,
                        components: [row]
                    });
                    await interaction.editReply({ content: '✅ Please upload below.', components: [] });
                } else {
                    await interaction.editReply({
                        content: 'Please upload your **YouTube** screenshot now.',
                        components: [row]
                    });
                }
            } else if (customId === 'restart_verification') {
                await interaction.deferReply({ ephemeral: true });
                await VerificationModel.findOneAndUpdate({ userId }, {
                    progress: { youtube: false, instagram: false },
                    data: { youtubeScreenshot: null, instagramScreenshot: null, ocrYT: null, ocrIG: null },
                    submittedForReview: false,
                    status: 'VERIFYING'
                });
                if (interaction.channel) {
                    await (interaction.channel as TextChannel).send({
                        content: `<@${userId}> 🔄 **Verification Restarted.**\nPlease upload your **YouTube** screenshot to begin again.`
                    });
                    await interaction.editReply({ content: '✅ Restarted below.' });
                } else {
                    await interaction.editReply({
                        content: '🔄 **Verification Restarted.**\nPlease upload your **YouTube** screenshot to begin again.'
                    });
                }
            } else if (customId === 'reset_verification') {
                await interaction.deferReply({ ephemeral: true });
                await VerificationModel.findOneAndDelete({ userId });
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
                if (interaction.channel) {
                    await (interaction.channel as TextChannel).send({
                        content: `<@${userId}> <:tcet_tick:1437995479567962184> **User Reset Complete.** Starting fresh...`,
                        embeds: [embed],
                        components: [row]
                    });
                    await interaction.editReply({ content: '✅ Reset complete below.', embeds: [], components: [] });
                } else {
                    await interaction.editReply({
                        content: '<:tcet_tick:1437995479567962184> **User Reset Complete.** Starting fresh...',
                        embeds: [embed],
                        components: [row]
                    });
                }
            } else if (customId === 'request_manual_review_yt' || customId === 'request_manual_review_ig') {
                await interaction.deferUpdate();
                const userRecord = await VerificationModel.findOne({ userId });
                if (!userRecord) {
                    await interaction.editReply({ content: '❌ No verification record found. Please start over.', embeds: [], components: [] });
                    return;
                }
                userRecord.status = 'TICKET';
                if (customId === 'request_manual_review_yt') {
                    userRecord.progress.youtube = true;
                }
                if (customId === 'request_manual_review_ig') {
                    userRecord.progress.instagram = true;
                }
                let responseContent = '📝 **Manual Review Requested.**\nOur staff will review your screenshot shortly.';
                await sendToManualReview(client, userRecord, user);
                await userRecord.save();
                if (interaction.message) {
                    await interaction.message.edit({ content: responseContent, embeds: [], components: [] });
                } else {
                    await interaction.editReply({ content: responseContent, embeds: [], components: [] });
                }
            } else if (customId.startsWith('admin_approve_')) {
                await interaction.deferReply({ ephemeral: false });
                const targetUserId = customId.split('_')[2];
                const userRecord = await VerificationModel.findOne({ userId: targetUserId });
                if (!userRecord) {
                    await interaction.editReply({ content: '❌ User record not found.' });
                    return;
                }
                if (userRecord.roleGiven) {
                    await interaction.editReply({ content: '⚠️ **User is already verified.**' });
                    return;
                }
                try {
                    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
                    if (!guild) {
                        await interaction.editReply({ content: '❌ Error: Configured Guild not found.' });
                        return;
                    }
                    const roleId = CONFIG.ROLES.EARLY_SUPPORTER;
                    const currentCount = await getRoleMemberCount(guild, roleId);
                    if (currentCount >= CONFIG.MAX_EARLY_SUPPORTERS) {
                        await interaction.editReply({ content: `❌ **Verification Failed**\nThe maximum limit of **${CONFIG.MAX_EARLY_SUPPORTERS}** Early Supporters has been reached.` });
                        return;
                    }
                    const member = await guild.members.fetch(targetUserId);
                    await member.roles.add(roleId);
                    userRecord.roleGiven = true;
                    userRecord.submittedForReview = false;
                    await userRecord.save();
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
                    const imageURLs = [userRecord.data?.youtubeScreenshot, userRecord.data?.instagramScreenshot].filter(Boolean) as string[];
                    await sendVerificationLog(client, member.user, currentCount + 1, imageURLs);
                    const message = interaction.message;
                    if (message && message.components && message.components.length > 0) {
                        const row = ActionRowBuilder.from(message.components[0] as any);
                        row.components.forEach((component: any) => component.setDisabled(true));
                        await message.edit({ components: [row as any] });
                    }
                } catch (error) {
                    console.error('Error approving user:', error);
                    await interaction.editReply({ content: '❌ Error assigning role. Check bot permissions.' });
                }
            } else if (customId.startsWith('admin_reject_')) {
                const targetUserId = customId.split('_')[2];
                const modal = new ModalBuilder()
                    .setCustomId(`reject_reason_${targetUserId}`)
                    .setTitle('Rejection Reason');
                const reasonInput = new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel('Why are you rejecting this user?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('e.g. Timestamp not visible, Wrong channel, Fake screenshot...')
                    .setRequired(true);
                const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
                modal.addComponents(firstActionRow);
                await interaction.showModal(modal);
            } else if (customId.startsWith('revoke_verification_')) {
                const targetUserId = customId.split('_')[2];
                const modal = new ModalBuilder()
                    .setCustomId(`revoke_reason_${targetUserId}`)
                    .setTitle('Revoke Verification');
                const reasonInput = new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel('Reason for revocation')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('e.g. Fake screenshot discovered later...')
                    .setRequired(true);
                const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
                modal.addComponents(row);
                await interaction.showModal(modal);
            } else if (customId.startsWith('admin_start_chat_')) {
                await interaction.deferReply({ ephemeral: true });
                const targetUserId = customId.split('_')[3];
                try {
                    const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
                    if (logsChannel) {
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
        }
    } catch (error) {
        console.error('Interaction Error:', error);
        try {
            if ('reply' in interaction) {
                const repliable = interaction as any;
                if (!repliable.replied && !repliable.deferred) {
                    await repliable.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => { });
                } else {
                    await repliable.followUp({ content: '❌ An error occurred.', ephemeral: true }).catch(() => { });
                }
            }
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
};
