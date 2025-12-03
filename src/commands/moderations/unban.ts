/**
 * Unban Command - Unban a user from the server
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { CaseService } from '../../services/CaseService';
import { LoggingService } from '../../services/LoggingService';
import { createModerationEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from the server')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption(option =>
    option
      .setName('user_id')
      .setDescription('The user ID to unban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the unban')
      .setRequired(false)
  );

export const category = 'moderation';
export const syntax = '!unban <user_id> [reason]';
export const example = '!unban 123456789012345678 Appeal accepted';
export const permission = 'Ban Members';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { caseService: CaseService; loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const userId = interaction.options.getString('user_id', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;

  // Check if user is banned
  try {
    const ban = await guild.bans.fetch(userId);

    // Unban the user
    await guild.bans.remove(userId, reason);

    const embed = createModerationEmbed(
      'Unbanned',
      ban.user,
      interaction.user,
      reason
    );

    await interaction.editReply({ embeds: [embed] });

    // Log case
    const modCase = await services.caseService.createCase({
      guildId: guild.id,
      targetId: userId,
      moderatorId: interaction.user.id,
      action: 'unban',
      reason,
    });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Unban',
      target: ban.user,
      moderator: interaction.user,
      reason,
      caseNumber: modCase.caseNumber,
    });
  } catch (error: any) {
    if (error.code === 10026) {
      const errorEmbed = createErrorEmbed('This user is not banned.');
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      const errorEmbed = createErrorEmbed(`Failed to unban user: ${error.message}`);
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}
