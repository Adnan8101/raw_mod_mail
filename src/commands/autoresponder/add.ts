/**
 * Add Auto-Responder Subcommand
 */

import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js';
import { AutoResponderService } from '../../services/AutoResponderService';
import { EmbedColors } from '../../types';

export async function handleAdd(
  interaction: ChatInputCommandInteraction,
  services: { autoResponderService: AutoResponderService }
): Promise<void> {
  const trigger = interaction.options.getString('trigger', true);

  // Create modal for response input
  const modal = new ModalBuilder()
    .setCustomId(`ar_add_${trigger}_${Date.now()}`)
    .setTitle('Add Auto-Responder');

  const responseInput = new TextInputBuilder()
    .setCustomId('response')
    .setLabel('Response Message')
    .setPlaceholder('Enter the message the bot should send...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(responseInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);

  // Wait for modal submission
  try {
    const submitted = await interaction.awaitModalSubmit({
      time: 300000, // 5 minutes
      filter: i => i.customId.startsWith('ar_add_') && i.user.id === interaction.user.id,
    });

    const response = submitted.fields.getTextInputValue('response');

    // Add auto-responder
    await services.autoResponderService.addAutoResponder(
      interaction.guildId!,
      trigger,
      response,
      interaction.user.id
    );

    const embed = new EmbedBuilder()
      .setTitle('<:tcet_tick:1437995479567962184> Auto-Responder Added')
      .setDescription('Successfully added new auto-responder.')
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Trigger', value: `\`${trigger}\``, inline: true },
        { name: 'Response', value: response.length > 1024 ? response.substring(0, 1021) + '...' : response, inline: false }
      )
      .setFooter({ text: `Created by ${interaction.user.tag}` })
      .setTimestamp();

    await submitted.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    // Modal timed out or error occurred
    console.error('Error in add auto-responder:', error);
  }
}
