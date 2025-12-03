
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { GiveawayManager } from '../../services/GiveawayManager';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const category = 'giveaways';

export const data = new SlashCommandBuilder()
    .setName('greroll')
    .setDescription('Reroll a giveaway winner')
    .addStringOption(option =>
        option.setName('message_id')
            .setDescription('Message ID of the giveaway')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
    const messageId = interaction.options.getString('message_id', true);
    const manager = GiveawayManager.getInstance(interaction.client);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const winners = await manager.reroll(messageId);

    if (winners.length > 0) {
        await interaction.editReply({ embeds: [createSuccessEmbed(`Giveaway rerolled. New Winner: ${winners.map(id => `<@${id}>`).join(', ')}`)] });
    } else {
        await interaction.editReply({ embeds: [createErrorEmbed('Failed to reroll giveaway (maybe no valid participants).')] });
    }
}
