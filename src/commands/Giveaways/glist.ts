
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const category = 'giveaways';

export const data = new SlashCommandBuilder()
    .setName('glist')
    .setDescription('List active giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
    const db = DatabaseManager.getInstance();
    const giveaways = await db.getActiveGiveaways();

    // Filter for this guild
    const guildGiveaways = giveaways.filter(g => g.guildId === interaction.guildId);

    if (guildGiveaways.length === 0) {
        await interaction.reply({ embeds: [createErrorEmbed('No active giveaways in this server.')], flags: MessageFlags.Ephemeral });
        return;
    }

    const description = guildGiveaways.map(g => {
        return `**${g.prize}**\nChannel: <#${g.channelId}>\nEnds: <t:${Math.floor(new Date(g.endTime).getTime() / 1000)}:R>\nMessage ID: ${g.messageId}`;
    }).join('\n\n');

    await interaction.reply({ embeds: [createInfoEmbed('Active Giveaways', description)], flags: MessageFlags.Ephemeral });
}
