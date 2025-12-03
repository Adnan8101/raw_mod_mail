import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, TextChannel } from 'discord.js';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const category = 'giveaways';

export const data = new SlashCommandBuilder()
    .setName('gcancel')
    .setDescription('Cancel a giveaway')
    .addStringOption(option =>
        option.setName('message_id')
            .setDescription('Message ID of the giveaway')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
    const messageId = interaction.options.getString('message_id', true);
    const db = DatabaseManager.getInstance();
    const giveaway = await db.getGiveaway(messageId);

    if (!giveaway) {
        await interaction.reply({ embeds: [createErrorEmbed('Giveaway not found.')], flags: MessageFlags.Ephemeral });
        return;
    }

    if (giveaway.ended) {
        await interaction.reply({ embeds: [createErrorEmbed('Giveaway already ended.')], flags: MessageFlags.Ephemeral });
        return;
    }

    await db.endGiveaway(messageId);

    // Try to delete message
    try {
        const channel = await interaction.guild?.channels.fetch(giveaway.channelId) as TextChannel;
        if (channel) {
            const msg = await channel.messages.fetch(messageId);
            if (msg) await msg.delete();
        }
    } catch (e) {
        // Ignore if message already deleted
    }

    await interaction.reply({ embeds: [createSuccessEmbed('Giveaway cancelled.')], flags: MessageFlags.Ephemeral });
}
