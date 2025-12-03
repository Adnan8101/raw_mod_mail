import { Client, Message, EmbedBuilder, TextChannel, AttachmentBuilder, Partials, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadChannel, ComponentType, MessageFlags } from 'discord.js';
import { prisma } from '../database/connect';
import { performOCR } from '../services/ocr';
import { validateYouTubeScreenshot, validateInstagramScreenshot, detectPlatform } from '../services/verification';
import { CONFIG } from '../config';
import axios from 'axios';
import { getTargetRoleName, deleteModMailThread, getRoleMemberCount, sendVerificationLog } from '../utils/discord';

import { getGameManager } from '../commands/Games/Guess the Number/gameInstance';
import { getEmojiEquationManager } from '../commands/Games/Emoji Equation/gameInstance';
import { getMemoryGameManager } from '../commands/Games/Memory Game/gameInstance';
import { getMathGameManager } from '../commands/Games/Math Game/mathGameInstance';
import { getHiddenNumberGameManager } from '../commands/Games/Hidden Number/hiddenGameInstance';
import { handleStealMessage } from '../commands/Utility/steal';
import { getVowelsGameManager } from '../commands/Games/vowels/vowelsManager';
import { getSequenceGameManager } from '../commands/Games/sequence/sequenceManager';
import { getReverseGameManager } from '../commands/Games/reverse/reverseManager';
import { OWNER_ID, evaluateCode, createEvalEmbed } from '../commands/owner/evalHelper';
import { DatabaseManager } from '../utils/DatabaseManager';

export const onMessageCreate = async (client: Client, message: Message) => {
    if (message.author.bot) {
        return;
    }

    // Track message count
    if (message.guildId) {
        const db = DatabaseManager.getInstance();
        await db.incrementMessageCount(message.guildId, message.author.id);
    }

    if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread) {
        const thread = message.channel as ThreadChannel;
        if (thread.parentId === CONFIG.CHANNELS.LOGS) {
            const parts = thread.name.split('-');
            const targetUserId = parts[parts.length - 1].trim();
            if (targetUserId && /^\d+$/.test(targetUserId)) {
                try {
                    const user = await client.users.fetch(targetUserId);
                    if (message.content) {
                        await user.send(message.content);
                    }
                    if (message.attachments.size > 0) {
                        await user.send({
                            content: '**Admin sent an attachment:**',
                            files: message.attachments.map(a => a.url)
                        });
                    }
                    await message.react('1437995479567962184');
                } catch (error) {
                    console.error('Failed to DM user:', error);
                    await message.react('❌');
                }
            }
            return;
        }
    }
    if (message.channel.type !== ChannelType.DM) {
        const gameManager = getGameManager(client);
        const memoryGameManager = getMemoryGameManager(client);
        const mathGameManager = getMathGameManager(client);
        const hiddenNumberGameManager = getHiddenNumberGameManager(client);
        const vowelsGameManager = getVowelsGameManager(client);
        const sequenceGameManager = getSequenceGameManager(client);
        const reverseGameManager = getReverseGameManager(client);
        const emojiEquationManager = getEmojiEquationManager(client);

        // Fetch Prefix
        let prefix = '!';
        if (message.guildId) {
            const settings = await prisma.guildConfig.findUnique({ where: { guildId: message.guildId } });
            if (settings) prefix = settings.prefix;
        }

        // Handle Steal Reply
        if (message.reference && message.content.trim().toLowerCase() === 'steal') {
            await handleStealMessage(message, []);
            return;
        }

        // Handle Prefix Commands
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/\s+/);
            const commandName = args.shift()?.toLowerCase();

            if (commandName === 'steal') {
                await handleStealMessage(message, args);
                return;
            } else if (commandName === 'eval') {
                // Owner-Only Check
                if (message.author.id !== OWNER_ID) {
                    return; // Ignore non-owners
                }

                const code = message.content.slice(prefix.length + 4).trim();
                if (!code) return;

                const result = await evaluateCode(code, {
                    client: client,
                    message: message
                });

                const { embed, row } = createEvalEmbed(result);

                const reply = await message.reply({
                    embeds: [embed],
                    components: [row]
                });

                // Handle delete button
                const collector = reply.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 600000 // 10 minutes
                });

                collector.on('collect', async i => {
                    if (i.customId === 'delete_eval') {
                        if (i.user.id !== OWNER_ID) {
                            await i.reply({ content: 'Only the owner can delete this.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        await i.deferUpdate();
                        await reply.delete();
                        collector.stop();
                    }
                });
                return;
            }
        }

        // Handle gtn prefix
        if (message.content.toLowerCase().startsWith('gtn ')) {
            const args = message.content.slice(4).trim().split(/\s+/);
            const command = args.shift()?.toLowerCase();

            if (command === 'start') {
                const min = parseInt(args[0]);
                const max = parseInt(args[1]);
                if (!isNaN(min) && !isNaN(max)) {
                    if (min >= max) {
                        await message.reply('Minimum number must be less than maximum number.');
                    } else {
                        const success = await gameManager.startGame(message.channelId, min, max);
                        if (!success) {
                            await message.reply('A game is already running in this channel.');
                        }
                    }
                } else {
                    await message.reply('Usage: `gtn start <min> <max>`');
                }
            } else if (command === 'stop') {
                const success = await gameManager.stopGame(message.channelId);
                if (success) {
                    await message.reply('Game stopped.');
                } else {
                    await message.reply('No game is running in this channel.');
                }
            }
            return;
        }

        // Execute game handlers in parallel where possible or sequentially if they are fast
        // Since most return immediately if no game is active, sequential is fine but static imports make it faster
        await Promise.all([
            gameManager.handleMessage(message),
            memoryGameManager.handleMessage(message),
            mathGameManager.handleMessage(message),
            hiddenNumberGameManager.handleMessage(message),
            vowelsGameManager.handleMessage(message),
            sequenceGameManager.handleMessage(message),
            reverseGameManager.handleMessage(message),
            emojiEquationManager.handleMessage(message)
        ]);

        return;
    }
    const userId = message.author.id;
    let userRecord = await prisma.verification.findUnique({ where: { userId } });

    if (userRecord && userRecord.roleGiven) {
        try {
            const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
            if (guild) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member || !member.roles.cache.has(CONFIG.ROLES.EARLY_SUPPORTER)) {
                    await prisma.verification.update({
                        where: { userId },
                        data: {
                            youtubeProgress: false,
                            instagramProgress: false,
                            roleGiven: false,
                            submittedForReview: false,
                            youtubeScreenshot: null,
                            instagramScreenshot: null,
                            ocrYT: undefined, // Prisma handles Json? as undefined/null
                            ocrIG: undefined
                        }
                    });

                    // Refresh record
                    userRecord = await prisma.verification.findUnique({ where: { userId } });

                    await message.reply('⚠️ **Verification Status Updated**\nWe detected that you no longer have the **Early Supporter** role. Your verification progress has been reset so you can apply again.');
                }
            }
        } catch (e) {
            console.error('[DEBUG] Error syncing role:', e);
        }
    }
    const content = message.content.toLowerCase().trim();
    if (content === 'start') {
        if (!userRecord) {
            userRecord = await prisma.verification.create({ data: { userId } });
        }
    } else if (content === 'restart') {
        if (userRecord) {
            await prisma.verification.update({
                where: { userId },
                data: {
                    youtubeProgress: false,
                    instagramProgress: false,
                    youtubeScreenshot: null,
                    instagramScreenshot: null,
                    ocrYT: undefined,
                    ocrIG: undefined,
                    submittedForReview: false
                }
            });
            await message.reply('🔄 **Verification Restarted.**\nPlease upload your **YouTube** screenshot to begin again.');
            return;
        }
    } else if (content === 'reset') {
        if (userRecord) {
            await prisma.verification.delete({ where: { userId } });
            userRecord = null;
            await message.reply('<:tcet_tick:1437995479567962184> **User Reset Complete.** Starting fresh...');
        }
    }
    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (!attachment) return;
        const isImage = attachment.contentType?.startsWith('image/') ||
            attachment.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        if (!isImage) {
            await message.reply('Please upload an image.');
            return;
        }
        if (!userRecord) {
            userRecord = await prisma.verification.create({ data: { userId, status: 'IDLE' } });
        }
        if (userRecord.status === 'VERIFYING') {
            if (userRecord.youtubeProgress && userRecord.instagramProgress) {
                await message.reply({
                    embeds: [new EmbedBuilder()
                        .setDescription('⚠️ **You have already submitted both screenshots.**\nPlease wait for manual review.')
                        .setColor('#ffff00')
                    ]
                });
                return;
            }
            if (!userRecord.youtubeProgress || !userRecord.instagramProgress) {
                let loadingMsg;
                try {
                    loadingMsg = await message.reply({
                        embeds: [new EmbedBuilder()
                            .setDescription('<a:loading:1444273220823027792> **Processing image with OCR...**')
                            .setColor('#ffff00')
                        ]
                    });
                } catch (err) {
                    console.error('[MessageCreate] Failed to send loading emoji, falling back to text:', err);
                    loadingMsg = await message.reply({
                        embeds: [new EmbedBuilder()
                            .setDescription('⏳ **Processing image with OCR...**')
                            .setColor('#ffff00')
                        ]
                    });
                }
                try {
                    const imageResponse = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                    const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                    const ocrResult = await performOCR(imageBuffer);
                    try { await loadingMsg.delete(); } catch (e) { }
                    if (!userRecord.youtubeProgress) {
                        const validation = validateYouTubeScreenshot(ocrResult);
                        if (validation.valid) {
                            await prisma.verification.update({
                                where: { userId },
                                data: {
                                    youtubeProgress: true,
                                    youtubeScreenshot: attachment.url,
                                    ocrYT: { ...ocrResult, ...validation } as any
                                }
                            });
                            // Refresh record
                            userRecord = await prisma.verification.findUnique({ where: { userId } });

                            const row = new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setLabel('Follow Instagram')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL('https://www.instagram.com/rashika.agarwal.79/')
                                );
                            await message.reply({
                                embeds: [new EmbedBuilder()
                                    .setDescription('<:tcet_tick:1437995479567962184> **YouTube Verified!**\nNow please follow us on Instagram.')
                                ],
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

                            await prisma.verification.update({
                                where: { userId },
                                data: { youtubeScreenshot: attachment.url }
                            });

                            await message.reply({
                                embeds: [new EmbedBuilder()
                                    .setDescription(`<:tcet_cross:1437995480754946178> **Screenshot failed OCR check.**\nPlease re-upload the image of **YouTube** with correct **${validation.error}**\n\nIf you believe this is a mistake, you can apply for manual verification below.`)
                                ],
                                components: [row]
                            });
                        }
                    } else if (!userRecord.instagramProgress) {
                        const validation = validateInstagramScreenshot(ocrResult);
                        if (validation.valid) {
                            await prisma.verification.update({
                                where: { userId },
                                data: {
                                    instagramProgress: true,
                                    instagramScreenshot: attachment.url,
                                    ocrIG: { ...ocrResult, ...validation } as any
                                }
                            });
                            // Refresh record
                            userRecord = await prisma.verification.findUnique({ where: { userId } });

                            await message.reply({
                                embeds: [new EmbedBuilder()
                                    .setDescription('<:tcet_tick:1437995479567962184> **Instagram verified!**')
                                ]
                            });

                            // Check if YT is valid (need to cast Json to any or check properties)
                            const ocrYT = userRecord?.ocrYT as any;

                            if (ocrYT?.valid) {
                                try {
                                    const reviewChannel = await client.channels.fetch(CONFIG.CHANNELS.MANUAL_REVIEW) as TextChannel;
                                    if (reviewChannel) {
                                        const guild = reviewChannel.guild;
                                        const roleId = CONFIG.ROLES.EARLY_SUPPORTER;
                                        const currentCount = await getRoleMemberCount(guild, roleId);
                                        if (currentCount >= CONFIG.MAX_EARLY_SUPPORTERS) {
                                            await message.reply(`❌ **Verification Failed**\nThe maximum limit of **${CONFIG.MAX_EARLY_SUPPORTERS}** Early Supporters has been reached.`);
                                            return;
                                        }
                                        const member = await guild.members.fetch(userId);
                                        await member.roles.add(roleId);

                                        await prisma.verification.update({
                                            where: { userId },
                                            data: {
                                                roleGiven: true,
                                                submittedForReview: false
                                            }
                                        });
                                        // Refresh record
                                        userRecord = await prisma.verification.findUnique({ where: { userId } });

                                        await deleteModMailThread(client, userId);
                                        const roleName = await getTargetRoleName(client);
                                        await message.reply({
                                            embeds: [new EmbedBuilder()
                                                .setTitle('Verification Successful!')
                                                .setDescription(`You have been verified and given the **${roleName}** role.`)
                                            ]
                                        });
                                        await sendVerificationLog(client, message.author, currentCount + 1, [userRecord?.youtubeScreenshot, userRecord?.instagramScreenshot].filter(Boolean) as string[]);
                                    } else {
                                        console.error('Could not find guild to assign role.');
                                        await message.reply('Verification complete, but could not assign role automatically. Please contact staff.');
                                    }
                                } catch (error) {
                                    console.error('Error auto-assigning role:', error);
                                    await message.reply('Verification complete, but an error occurred assigning the role. Staff have been notified.');
                                    await sendToManualReview(client, userRecord, message.author);
                                }
                            } else {
                                await sendToManualReview(client, userRecord, message.author);
                                await message.reply({
                                    embeds: [new EmbedBuilder()
                                        .setDescription('📝 **Verification Pending**\nSince your YouTube screenshot required manual review, staff will check both and approve you shortly.')
                                        .setColor('#ffff00')
                                    ]
                                });
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

                            await prisma.verification.update({
                                where: { userId },
                                data: { instagramScreenshot: attachment.url }
                            });

                            await message.reply({
                                embeds: [new EmbedBuilder()
                                    .setDescription(`<:tcet_cross:1437995480754946178> **Screenshot failed OCR check.**\nPlease re-upload the image of **Instagram** with correct **${validation.error}**\n\nIf you believe this is a mistake, you can apply for manual verification below.`)
                                    .setColor('#ff0000')
                                ],
                                components: [row]
                            });
                        }
                    } else {
                        await message.reply({
                            embeds: [new EmbedBuilder()
                                .setDescription('⚠️ **You have already submitted both screenshots.**\nPlease wait for manual review.')
                                .setColor('#ffff00')
                            ]
                        });
                    }
                } catch (error) {
                    console.error('Processing Error:', error);
                    try { await loadingMsg.delete(); } catch (e) { }
                    await message.reply({
                        embeds: [new EmbedBuilder()
                            .setDescription('<:tcet_cross:1437995480754946178> **An error occurred while processing the image.**\nPlease try again.')
                            .setColor('#ff0000')
                        ]
                    });
                }
            }
        }
        else {
            const forwarded = await forwardToModMail(client, message, userId);
            if (forwarded) {
                return;
            }
            const embed = new EmbedBuilder()
                .setTitle('Welcome to Raw ModMail')
                .setDescription('We are here to help you. Please choose an option below to proceed.\n\n**Apply for Early Supporter**: Get verified and earn the role.\n**Open Ticket**: Contact the support team for assistance.')
                .setColor('#0099ff');
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('start_verification_flow')
                        .setLabel('Apply for Early Supporter')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🚀'),
                    new ButtonBuilder()
                        .setCustomId('open_ticket')
                        .setLabel('Open Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📩')
                );
            await message.channel.send({ embeds: [embed], components: [row] });
        }
        return;
    }
    if (!userRecord || content === 'start') {
        const embed = new EmbedBuilder()
            .setTitle('Welcome to Raw ModMail')
            .setDescription('We are here to help you. Please choose an option below to proceed.\n\n**Apply for Early Supporter**: Get verified and earn the role.\n**Open Ticket**: Contact the support team for assistance.')
            .setThumbnail(client.user?.displayAvatarURL() || '')
            .setColor('#0099ff');
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('start_verification_flow')
                    .setLabel('Apply for Early Supporter')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🚀'),
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Open Ticket')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📩')
            );
        await message.channel.send({ embeds: [embed], components: [row] });
        if (!await prisma.verification.findUnique({ where: { userId } })) {
            await prisma.verification.create({ data: { userId } });
        }
        return;
    }
    if (content !== 'start' && content !== 'restart' && content !== 'reset') {
        const forwarded = await forwardToModMail(client, message, userId);
        if (!forwarded) {
            const embed = new EmbedBuilder()
                .setTitle('Welcome to Raw ModMail')
                .setDescription('We are here to help you. Please choose an option below to proceed.\n\n**Apply for Early Supporter**: Get verified and earn the role.\n**Open Ticket**: Contact the support team for assistance.')
                .setThumbnail(client.user?.displayAvatarURL() || '')
                .setColor('#0099ff');
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('start_verification_flow')
                        .setLabel('Apply for Early Supporter')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🚀'),
                    new ButtonBuilder()
                        .setCustomId('open_ticket')
                        .setLabel('Open Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📩')
                );
            await message.channel.send({ embeds: [embed], components: [row] });
        }
    }
};
const forwardToModMail = async (client: Client, message: Message, userId: string): Promise<boolean> => {
    try {
        const logsChannel = await client.channels.fetch(CONFIG.CHANNELS.LOGS) as TextChannel;
        if (!logsChannel) return false;
        const activeThreads = await logsChannel.threads.fetchActive();
        let thread = activeThreads.threads.find(t => t.name.endsWith(userId));
        if (!thread) {
            return false;
        }
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
        await message.react('📨');
        return true;
    } catch (error) {
        console.error('Error forwarding to ModMail:', error);
        await message.reply('❌ Error sending message to staff.');
        return true;
    }
};
export const sendToManualReview = async (client: Client, userRecord: any, user: any) => {
    const reviewChannel = await client.channels.fetch(CONFIG.CHANNELS.MANUAL_REVIEW) as TextChannel;
    if (!reviewChannel) return;

    const ocrYT = userRecord.ocrYT as any;
    const ocrIG = userRecord.ocrIG as any;

    const embed = new EmbedBuilder()
        .setTitle('Pending Verification Review')
        .addFields(
            { name: 'User', value: `<@${user.id}>`, inline: true },
            { name: 'User ID', value: user.id, inline: true },
            { name: 'Submitted At', value: new Date().toLocaleString(), inline: false },
            { name: 'YouTube OCR', value: ocrYT?.valid ? 'Passed' : 'Manual Request', inline: true },
            { name: 'Instagram OCR', value: ocrIG?.valid ? 'Passed' : 'Manual Request', inline: true }
        )
        .setColor('#ffff00');
    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`admin_approve_${user.id}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success)
                .setEmoji('1437995479567962184'),
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
        files: [userRecord.youtubeScreenshot, userRecord.instagramScreenshot].filter(Boolean),
        components: [row]
    });

    await prisma.verification.update({
        where: { userId: user.id },
        data: { submittedForReview: true }
    });
};
