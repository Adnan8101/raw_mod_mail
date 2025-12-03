
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Message, GuildMember, MessageFlags } from 'discord.js';
import { CustomEmojis } from '../../utils/emoji';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embedHelpers';

export const category = 'voice';

export const data = new SlashCommandBuilder()
    .setName('dc')
    .setDescription('Disconnect a user from voice channel')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to disconnect')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers);

export const prefixCommand = {
    aliases: ['dc', 'disconnect'],
    description: 'Disconnect a user from voice channel',
    usage: '!dc <user>',
    permissions: [PermissionFlagsBits.MoveMembers]
};

export async function execute(interaction: ChatInputCommandInteraction | any) {
    const isSlash = interaction.isChatInputCommand?.();
    let targetMember: GuildMember | null = null;

    if (isSlash) {
        const user = interaction.options.getUser('user', true);
        targetMember = await interaction.guild?.members.fetch(user.id).catch(() => null) || null;
    } else {
        const message = interaction.message as Message;
        if (!message) return;

        const content = message.content.trim();
        const args = content.split(/ +/);
        args.shift(); // Remove command

        // Check for reply first
        if (message.reference && message.reference.messageId) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMessage.member) {
                    targetMember = repliedMessage.member;
                }
            } catch (e) { }
        }

        // Check for mentions or ID/Fuzzy if no reply or reply didn't yield member
        if (!targetMember && args.length > 0) {
            const arg = args[0];

            // Try mention regex
            const mentionMatch = arg.match(/^<@!?(\d{17,19})>$/);
            if (mentionMatch) {
                targetMember = await message.guild?.members.fetch(mentionMatch[1]).catch(() => null) || null;
            }
            // Try ID
            else if (arg.match(/^\d{17,19}$/)) {
                targetMember = await message.guild?.members.fetch(arg).catch(() => null) || null;
            }
            // Try Fuzzy
            else {
                try {
                    const fetchedMember = await message.guild!.members.fetch({ query: arg, limit: 1 });
                    if (fetchedMember.size > 0) {
                        targetMember = fetchedMember.first() || null;
                    }
                } catch (e) { }
            }
        }
    }

    if (!targetMember) {
        if (isSlash) {
            await interaction.reply({ embeds: [createErrorEmbed('User not found.')], flags: MessageFlags.Ephemeral });
        }
        return;
    }

    if (targetMember.voice.channel) {
        try {
            await targetMember.voice.disconnect();

            if (isSlash) {
                await interaction.reply({ content: `${CustomEmojis.TICK} Disconnected ${targetMember.user.tag}`, flags: MessageFlags.Ephemeral });
            } else {
                const message = interaction.message as Message;
                await message.react(CustomEmojis.TICK || '✅');
            }
        } catch (error) {
            if (isSlash) {
                await interaction.reply({ embeds: [createErrorEmbed('Failed to disconnect user. Check permissions.')], flags: MessageFlags.Ephemeral });
            }
        }
    } else {
        // Not in VC
        if (isSlash) {
            await interaction.reply({ content: 'User is not in a voice channel.', flags: MessageFlags.Ephemeral });
        }
    }
}
