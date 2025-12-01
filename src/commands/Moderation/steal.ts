import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Message, EmbedBuilder, parseEmoji, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } from 'discord.js';
import axios from 'axios';
import sharp from 'sharp';

export const stealCommand = new SlashCommandBuilder()
    .setName('steal')
    .setDescription('Steal an emoji or media')
    .addStringOption(option =>
        option.setName('content')
            .setDescription('The emoji or URL to steal')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers);

export const handleStealCommand = async (interaction: ChatInputCommandInteraction) => {
    if (interaction.commandName === 'steal') {
        await interaction.deferReply();
        const content = interaction.options.getString('content');
        if (!content) {
            await interaction.editReply('❌ Please provide an emoji or URL to steal.');
            return;
        }

        await processSteal(interaction, content);
    }
};

export const handleStealMessage = async (message: Message, args: string[]) => {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {

        return;
    }

    let targetContent = args[0];
    let targetAttachment = message.attachments.first();

    if (message.reference && message.reference.messageId) {
        try {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMessage) {

                if (repliedMessage.attachments.size > 0) {
                    targetAttachment = repliedMessage.attachments.first();
                }
                if (!targetAttachment && repliedMessage.content) {
                    targetContent = repliedMessage.content;
                }

                if (repliedMessage.stickers.size > 0) {
                    const sticker = repliedMessage.stickers.first();
                    if (sticker) {
                        await processSteal(message, sticker.url, true);
                        return;
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching replied message:', e);
        }
    }

    if (targetAttachment) {
        await processSteal(message, targetAttachment.url);
    } else if (targetContent) {
        await processSteal(message, targetContent);
    } else {
        await message.reply('❌ Could not find anything to steal.');
    }
};

async function resizeImage(url: string, isSticker: boolean): Promise<Buffer | null> {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Discord Limits:
        // Emoji: 256KB
        // Sticker: 500KB
        const maxSize = isSticker ? 500 * 1024 : 256 * 1024;

        // Check metadata to detect animation
        const metadata = await sharp(buffer).metadata();
        const isAnimated = !!(metadata.pages && metadata.pages > 1);

        if (buffer.length <= maxSize) {
            return buffer;
        }

        let resized = buffer;
        let quality = 90;
        let width = isSticker ? 320 : 128; // Standard sizes

        // Iteratively reduce quality/size if needed
        while (resized.length > maxSize && quality > 10) {
            const pipeline = sharp(buffer, { animated: isAnimated })
                .resize({ width: width, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

            if (isSticker) {

                if (isAnimated) {
                    resized = await pipeline
                        .png({ quality: quality, animated: true } as any)
                        .toBuffer();
                } else {
                    resized = await pipeline
                        .png({ quality: quality })
                        .toBuffer();
                }
            } else {
                // Emojis: PNG or GIF
                if (isAnimated) {
                    // GIF output doesn't support 'quality' in the same way as JPEG/PNG in some sharp versions, 
                    // but 'colours' or 'effort'. However, let's try standard options or cast.
                    resized = await pipeline
                        .gif({} as any) // GIF compression is limited in sharp, usually just reducing colors/dimensions helps size.
                        .toBuffer();
                } else {
                    resized = await pipeline
                        .png({ quality: quality })
                        .toBuffer();
                }
            }

            quality -= 10;
        }

        return resized;
    } catch (error) {
        console.error('Error resizing image:', error);
        return null;
    }
}

async function processSteal(context: ChatInputCommandInteraction | Message, content: string, isStickerUrl = false) {
    const guild = context.guild;
    if (!guild) return;

    let statusMessage: Message | null = null;

    // Helper to update status
    const updateStatus = async (text: string, currentMsg: Message | null): Promise<Message | null> => {
        const embed = new EmbedBuilder()
            .setDescription(text)
            .setColor('#ffff00'); // Yellow for processing

        if (context instanceof ChatInputCommandInteraction) {
            if (context.deferred || context.replied) {
                await context.editReply({ content: '', embeds: [embed], components: [] });
            } else {
                await context.reply({ embeds: [embed] });
            }
            return null;
        } else {
            if (currentMsg) {
                await currentMsg.edit({ content: '', embeds: [embed], components: [] });
                return currentMsg;
            } else {
                return await context.reply({ embeds: [embed] });
            }
        }
    };

    try {
        statusMessage = await updateStatus('⏳ **Processing...**\nAnalyzing content...', statusMessage);

        // 1. Try to parse as Custom Emoji
        const customEmoji = parseEmoji(content);
        if (customEmoji && customEmoji.id) {
            const url = `https://cdn.discordapp.com/emojis/${customEmoji.id}.${customEmoji.animated ? 'gif' : 'png'}`;
            try {
                statusMessage = await updateStatus('⬇️ **Downloading emoji...**', statusMessage);
                const buffer = await resizeImage(url, false);

                if (!buffer) throw new Error('Failed to process image');

                statusMessage = await updateStatus('⬆️ **Uploading emoji to server...**', statusMessage);
                const emoji = await guild.emojis.create({ attachment: buffer, name: customEmoji.name || 'stolen_emoji' });

                const embed = new EmbedBuilder()
                    .setDescription(`✅ **Steal Successful!**\nAdded ${emoji} to the server.`)
                    .setColor('#00ff00');

                if (context instanceof ChatInputCommandInteraction) {
                    await context.editReply({ embeds: [embed] });
                } else {
                    if (statusMessage) await statusMessage.edit({ embeds: [embed] });
                    else statusMessage = await context.reply({ embeds: [embed] });
                }
            } catch (error: any) {
                console.error('Error creating emoji:', error);
                const msg = `❌ Failed to add emoji.\nReason: ${error.message || 'Unknown error'}`;
                if (context instanceof ChatInputCommandInteraction) await context.editReply({ content: msg, embeds: [] });
                else {
                    if (statusMessage) await statusMessage.edit({ content: msg, embeds: [] });
                    else statusMessage = await context.reply(msg);
                }
            }
            return;
        }

        // 2. If not a custom emoji string, treat as URL (Media/Sticker)
        if (!content.startsWith('http')) {
            const msg = '❌ Invalid content. Provide an emoji or a valid URL.';
            if (context instanceof ChatInputCommandInteraction) await context.editReply(msg);
            else statusMessage = await context.reply(msg);
            return;
        }

        // It's a URL
        const embed = new EmbedBuilder()
            .setTitle('Steal Media')
            .setDescription('What would you like to do with this media?')
            .setImage(content)
            .setColor('#0099ff');

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('steal_as_emoji')
                    .setLabel('Steal as Emoji')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('steal_as_sticker')
                    .setLabel('Steal as Sticker')
                    .setStyle(ButtonStyle.Secondary)
            );

        let response;
        if (context instanceof ChatInputCommandInteraction) {
            response = await context.editReply({ embeds: [embed], components: [row] });
        } else {
            if (statusMessage) {
                response = await statusMessage.edit({ embeds: [embed], components: [row] });
            } else {
                response = await context.reply({ embeds: [embed], components: [row] });
                statusMessage = response;
            }
        }

        // Collector
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async (i: any) => {
            if (i.user.id !== (context instanceof ChatInputCommandInteraction ? context.user.id : context.author.id)) {
                await i.reply({ content: 'Not your command.', ephemeral: true });
                return;
            }

            await i.deferUpdate(); // Acknowledge button press immediately

            try {
                if (i.customId === 'steal_as_emoji') {
                    await i.editReply({ content: '⏳ **Processing Emoji...**\nDownloading and resizing...', embeds: [], components: [] });

                    const buffer = await resizeImage(content, false);
                    if (!buffer) throw new Error('Failed to process image');

                    await i.editReply({ content: '⬆️ **Uploading Emoji...**' });
                    const emoji = await guild.emojis.create({ attachment: buffer, name: 'stolen_media' });

                    await i.editReply({ content: `✅ **Added as emoji:** ${emoji}`, embeds: [], components: [] });
                } else if (i.customId === 'steal_as_sticker') {
                    await i.editReply({ content: '⏳ **Processing Sticker...**\nDownloading and resizing...', embeds: [], components: [] });

                    const buffer = await resizeImage(content, true);
                    if (!buffer) throw new Error('Failed to process image');

                    await i.editReply({ content: '⬆️ **Uploading Sticker...**' });
                    await guild.stickers.create({ file: buffer, name: 'stolen_sticker', tags: 'stolen' });

                    await i.editReply({ content: `✅ **Added as sticker.**`, embeds: [], components: [] });
                }
            } catch (error: any) {
                console.error('Steal error:', error);
                await i.editReply({ content: `❌ **Failed:** ${error.message || 'Unknown error'}\nCheck bot permissions or file limits.`, embeds: [], components: [] });
            }
        });

        collector.on('end', () => {
            // Cleanup buttons if still there
            if (context instanceof ChatInputCommandInteraction) {
                context.editReply({ components: [] }).catch(() => { });
            } else {
                if (statusMessage) (statusMessage as Message).edit({ components: [] }).catch(() => { });
            }
        });

    } catch (error: any) {
        console.error('Process Steal Error:', error);
        const msg = `❌ **Error:** ${error.message}`;
        if (context instanceof ChatInputCommandInteraction) {
            // If already replied, edit. If not, reply.
            if (context.replied || context.deferred) await context.editReply(msg);
            else await context.reply(msg);
        } else {
            if (statusMessage) await (statusMessage as Message).edit(msg);
            else await context.reply(msg);
        }
    }
}
