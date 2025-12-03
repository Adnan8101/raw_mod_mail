/**
 * Unmute Command - Remove timeout from a member
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
  .setName('unmute')
  .setDescription('Remove timeout from a member')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The member to unmute')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the unmute')
      .setRequired(false)
  );

export const category = 'moderation';
export const syntax = '!unmute <user> [reason]';
export const example = '!unmute @Jay Appeal accepted';
export const permission = 'Moderate Members';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { caseService: CaseService; loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;

  // Get member
  let target;
  try {
    target = await guild.members.fetch(user.id);
  } catch {
    const errorEmbed = createErrorEmbed('User is not a member of this server.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Check if member is muted
  if (!target.isCommunicationDisabled()) {
    const errorEmbed = createErrorEmbed('This member is not muted.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Remove timeout
  try {
    await target.timeout(null, reason);

    const embed = createModerationEmbed(
      'Unmuted',
      target.user,
      interaction.user,
      reason
    );

    await interaction.editReply({ embeds: [embed] });

    // Log case
    const modCase = await services.caseService.createCase({
      guildId: guild.id,
      targetId: target.id,
      moderatorId: interaction.user.id,
      action: 'unmute',
      reason,
    });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Unmute',
      target: target.user,
      moderator: interaction.user,
      reason,
      caseNumber: modCase.caseNumber,
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to unmute member: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
