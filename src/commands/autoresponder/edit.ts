/**
 * Edit Auto-Responder Subcommand
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuInteraction,
} from 'discord.js';
import { AutoResponderService } from '../../services/AutoResponderService';
import { EmbedColors } from '../../types';

export async function handleEdit(
  interaction: ChatInputCommandInteraction,
  services: { autoResponderService: AutoResponderService }
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const autoResponders = await services.autoResponderService.getAllAutoResponders(
    interaction.guildId!
  );

  if (autoResponders.length === 0) {
    await interaction.editReply({
      content: '❌ No auto-responders configured. Use `/autoresponder add` to create one.',
    });
    return;
  }

  // Create embed with dropdown
  const embed = new EmbedBuilder()
    .setTitle('✏️ Edit Auto-Responder')
    .setDescription('Select an auto-responder to edit from the dropdown below.')
    .setColor(EmbedColors.INFO);

  // Create dropdown menu with all auto-responders
  const options = autoResponders.slice(0, 25).map(ar => ({
    label: ar.trigger.length > 100 ? ar.trigger.substring(0, 97) + '...' : ar.trigger,
    description: ar.response.length > 100 ? ar.response.substring(0, 97) + '...' : ar.response,
    value: ar.id,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ar_edit_select_${Date.now()}`)
    .setPlaceholder('Select an auto-responder')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });

  // Wait for selection
  try {
    const selectInteraction = await interaction.channel?.awaitMessageComponent({
      filter: i => i.customId.startsWith('ar_edit_select_') && i.user.id === interaction.user.id,
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

    // Show modal with current values
    const modal = new ModalBuilder()
      .setCustomId(`ar_edit_modal_${selectedId}_${Date.now()}`)
      .setTitle('Edit Auto-Responder');

    const triggerInput = new TextInputBuilder()
      .setCustomId('trigger')
      .setLabel('Trigger')
      .setPlaceholder('Enter the trigger keyword/phrase')
      .setStyle(TextInputStyle.Short)
      .setValue(selected.trigger)
      .setRequired(true)
      .setMaxLength(200);

    const responseInput = new TextInputBuilder()
      .setCustomId('response')
      .setLabel('Response Message')
      .setPlaceholder('Enter the message the bot should send...')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(selected.response)
      .setRequired(true)
      .setMaxLength(2000);

    const triggerRow = new ActionRowBuilder<TextInputBuilder>().addComponents(triggerInput);
    const responseRow = new ActionRowBuilder<TextInputBuilder>().addComponents(responseInput);

    modal.addComponents(triggerRow, responseRow);

    await selectInteraction.showModal(modal);

    // Wait for modal submission
    const submitted = await selectInteraction.awaitModalSubmit({
      time: 300000, // 5 minutes
      filter: i => i.customId.startsWith(`ar_edit_modal_${selectedId}`) && i.user.id === interaction.user.id,
    });

    const newTrigger = submitted.fields.getTextInputValue('trigger');
    const newResponse = submitted.fields.getTextInputValue('response');

    // Update auto-responder
    await services.autoResponderService.updateAutoResponder(
      selectedId,
      newTrigger,
      newResponse
    );

    const successEmbed = new EmbedBuilder()
      .setTitle('<:tcet_tick:1437995479567962184> Auto-Responder Updated')
      .setDescription('Successfully updated auto-responder.')
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Old Trigger', value: `\`${selected.trigger}\``, inline: true },
        { name: 'New Trigger', value: `\`${newTrigger}\``, inline: true },
        { name: 'New Response', value: newResponse.length > 1024 ? newResponse.substring(0, 1021) + '...' : newResponse, inline: false }
      )
      .setFooter({ text: `Updated by ${interaction.user.tag}` })
      .setTimestamp();

    await submitted.reply({ embeds: [successEmbed], ephemeral: true });

    // Update original interaction
    await interaction.editReply({
      content: '<:tcet_tick:1437995479567962184> Auto-responder updated successfully!',
      embeds: [],
      components: [],
    });
  } catch (error) {
    console.error('Error in edit auto-responder:', error);
    await interaction.editReply({
      content: '❌ Edit operation timed out or was cancelled.',
      embeds: [],
      components: [],
    });
  }
}
