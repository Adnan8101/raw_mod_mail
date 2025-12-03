/**
 * Toggle Auto-Responder Subcommand
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

export async function handleToggle(
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
    .setTitle('🔄 Toggle Auto-Responder')
    .setDescription('Select an auto-responder to enable/disable from the dropdown below.')
    .setColor(EmbedColors.INFO);

  // Create dropdown menu with all auto-responders
  const options = autoResponders.slice(0, 25).map(ar => {
    const status = ar.enabled ? '<:tcet_tick:1437995479567962184>' : '❌';
    return {
      label: `${status} ${ar.trigger.length > 95 ? ar.trigger.substring(0, 92) + '...' : ar.trigger}`,
      description: ar.response.length > 100 ? ar.response.substring(0, 97) + '...' : ar.response,
      value: ar.id,
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ar_toggle_select_${Date.now()}`)
    .setPlaceholder('Select an auto-responder to toggle')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });

  // Wait for selection
  try {
    const selectInteraction = await interaction.channel?.awaitMessageComponent({
      filter: i => i.customId.startsWith('ar_toggle_select_') && i.user.id === interaction.user.id,
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

    // Toggle auto-responder
    const newStatus = !selected.enabled;
    await services.autoResponderService.toggleAutoResponder(selectedId, newStatus);

    const successEmbed = new EmbedBuilder()
      .setTitle(`${newStatus ? '<:tcet_tick:1437995479567962184>' : '❌'} Auto-Responder ${newStatus ? 'Enabled' : 'Disabled'}`)
      .setDescription(`Successfully ${newStatus ? 'enabled' : 'disabled'} auto-responder.`)
      .setColor(newStatus ? EmbedColors.SUCCESS : EmbedColors.WARNING)
      .addFields(
        { name: 'Trigger', value: `\`${selected.trigger}\``, inline: true },
        { name: 'Status', value: newStatus ? '<:tcet_tick:1437995479567962184> Enabled' : '❌ Disabled', inline: true }
      )
      .setFooter({ text: `Toggled by ${interaction.user.tag}` })
      .setTimestamp();

    await selectInteraction.update({
      embeds: [successEmbed],
      components: [],
    });
  } catch (error) {
    console.error('Error in toggle auto-responder:', error);
    await interaction.editReply({
      content: '❌ Toggle operation timed out or was cancelled.',
      embeds: [],
      components: [],
    });
  }
}
