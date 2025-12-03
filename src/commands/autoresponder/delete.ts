/**
 * Delete Auto-Responder Subcommand
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { AutoResponderService } from '../../services/AutoResponderService';
import { EmbedColors } from '../../types';

export async function handleDelete(
  interaction: ChatInputCommandInteraction,
  services: { autoResponderService: AutoResponderService }
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const autoResponders = await services.autoResponderService.getAllAutoResponders(
    interaction.guildId!
  );

  if (autoResponders.length === 0) {
    await interaction.editReply({
      content: '❌ No auto-responders configured.',
    });
    return;
  }

  // Create embed with dropdown
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Delete Auto-Responder')
    .setDescription('Select an auto-responder to delete from the dropdown below.')
    .setColor(EmbedColors.WARNING);

  // Create dropdown menu with all auto-responders
  const options = autoResponders.slice(0, 25).map(ar => ({
    label: ar.trigger.length > 100 ? ar.trigger.substring(0, 97) + '...' : ar.trigger,
    description: ar.response.length > 100 ? ar.response.substring(0, 97) + '...' : ar.response,
    value: ar.id,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ar_delete_select_${Date.now()}`)
    .setPlaceholder('Select an auto-responder to delete')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });

  // Wait for selection
  try {
    const selectInteraction = await interaction.channel?.awaitMessageComponent({
      filter: i => i.customId.startsWith('ar_delete_select_') && i.user.id === interaction.user.id,
      time: 60000, // 1 minute
    }) as StringSelectMenuInteraction;

    const selectedId = selectInteraction.values[0];
    const selected = autoResponders.find(ar => ar.id === selectedId);

    if (!selected) {
      await selectInteraction.update({
        content: '❌ Selected auto-responder not found.',
        embeds: [],
        components: [],
      });
      return;
    }

    // Delete auto-responder
    await services.autoResponderService.deleteAutoResponder(selectedId);

    const successEmbed = new EmbedBuilder()
      .setTitle('<:tcet_tick:1437995479567962184> Auto-Responder Deleted')
      .setDescription('Successfully deleted auto-responder.')
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Trigger', value: `\`${selected.trigger}\``, inline: true },
        { name: 'Response', value: selected.response.length > 1024 ? selected.response.substring(0, 1021) + '...' : selected.response, inline: false }
      )
      .setFooter({ text: `Deleted by ${interaction.user.tag}` })
      .setTimestamp();

    await selectInteraction.update({
      embeds: [successEmbed],
      components: [],
    });
  } catch (error) {
    console.error('Error in delete auto-responder:', error);
    await interaction.editReply({
      content: '❌ Delete operation timed out or was cancelled.',
      embeds: [],
      components: [],
    });
  }
}
