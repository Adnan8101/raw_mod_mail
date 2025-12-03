/**
 * Softban Command - Temporarily ban a user (ban then unban to delete messages)
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
  .setName('softban')
  .setDescription('Temporarily ban a user (kicks and deletes messages)')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to softban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('duration')
      .setDescription('Duration of the ban (e.g., 1h, 2d, 7d)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the softban')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option
      .setName('delete_days')
      .setDescription('Number of days of messages to delete (0-7)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(7)
  );

export const category = 'moderation';
export const syntax = '!softban <user> [delete_days] [reason]';
export const example = '!softban @Jay 1 Spamming';
export const permission = 'Ban Members';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { caseService: CaseService; loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const deleteDays = interaction.options.getInteger('delete_days') || 1;
  const guild = interaction.guild!;
  const moderator = interaction.member as any;

  // Parse duration
  const duration = parseDuration(durationStr);
  if (!duration) {
    const errorEmbed = createErrorEmbed('Invalid duration format. Use formats like: 1h, 2d, 7d');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Try to get member for permission checks
  let target;
  try {
    target = await guild.members.fetch(user.id);

    // Check permissions
    const moderatorCheck = canModerate(moderator, target, PermissionFlagsBits.BanMembers);
    if (!moderatorCheck.allowed) {
      const errorEmbed = createErrorEmbed(moderatorCheck.reason || 'You cannot moderate this user.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const botCheck = botCanModerate(guild.members.me!, target, PermissionFlagsBits.BanMembers);
    if (!botCheck.allowed) {
      const errorEmbed = createErrorEmbed(botCheck.reason || 'I cannot moderate this user.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
  } catch {
    // User not in server, continue with ban
  }

  // Perform softban
  try {
    // Ban the user
    await guild.bans.create(user.id, {
      reason: `Softban: ${reason}`,
      deleteMessageSeconds: deleteDays * 86400,
    });

    // Schedule unban after duration
    setTimeout(async () => {
      try {
        await guild.bans.remove(user.id, 'Softban expired');
      } catch (error) {
        console.error(`Failed to auto-unban ${user.id}:`, error);
      }
    }, duration);

    const embed = createModerationEmbed(
      'Softbanned',
      user,
      interaction.user,
      reason
    );

    await interaction.editReply({ embeds: [embed] });

    // Log case
    const modCase = await services.caseService.createCase({
      guildId: guild.id,
      targetId: user.id,
      moderatorId: interaction.user.id,
      action: 'softban',
      reason,
      metadata: { duration: formatDuration(duration) },
    });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Softban',
      target: user,
      moderator: interaction.user,
      reason,
      caseNumber: modCase.caseNumber,
      duration: formatDuration(duration),
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to softban user: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
