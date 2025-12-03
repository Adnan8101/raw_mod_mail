/**
 * Check Warn Command - View warnings for a member
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { ModerationService } from '../../services/ModerationService';
import { createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('checkwarn')
  .setDescription('Check warnings for a member')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to check')
      .setRequired(true)
  );

export const category = 'moderation';
export const syntax = '!checkwarn <user>';
export const example = '!checkwarn @Jay';
export const permission = 'Moderate Members';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { moderationService: ModerationService }
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.getUser('user', true);
  const guild = interaction.guild!;

  // Get warnings
  const warns = await services.moderationService.getWarns(guild.id, user.id);

  if (warns.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(EmbedColors.INFO)
      .setDescription(`${CustomEmojis.TICK} ${user.tag} has no warnings.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(`${CustomEmojis.CAUTION} Warnings for ${user.tag}`)
    .setDescription(`Total Warnings: **${warns.length}**`)
    .setColor(EmbedColors.WARNING)
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  // Add warnings (limit to last 10)
  const displayWarns = warns.slice(0, 10);
  for (const warn of displayWarns) {
    const moderator = await interaction.client.users.fetch(warn.moderatorId).catch(() => null);
    const timestamp = Math.floor(warn.createdAt.getTime() / 1000);

    embed.addFields({
      name: `Warn #${warns.indexOf(warn) + 1} - <t:${timestamp}:R>`,
      value: `**Moderator:** ${moderator?.tag || 'Unknown'}\n**Reason:** ${warn.reason || 'No reason provided'}`,
      inline: false,
    });
  }

  if (warns.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${warns.length} warnings` });
  }

  await interaction.editReply({ embeds: [embed] });
}
