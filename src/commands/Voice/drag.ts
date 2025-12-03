import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, VoiceChannel, ChannelType, GuildMember, Message } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { CustomEmojis } from '../../utils/emoji';
import { resolveChannel } from '../../utils/resolver';

export const category = 'voice';

export const data = new SlashCommandBuilder()
    .setName('drag')
    .setDescription('Drag a user to a voice channel')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to drag')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to drag them to (defaults to your current channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers);

export const prefixCommand = {
    aliases: ['drag', 'move'],
    description: 'Drag a user to a voice channel',
    usage: '!drag <user> [channel]',
    permissions: [PermissionFlagsBits.MoveMembers]
};

export async function execute(interaction: ChatInputCommandInteraction | any) {
    const isSlash = interaction.isChatInputCommand?.();
    let targetUser;
    let targetChannelId: string | undefined;
    let member: GuildMember;

    if (isSlash) {
        targetUser = interaction.options.getUser('user', true);
        const channelOption = interaction.options.getChannel('channel');
        member = await interaction.guild?.members.fetch(interaction.user.id)!;

        if (channelOption) {
            targetChannelId = channelOption.id;
        } else if (member?.voice.channel) {
            targetChannelId = member.voice.channelId!;
        } else {
            await interaction.reply({ embeds: [createErrorEmbed('You must be in a voice channel or specify a target channel.')], flags: MessageFlags.Ephemeral });
            return;
        }
    } else {
        const message = interaction.message as Message;
        if (!message) return;

        member = message.member!;
        const content = message.content.trim();
        const args = content.split(/ +/);
        args.shift(); // Remove command name

        if (args.length === 0 && !message.reference) {
            await interaction.reply({ embeds: [createErrorEmbed('Usage: !drag <user> [channel]')] });
            return;
        }

        let userArg: string | undefined;
        let channelArg: string | undefined;

        // Check for reply first
        if (message.reference && message.reference.messageId) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMessage.member) {
                    targetUser = repliedMessage.member.user;
                }
            } catch (e) { }
        }

        // Determine User and Channel args
        if (targetUser) {
            // If user found via reply, all args are channel
            channelArg = args.join(' ');
        } else {
            // No reply, first arg must be user
            if (args.length > 0) {
                userArg = args[0];

                // Check if first arg is definitely a user (Mention or ID)
                const isId = userArg.match(/^\d{17,19}$/);
                const isMention = userArg.match(/^<@!?(\d{17,19})>$/);

                if (isId || isMention) {
                    // It's a user
                    try {
                        const id = isId ? userArg : isMention![1];
                        const fetchedMember = await message.guild!.members.fetch(id);
                        targetUser = fetchedMember.user;
                        args.shift(); // Consume user arg
                        channelArg = args.join(' ');
                    } catch (e) { }
                } else {
                    // It's text. Could be user (fuzzy) or channel (if we missed reply?)
                    // But we already checked reply. So it must be user (fuzzy).
                    try {
                        // Try to fetch as user first
                        const fetchedMember = await message.guild!.members.fetch({ query: userArg, limit: 1 });
                        if (fetchedMember.size > 0) {
                            targetUser = fetchedMember.first()!.user;
                            args.shift(); // Consume user arg
                            channelArg = args.join(' ');
                        }
                    } catch (e) { }
                }
            }
        }

        if (!targetUser) {
            await interaction.reply({ embeds: [createErrorEmbed('User not found. Please mention a user, provide their ID, or reply to their message.')] });
            return;
        }

        // Resolve Channel
        if (channelArg) {
            const resolved = await resolveChannel(channelArg, message.guild!);
            if (resolved) targetChannelId = resolved.id;
        } else {
            if (member.voice.channel) {
                targetChannelId = member.voice.channelId!;
            } else {
                await interaction.reply({ embeds: [createErrorEmbed('You must be in a voice channel or specify a target channel.')] });
                return;
            }
        }

        if (!targetChannelId) {
            await interaction.reply({ embeds: [createErrorEmbed('Voice channel not found.')] });
            return;
        }
    }

    const targetMember = await interaction.guild?.members.fetch(targetUser.id);
    if (!targetMember?.voice.channel) {
        const msg = 'Target user is not in a voice channel.';
        if (isSlash) {
            await interaction.reply({ embeds: [createErrorEmbed(msg)], flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ embeds: [createErrorEmbed(msg)] });
        }
        return;
    }

    try {
        await targetMember.voice.setChannel(targetChannelId);
        if (isSlash) {
            await interaction.reply({ content: CustomEmojis.TICK || '✅', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: CustomEmojis.TICK || '✅' });
        }
    } catch (error) {
        const msg = 'Failed to move user. Check permissions.';
        if (isSlash) {
            await interaction.reply({ embeds: [createErrorEmbed(msg)], flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ embeds: [createErrorEmbed(msg)] });
        }
    }
}
