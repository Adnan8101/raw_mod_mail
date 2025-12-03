/**
 * Mute Command - Timeout a member
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { canModerate, botCanModerate, parseDuration, formatDuration } from '../../utils/moderation';
import { CaseService } from '../../services/CaseService';
import { LoggingService } from '../../services/LoggingService';
import { createModerationEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Timeout a member')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The member to mute')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('duration')
      .setDescription('Duration (e.g., 5m, 1h, 2d)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the mute')
      .setRequired(false)
  );

export const category = 'moderation';
export const syntax = '!mute <user> [duration] [reason]';
export const example = '!mute @Jay 10m Spamming';
export const permission = 'Moderate Members';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { caseService: CaseService; loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration') || '30m';
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;
  const moderator = interaction.member as any;

  // Parse duration
  const duration = parseDuration(durationStr);
  if (!duration) {
    const errorEmbed = createErrorEmbed('Invalid duration format. Use formats like: 5s, 10m, 1h, 2d');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Max 28 days
  const maxDuration = 28 * 24 * 60 * 60 * 1000;
  if (duration > maxDuration) {
    const errorEmbed = createErrorEmbed('Duration cannot exceed 28 days.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Get member
  let target;
  try {
    target = await guild.members.fetch(user.id);
  } catch {
    const errorEmbed = createErrorEmbed('User is not a member of this server.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Check permissions
  const moderatorCheck = canModerate(moderator, target, PermissionFlagsBits.ModerateMembers);
  if (!moderatorCheck.allowed) {
    const errorEmbed = createErrorEmbed(moderatorCheck.reason || 'You cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const botCheck = botCanModerate(guild.members.me!, target, PermissionFlagsBits.ModerateMembers);
  if (!botCheck.allowed) {
    const errorEmbed = createErrorEmbed(botCheck.reason || 'I cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Perform timeout
  try {
    await target.timeout(duration, reason);

    const embed = createModerationEmbed(
      'Muted',
      target.user,
      interaction.user,
      reason,
      [{ name: 'Duration', value: formatDuration(duration), inline: true }]
    );

    await interaction.editReply({ embeds: [embed] });

    // Log case
    const modCase = await services.caseService.createCase({
      guildId: guild.id,
      targetId: target.id,
      moderatorId: interaction.user.id,
      action: 'mute',
      reason,
      metadata: { duration: formatDuration(duration) },
    });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Mute',
      target: target.user,
      moderator: interaction.user,
      reason,
      caseNumber: modCase.caseNumber,
      duration: formatDuration(duration),
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to mute member: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
