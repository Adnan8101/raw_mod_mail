/**
 * Ban Command - Ban a member from the server
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { createModerationEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { canModerate, botCanModerate } from '../../utils/moderation';
import { CaseService } from '../../services/CaseService';
import { LoggingService } from '../../services/LoggingService';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member from the server')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to ban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the ban')
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
export const syntax = '!ban <user> [reason] [delete_days]';
export const example = '!ban @Jay Raiding the server and mass spamming 1';
export const permission = 'Ban Members';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { caseService: CaseService; loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const deleteDays = interaction.options.getInteger('delete_days') || 0;
  const guild = interaction.guild!;
  const moderator = interaction.member as any;

  // Try to get member
  let target;
  try {
    target = await guild.members.fetch(user.id);
  } catch {
    // User not in guild, can still ban by ID
    try {
      await guild.bans.create(user.id, { reason, deleteMessageSeconds: deleteDays * 86400 });

      const embed = createModerationEmbed(
        'Banned',
        user as any, // Cast to any or User since we don't have a full GuildMember
        interaction.user,
        reason
      );

      await interaction.editReply({ embeds: [embed] });

      // Log case
      await services.caseService.createCase({
        guildId: guild.id,
        targetId: user.id,
        moderatorId: interaction.user.id,
        action: 'ban',
        reason,
      });

      return;
    } catch (error: any) {
      const errorEmbed = createErrorEmbed(`Failed to ban user: ${error.message}`);
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
  }

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

  // Perform ban
  try {
    await target.ban({ reason, deleteMessageSeconds: deleteDays * 86400 });

    const embed = createModerationEmbed(
      'Banned',
      target.user,
      interaction.user,
      reason,
      [{ name: `${CustomEmojis.FILES} Messages Deleted`, value: `${deleteDays} day${deleteDays !== 1 ? 's' : ''}`, inline: true }]
    );

    await interaction.editReply({ embeds: [embed] });

    // Log case
    const modCase = await services.caseService.createCase({
      guildId: guild.id,
      targetId: target.id,
      moderatorId: interaction.user.id,
      action: 'ban',
      reason,
    });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Ban',
      target: target.user,
      moderator: interaction.user,
      reason,
      caseNumber: modCase.caseNumber,
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to ban member: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
