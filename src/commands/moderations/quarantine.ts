/**
 * Quarantine Command - Quarantine/unquarantine members and setup
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { canModerate, botCanModerate } from '../../utils/moderation';
import { ModerationService } from '../../services/ModerationService';
import { CaseService } from '../../services/CaseService';
import { LoggingService } from '../../services/LoggingService';
import { createErrorEmbed, createSuccessEmbed, createModerationEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('quarantine')
  .setDescription('Manage quarantine system')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Setup quarantine role and channel')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Quarantine role')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Quarantine channel')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Quarantine a member')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Member to quarantine')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for quarantine')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove member from quarantine')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Member to unquarantine')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for removal')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('config')
      .setDescription('View quarantine configuration')
  );

export const category = 'moderation';
export const syntax = '/quarantine <add|remove|setup|config>';
export const example = '/quarantine add user:@Jay reason:Raiding';
export const permission = 'Manage Roles';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    moderationService: ModerationService;
    caseService: CaseService;
    loggingService: LoggingService;
  }
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'setup':
      await handleSetup(interaction, services);
      break;
    case 'add':
      await handleAdd(interaction, services);
      break;
    case 'remove':
      await handleRemove(interaction, services);
      break;
    case 'config':
      await handleConfig(interaction, services);
      break;
  }
}

async function handleSetup(
  interaction: ChatInputCommandInteraction,
  services: { moderationService: ModerationService }
): Promise<void> {
  await interaction.deferReply();

  const role = interaction.options.getRole('role', true);
  const channel = interaction.options.getChannel('channel', true);
  const guild = interaction.guild!;

  // Validate role
  if (role.id === guild.roles.everyone.id) {
    const errorEmbed = createErrorEmbed('Cannot use @everyone role for quarantine.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const botMember = guild.members.me!;
  if (role.position >= botMember.roles.highest.position) {
    const errorEmbed = createErrorEmbed('Quarantine role must be below my highest role.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Save configuration
  await services.moderationService.setupQuarantine(guild.id, role.id, channel.id);

  // Auto-configure role permissions
  try {
    // Get all channels
    const channels = await guild.channels.fetch();

    // Hide all channels from quarantine role
    for (const [channelId, guildChannel] of channels) {
      if (!guildChannel) continue;

      try {
        if ('permissionOverwrites' in guildChannel) {
          await guildChannel.permissionOverwrites.create(role.id, {
            ViewChannel: false,
            SendMessages: false,
            Connect: false,
          });
        }
      } catch (err) {
        console.error(`Failed to configure channel ${channelId}:`, err);
      }
    }

    // Allow access to the designated channel
    const accessChannel = await guild.channels.fetch(channel.id);
    if (accessChannel && 'permissionOverwrites' in accessChannel) {
      await accessChannel.permissionOverwrites.create(role.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${CustomEmojis.TICK} Quarantine System Configured`)
      .setDescription('Quarantine system has been set up successfully with automatic permissions.')
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Quarantine Role', value: `${role}`, inline: true },
        { name: 'Access Channel', value: `${channel}`, inline: true },
        {
          name: 'Configuration',
          value:
            '✓ All channels hidden from quarantine role\n' +
            '✓ Access channel configured for quarantined users',
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Configuration saved but failed to set permissions: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleAdd(
  interaction: ChatInputCommandInteraction,
  services: {
    moderationService: ModerationService;
    caseService: CaseService;
    loggingService: LoggingService;
  }
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;
  const moderator = interaction.member as any;

  // Get quarantine config
  const config = await services.moderationService.getQuarantineConfig(guild.id);
  if (!config) {
    const errorEmbed = createErrorEmbed('Quarantine system is not configured. Use `/quarantine setup` first.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Get member
  let target;
  try {
    target = await guild.members.fetch(user.id);
  } catch {
    await interaction.editReply({
      content: '❌ User is not a member of this server.',
    });
    return;
  }

  // Check permissions
  const moderatorCheck = canModerate(moderator, target, PermissionFlagsBits.ManageRoles);
  if (!moderatorCheck.allowed) {
    const errorEmbed = createErrorEmbed(moderatorCheck.reason || 'You cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const botCheck = botCanModerate(guild.members.me!, target, PermissionFlagsBits.ManageRoles);
  if (!botCheck.allowed) {
    const errorEmbed = createErrorEmbed(botCheck.reason || 'I cannot moderate this user.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Check if already quarantined
  if (target.roles.cache.has(config.roleId)) {
    const errorEmbed = createErrorEmbed('This member is already quarantined.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Add quarantine role
  try {
    await target.roles.add(config.roleId, reason);

    const embed = createModerationEmbed(
      'Quarantined',
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
      action: 'quarantine',
      reason,
    });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Quarantine',
      target: target.user,
      moderator: interaction.user,
      reason,
      caseNumber: modCase.caseNumber,
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to quarantine member: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  services: {
    moderationService: ModerationService;
    caseService: CaseService;
    loggingService: LoggingService;
  }
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;

  // Get quarantine config
  const config = await services.moderationService.getQuarantineConfig(guild.id);
  if (!config) {
    const errorEmbed = createErrorEmbed('Quarantine system is not configured.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Get member
  let target;
  try {
    target = await guild.members.fetch(user.id);
  } catch {
    await interaction.editReply({
      content: '❌ User is not a member of this server.',
    });
    return;
  }

  // Check if quarantined
  if (!target.roles.cache.has(config.roleId)) {
    const errorEmbed = createErrorEmbed('This member is not quarantined.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Remove quarantine role
  try {
    await target.roles.remove(config.roleId, reason);

    const embed = createModerationEmbed(
      'Unquarantined',
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
      action: 'unquarantine',
      reason,
    });

    // Send to logging channel
    await services.loggingService.logModeration(guild.id, {
      action: 'Unquarantine',
      target: target.user,
      moderator: interaction.user,
      reason,
      caseNumber: modCase.caseNumber,
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to remove quarantine: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleConfig(
  interaction: ChatInputCommandInteraction,
  services: { moderationService: ModerationService }
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const config = await services.moderationService.getQuarantineConfig(guild.id);

  if (!config) {
    const errorEmbed = createErrorEmbed('Quarantine system is not configured. Use `/quarantine setup` to configure it.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const role = guild.roles.cache.get(config.roleId);
  const channel = guild.channels.cache.get(config.accessChannelId);

  const embed = new EmbedBuilder()
    .setTitle('📋 Quarantine Configuration')
    .setColor(EmbedColors.INFO)
    .addFields(
      { name: 'Quarantine Role', value: role ? `${role}` : `Unknown (${config.roleId})`, inline: true },
      {
        name: 'Access Channel',
        value: channel ? `${channel}` : `Unknown (${config.accessChannelId})`,
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
