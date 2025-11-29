import { Client, Message, EmbedBuilder, TextChannel, AttachmentBuilder, Partials, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadChannel } from 'discord.js';
import { VerificationModel } from '../database/schema';
import { performOCR } from '../services/ocr';
import { validateYouTubeScreenshot, validateInstagramScreenshot } from '../services/verification';
import { CONFIG } from '../config';
import axios from 'axios';
import { getTargetRoleName, deleteModMailThread, getRoleMemberCount, sendVerificationLog } from '../utils/discord';

export const onMessageCreate = async (client: Client, message: Message) => {
    if (message.author.bot) return;

    // Handle Admin Replies (Guild -> DM)
    if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread) {
        const thread = message.channel as ThreadChannel;
        // Check if this thread is in the Logs channel
        if (thread.parentId === CONFIG.CHANNELS.LOGS) {
            // Try to parse user ID from thread name "User Name (ID)"
            // Or we can store it in the database? For simplicity, let's rely on thread name convention or topic
            // Convention: "username-userid" or just "userid" or "ModMail - username"
            // Let's assume we name threads "ModMail - <userId>"

            const parts = thread.name.split('-');
            const targetUserId = parts[parts.length - 1].trim();

            if (targetUserId && /^\d+$/.test(targetUserId)) {
                try {
                    const user = await client.users.fetch(targetUserId);
                    // Send as "Admin" (Bot)
                    // "from Admin only dont rveeal name"
                    // We can just send the content.

                    // Maybe add an embed or just text? User said "bot will jusrt send the same message from admin lookig ut real"
                    // So just the content.

                    if (message.content) {
                        await user.send(message.content);
                    }
                    if (message.attachments.size > 0) {
                        await user.send({
                            content: '**Admin sent an attachment:**',
                            files: message.attachments.map(a => a.url)
                        });
                    }
                    await message.react('✅');
                } catch (error) {
                    console.error('Failed to DM user:', error);
                    await message.react('❌');
                }
            }
            return;
        }
    }

    if (message.channel.type !== ChannelType.DM) return;

    const userId = message.author.id;
    let userRecord = await VerificationModel.findOne({ userId });
    const content = message.content.toLowerCase().trim();

    // Handle Text Commands
    if (content === 'start') {
        if (!userRecord) {
            userRecord = await VerificationModel.create({ userId });
        }
        // Fallthrough to show welcome embed
    } else if (content === 'restart') {
        if (userRecord) {
            await VerificationModel.findOneAndUpdate({ userId }, {
                progress: { youtube: false, instagram: false },
                data: { youtubeScreenshot: null, instagramScreenshot: null, ocrYT: null, ocrIG: null },
                submittedForReview: false
            });
            await message.reply('🔄 **Verification Restarted.**\nPlease upload your **YouTube** screenshot to begin again.');
            return;
        }
    } else if (content === 'reset') {
        if (userRecord) {
            await VerificationModel.findOneAndDelete({ userId });
            userRecord = null; // Reset local variable to trigger welcome flow
            await message.reply('✅ **User Reset Complete.** Starting fresh...');
        }
    }

    // Initial Start (or after Reset/Start command)
    if (!userRecord || content === 'start') { // Show welcome embed if no record or if 'start' command is used
        const roleName = await getTargetRoleName(client);

        const embed = new EmbedBuilder()
            .setTitle('Early Supporter Verification')
            .setDescription(`Welcome! Follow the steps to get **${roleName}**.\nMake sure each screenshot contains a **visible timestamp**.\nYou must subscribe & follow the official accounts.`)
            .addFields(
                { name: '1. Subscribe YouTube', value: 'Click the button below' },
                { name: '2. Follow Instagram', value: 'Click the button below' }
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

        await message.channel.send({ embeds: [embed], components: [row, row2] });

        // Create record if it doesn't exist (it won't if we are here)
        if (!await VerificationModel.findOne({ userId })) {
            await VerificationModel.create({ userId });
        }
        return;
    }

    // Handle Screenshots
    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (!attachment?.contentType?.startsWith('image/')) {
            await message.reply('Please upload an image.');
            return;
        }

        const imageResponse = await axios.get(attachment.url, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data, 'binary');

        const loadingMsg = await message.reply('<a:loading:1444273220823027792> Processing image with OCR...');

        try {
            const ocrResult = await performOCR(imageBuffer);

            // Delete loading message
            try { await loadingMsg.delete(); } catch (e) { /* ignore */ }

            // Determine which step we are on
            if (!userRecord.progress.youtube) {
                // Validate YouTube
                const validation = validateYouTubeScreenshot(ocrResult);

                if (validation.valid) {
                    userRecord.progress.youtube = true;
                    userRecord.data.youtubeScreenshot = attachment.url;
                    userRecord.data.ocrYT = { ...ocrResult, ...validation };
                    await userRecord.save();

                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel('Follow Instagram')
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://www.instagram.com/rashika.agarwal.79/')
                        );

                    await message.reply({
                        content: '<:tcet_tick:1437995479567962184> YouTube verified!\nNow send your Instagram screenshot.',
                        components: [row]
                    });
                } else {
                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('request_manual_review_yt')
                                .setLabel('Request Manual Review')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('📝')
                        );

                    // Save the screenshot URL temporarily so we can use it if they request manual review
                    userRecord.data.youtubeScreenshot = attachment.url;
                    await userRecord.save();

                    await message.reply({
                        content: `<:tcet_cross:1437995480754946178> **Screenshot failed OCR check.**\nReason: ${validation.error}\nMake sure timestamp is visible & account is clearly shown.`,
                        components: [row]
                    });
                }
            } else if (!userRecord.progress.instagram) {
                // Validate Instagram
                const validation = validateInstagramScreenshot(ocrResult);

                if (validation.valid) {
                    userRecord.progress.instagram = true;
                    userRecord.data.instagramScreenshot = attachment.url;
                    userRecord.data.ocrIG = { ...ocrResult, ...validation };
                    await userRecord.save();

                    await message.reply('<:tcet_tick:1437995479567962184> Instagram verified!');

                    // Both verified, automatically give role
                    try {
                        const reviewChannel = await client.channels.fetch(CONFIG.CHANNELS.MANUAL_REVIEW) as TextChannel;
                        if (reviewChannel) {
                            const guild = reviewChannel.guild;
                            const roleId = CONFIG.ROLES.EARLY_SUPPORTER;

                            // Check limit
                            const currentCount = await getRoleMemberCount(guild, roleId);
                            if (currentCount >= CONFIG.MAX_EARLY_SUPPORTERS) {
                                await message.reply(`❌ **Verification Failed**\nThe maximum limit of **${CONFIG.MAX_EARLY_SUPPORTERS}** Early Supporters has been reached.`);
                                return;
                            }

                            const member = await guild.members.fetch(userId);
                            await member.roles.add(roleId);

                            userRecord.roleGiven = true;
                            userRecord.submittedForReview = false;
                            await userRecord.save();

                            // Delete ModMail thread if exists
                            await deleteModMailThread(client, userId);

                            const roleName = await getTargetRoleName(client);

                            await message.reply({
                                embeds: [new EmbedBuilder()
                                    .setTitle('Verification Successful!')
                                    .setDescription(`You have been verified and given the **${roleName}** role.`)
                                    .setColor('#00ff00')
                                ]
                            });

                            // Log success
                            await sendVerificationLog(client, message.author, currentCount + 1);
                        } else {
                            // Fallback if channel/guild not found (shouldn't happen if config is right)
                            console.error('Could not find guild to assign role.');
                            await message.reply('Verification complete, but could not assign role automatically. Please contact staff.');
                        }
                    } catch (error) {
                        console.error('Error auto-assigning role:', error);
                        await message.reply('Verification complete, but an error occurred assigning the role. Staff have been notified.');
                        // Maybe send to manual review as backup?
                        await sendToManualReview(client, userRecord, message.author);
                    }
                } else {
                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('request_manual_review_ig')
                                .setLabel('Request Manual Review')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('📝')
                        );

                    // Save the screenshot URL temporarily
                    userRecord.data.instagramScreenshot = attachment.url;
                    await userRecord.save();

                    await message.reply({
                        content: `<:tcet_cross:1437995480754946178> **Screenshot failed OCR check.**\nReason: ${validation.error}\nMake sure timestamp is visible & account is clearly shown.`,
                        components: [row]
                    });
                }
            } else {
                await message.reply('You have already submitted both screenshots. Please wait for manual review.');
            }
        } catch (error) {
            console.error('OCR Processing Error:', error);
            try { await loadingMsg.delete(); } catch (e) { /* ignore */ }
            await message.reply('<:tcet_cross:1437995480754946178> An error occurred while processing the image. Please try again.');
        }
    } else {
        // Handle text messages (ModMail)
        if (content !== 'start' && content !== 'restart' && content !== 'reset') {
            await forwardToModMail(client, message, userId);
        }
    }
};

const forwardToModMail = async (client: Client, message: Message, userId: string) => {
    try {
        const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
        if (!logsChannel) return;

        // Find or create thread
        // We look for active threads with the name "ModMail - <userId>"
        const activeThreads = await logsChannel.threads.fetchActive();
        let thread = activeThreads.threads.find(t => t.name.endsWith(userId));

        if (!thread) {
            // Check archived threads? Or just create new
            // For simplicity, create new if not found active
            thread = await logsChannel.threads.create({
                name: `ModMail - ${message.author.username} - ${userId}`,
                autoArchiveDuration: 1440, // 24h
                reason: 'New ModMail thread'
            });
        }

        // Send via Webhook to impersonate user
        // Check for existing webhooks
        const webhooks = await logsChannel.fetchWebhooks();
        let webhook = webhooks.find(w => w.name === 'ModMail Bot');
        if (!webhook) {
            webhook = await logsChannel.createWebhook({
                name: 'ModMail Bot',
                avatar: client.user?.displayAvatarURL()
            });
        }

        await webhook.send({
            threadId: thread.id,
            content: message.content || '**[Attachment Sent]**',
            username: message.author.username,
            avatarURL: message.author.displayAvatarURL(),
            files: message.attachments.map(a => a.url)
        });

        await message.react('📨'); // Acknowledge receipt

    } catch (error) {
        console.error('Error forwarding to ModMail:', error);
        await message.reply('❌ Error sending message to staff.');
    }
};

export const sendToManualReview = async (client: Client, userRecord: any, user: any) => {
    const reviewChannel = await client.channels.fetch(CONFIG.CHANNELS.MANUAL_REVIEW) as TextChannel;
    if (!reviewChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Pending Verification Review')
        .addFields(
            { name: 'User', value: `<@${user.id}>`, inline: true },
            { name: 'User ID', value: user.id, inline: true },
            { name: 'Submitted At', value: new Date().toLocaleString(), inline: false },
            { name: 'YouTube OCR', value: userRecord.data.ocrYT?.valid ? 'Passed' : 'Manual Request', inline: true },
            { name: 'Instagram OCR', value: userRecord.data.ocrIG?.valid ? 'Passed' : 'Manual Request', inline: true }
        )
        .setColor('#ffff00');

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`admin_approve_${user.id}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`admin_reject_${user.id}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
            new ButtonBuilder()
                .setCustomId(`admin_start_chat_${user.id}`)
                .setLabel('Start Chat')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💬')
        );

    await reviewChannel.send({
        embeds: [embed],
        files: [userRecord.data.youtubeScreenshot, userRecord.data.instagramScreenshot].filter(Boolean),
        components: [row]
    });

    userRecord.submittedForReview = true;
    await userRecord.save();
};
