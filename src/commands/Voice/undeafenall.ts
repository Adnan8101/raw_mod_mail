
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, VoiceChannel } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const category = 'voice';

export const data = new SlashCommandBuilder()
    .setName('undeafenall')
    .setDescription('Undeafen everyone in your voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
    const member = await interaction.guild?.members.fetch(interaction.user.id);

    if (!member?.voice.channel) {
        await interaction.reply({ embeds: [createErrorEmbed('You must be in a voice channel to use this command.')], flags: MessageFlags.Ephemeral });
        return;
    }

    const channel = member.voice.channel as VoiceChannel;
    const members = channel.members;
    let count = 0;

    await interaction.deferReply();

    for (const [_, m] of members) {
        try {
            if (m.voice.serverDeaf) {
                await m.voice.setDeaf(false);
                count++;
            }
        } catch (e) {
            console.error(`Failed to undeafen ${m.user.tag}:`, e);
        }
    }

    await interaction.editReply({ embeds: [createSuccessEmbed(`Undeafened **${count}** members in ${channel}.`)] });
}
