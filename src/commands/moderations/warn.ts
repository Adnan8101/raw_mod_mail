/**
 * Warn Command - Issue a warning to a member
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { canModerate } from '../../utils/moderation';
import { ModerationService } from '../../services/ModerationService';
import { LoggingService } from '../../services/LoggingService';
import { createModerationEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Issue a warning to a member')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The member to warn')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the warning')
      .setRequired(true)
  );

export const category = 'moderation';
export const syntax = '!warn <user> <reason>';
export const example = '!warn @Jay Breaking rules';
export const permission = 'Moderate Members';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { moderationService: ModerationService; loggingService: LoggingService }
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
  const moderatorCheck = canModerate(moderator, target, PermissionFlagsBits.ModerateMembers);
  if (!moderatorCheck.allowed) {
    const errorEmbed = createErrorEmbed(moderatorCheck.reason || 'You cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Add warning
  try {
    await services.moderationService.addWarn(guild.id, target.id, interaction.user.id, reason);
    const warnCount = await services.moderationService.getWarnCount(guild.id, target.id);

    const embed = createModerationEmbed(
      'Warned',
      target.user,
      interaction.user,
      reason,
      [{ name: 'Total Warnings', value: warnCount.toString(), inline: true }]
    );

    await interaction.editReply({ embeds: [embed] });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Warn',
      target: target.user,
      moderator: interaction.user,
      reason,
    });

    // Try to DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`${CustomEmojis.CAUTION} Warning in ${guild.name}`)
        .setColor(EmbedColors.WARNING)
        .addFields(
          { name: 'Reason', value: reason, inline: false },
          { name: 'Total Warnings', value: warnCount.toString(), inline: true }
        )
        .setTimestamp();

      await target.send({ embeds: [dmEmbed] });
    } catch {
      // DM failed, ignore
    }
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to warn member: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
