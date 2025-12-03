
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, VoiceChannel } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { CustomEmojis } from '../../utils/emoji';

export const category = 'voice';

export const data = new SlashCommandBuilder()
    .setName('to')
    .setDescription('Move to a user\'s voice channel')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to move to')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', true);
    const member = await interaction.guild?.members.fetch(interaction.user.id);

    if (!member?.voice.channel) {
        await interaction.reply({ embeds: [createErrorEmbed('You must be in a voice channel to use this command.')], flags: MessageFlags.Ephemeral });
        return;
    }

    const targetMember = await interaction.guild?.members.fetch(targetUser.id);
    if (!targetMember?.voice.channel) {
        await interaction.reply({ embeds: [createErrorEmbed('Target user is not in a voice channel.')], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        await member.voice.setChannel(targetMember.voice.channelId);
        await interaction.reply({ content: CustomEmojis.TICK || '✅' });
    } catch (error) {
        await interaction.reply({ embeds: [createErrorEmbed('Failed to move. Check permissions.')], flags: MessageFlags.Ephemeral });
    }
}
