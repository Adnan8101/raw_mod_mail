/**
 * Kick Command - Kick a member from the server
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { canModerate, botCanModerate } from '../../utils/moderation';
import { CaseService } from '../../services/CaseService';
import { LoggingService } from '../../services/LoggingService';
import { createModerationEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The member to kick')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the kick')
      .setRequired(false)
  );

export const category = 'moderation';
export const syntax = '!kick <user> [reason]';
export const example = '!kick @Jay Spamming';
export const permission = 'Kick Members';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { caseService: CaseService; loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;
  const moderator = interaction.member as any;

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
  // Check permissions
  const moderatorCheck = canModerate(moderator, target, PermissionFlagsBits.KickMembers);
  if (!moderatorCheck.allowed) {
    const errorEmbed = createErrorEmbed(moderatorCheck.reason || 'You cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const botCheck = botCanModerate(guild.members.me!, target, PermissionFlagsBits.KickMembers);
  if (!botCheck.allowed) {
    const errorEmbed = createErrorEmbed(botCheck.reason || 'I cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Perform kick
  try {
    await target.kick(reason);

    const embed = createModerationEmbed(
      'Kicked',
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
      action: 'kick',
      reason,
    });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Kick',
      target: target.user,
      moderator: interaction.user,
      reason,
      caseNumber: modCase.caseNumber,
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to kick member: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
