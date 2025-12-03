/**
 * Nick Command - Change a member's nickname
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
import { LoggingService } from '../../services/LoggingService';
import { createErrorEmbed, createModerationEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('nick')
  .setDescription('Change a member\'s nickname')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The member to change nickname')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('nickname')
      .setDescription('New nickname (max 32 chars)')
      .setRequired(true)
      .setMaxLength(32)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the change')
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const nickname = interaction.options.getString('nickname');
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
  const moderatorCheck = canModerate(moderator, target, PermissionFlagsBits.ManageNicknames);
  if (!moderatorCheck.allowed) {
    const errorEmbed = createErrorEmbed(moderatorCheck.reason || 'You cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const botCheck = botCanModerate(guild.members.me!, target, PermissionFlagsBits.ManageNicknames);
  if (!botCheck.allowed) {
    const errorEmbed = createErrorEmbed(botCheck.reason || 'I cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Store old nickname
  const oldNickname = target.nickname || target.user.username;

  // Change nickname
  try {
    await target.setNickname(nickname, reason);

    const embed = createModerationEmbed(
      `Changed nickname of`,
      user,
      interaction.user,
      reason
    );

    await interaction.editReply({ embeds: [embed] });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Nickname Change',
      target: user,
      moderator: interaction.user,
      reason: `${oldNickname} → ${nickname || user.username}`,
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to change nickname: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
