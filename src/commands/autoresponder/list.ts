/**
 * List Auto-Responders Subcommand
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { AutoResponderService } from '../../services/AutoResponderService';
import { EmbedColors } from '../../types';

export async function handleList(
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

  const embed = new EmbedBuilder()
    .setTitle('📋 Auto-Responders')
    .setDescription(`Total: ${autoResponders.length}`)
    .setColor(EmbedColors.INFO)
    .setTimestamp();

  // Show up to 10 auto-responders per page
  const page = interaction.options.getInteger('page') ?? 1;
  const perPage = 10;
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginated = autoResponders.slice(start, end);

  for (const ar of paginated) {
    const status = ar.enabled ? '<:tcet_tick:1437995479567962184>' : '❌';
    const responsePreview = ar.response.length > 100 
      ? ar.response.substring(0, 97) + '...' 
      : ar.response;

    embed.addFields({
      name: `${status} ${ar.trigger}`,
      value: `**Response:** ${responsePreview}\n**ID:** \`${ar.id}\`\n**Created:** <t:${Math.floor(ar.createdAt.getTime() / 1000)}:R>`,
      inline: false,
    });
  }

  const totalPages = Math.ceil(autoResponders.length / perPage);
  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${page} of ${totalPages}` });
  }

  await interaction.editReply({ embeds: [embed] });
}
