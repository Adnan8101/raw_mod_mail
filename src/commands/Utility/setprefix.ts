/**
 * Setprefix Command - Set custom command prefix
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { GuildConfigService } from '../../services/GuildConfigService';
import { createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('setprefix')
  .setDescription('Set the command prefix for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(option =>
    option
      .setName('prefix')
      .setDescription('New prefix (e.g., !, ?, .)')
      .setRequired(true)
      .setMaxLength(5)
  );

export const category = 'moderation';
export const syntax = '/setprefix <prefix>';
export const example = '/setprefix !';
export const permission = 'Manage Guild';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { guildConfigService: GuildConfigService }
): Promise<void> {
  const prefix = interaction.options.getString('prefix', true);
  const guild = interaction.guild!;

  // Validate prefix
  if (prefix.length > 5) {
    const errorEmbed = createErrorEmbed('Prefix must be 5 characters or less.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  // Set prefix
  await services.guildConfigService.setPrefix(guild.id, prefix);

  const embed = new EmbedBuilder()
    .setTitle(`${CustomEmojis.TICK} Prefix Updated`)
    .setDescription(`Command prefix has been set to \`${prefix}\``)
    .setColor(EmbedColors.SUCCESS)
    .addFields(
      { name: 'New Prefix', value: `\`${prefix}\``, inline: true },
      { name: 'Example', value: `\`${prefix}ban @Tai\``, inline: true }
    )
    .setFooter({ text: 'Slash commands will continue to work' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
