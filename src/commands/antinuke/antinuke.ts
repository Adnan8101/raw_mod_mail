/**
 * Anti-Nuke Command - /antinuke enable, disable, status, restore
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { ConfigService } from '../../services/ConfigService';
import { WhitelistService } from '../../services/WhitelistService';
import { LoggingService } from '../../services/LoggingService';
import { ActionLimiter } from '../../modules/ActionLimiter';
import { ProtectionAction, WhitelistCategory, EmbedColors, RecoveryMode, SlashCommand, PunishmentType } from '../../types';
import { CustomEmojis } from '../../utils/emoji';

export const data = new SlashCommandBuilder()
  .setName('antinuke')
  .setDescription('Manage anti-nuke protection')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('enable')
      .setDescription('Enable anti-nuke protection')
      .addStringOption(option =>
        option
          .setName('actions')
          .setDescription('Which protections to enable (comma-separated or ALL)')
          .setRequired(true)
          .addChoices(
            { name: 'Banning Members', value: ProtectionAction.BAN_MEMBERS },
            { name: 'Kicking Members', value: ProtectionAction.KICK_MEMBERS },
            { name: 'Deleting Roles', value: ProtectionAction.DELETE_ROLES },
            { name: 'Creating Roles', value: ProtectionAction.CREATE_ROLES },
            { name: 'Deleting Channels', value: ProtectionAction.DELETE_CHANNELS },
            { name: 'Creating Channels', value: ProtectionAction.CREATE_CHANNELS },
            { name: 'Adding Bots', value: ProtectionAction.ADD_BOTS },
            { name: 'Dangerous Permissions', value: ProtectionAction.DANGEROUS_PERMS },
            { name: 'Giving Admin Roles', value: ProtectionAction.GIVE_ADMIN_ROLE },
            { name: 'Pruning Members', value: ProtectionAction.PRUNE_MEMBERS },
            { name: 'ALL PROTECTIONS', value: 'ALL' }
          )
      )
      .addIntegerOption(option =>
        option
          .setName('window_seconds')
          .setDescription('Time window in seconds (default: 10s)')
          .setRequired(false)
          .setMinValue(5)
          .setMaxValue(300)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('disable')
      .setDescription('Disable anti-nuke protection')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Auto-configure anti-nuke with recommended defaults (All Protections, Ban, 3/10s)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('View anti-nuke status')
      .addBooleanOption(option =>
        option
          .setName('brief')
          .setDescription('Show brief status only')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reset')
      .setDescription('⚠️ Reset ALL anti-nuke configuration (requires re-setup)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('restore')
      .setDescription('Restore server from backup after a nuke')
      .addStringOption(option =>
        option
          .setName('mode')
          .setDescription('Restoration mode')
          .setRequired(false)
          .addChoices(
            { name: 'Partial (minimal restore)', value: RecoveryMode.PARTIAL },
            { name: 'Full (complete restore)', value: RecoveryMode.FULL }
          )
      )
      .addBooleanOption(option =>
        option
          .setName('preview')
          .setDescription('Preview what would be restored without actually restoring')
          .setRequired(false)
      )
  );

export const slashCommand: SlashCommand = {
  data: data,
  execute: execute,
  category: 'antinuke',
  syntax: '/antinuke <enable|disable|setup|status|restore|reset>',
  permission: 'Administrator',
  example: '/antinuke enable actions:ALL'
};

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    configService: ConfigService;
    whitelistService: WhitelistService;
    loggingService: LoggingService;
    actionLimiter: ActionLimiter;
    autoModService?: any;
    prisma?: any;
  }
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  switch (subcommand) {
    case 'enable':
      await handleEnable(interaction, services, guildId);
      break;
    case 'disable':
      await handleDisable(interaction, services, guildId);
      break;
    case 'setup':
      await handleSetup(interaction, services, guildId);
      break;
    case 'status':
      await handleStatus(interaction, services, guildId);
      break;
    case 'reset':
      await handleReset(interaction, services, guildId);
      break;
    case 'restore':
      await handleRestore(interaction, services, guildId);
      break;
  }
}

import { checkCommandPermission } from '../../utils/permissionHelpers';

async function handleEnable(
  interaction: ChatInputCommandInteraction,
  services: { configService: ConfigService; loggingService: LoggingService },
  guildId: string
): Promise<void> {
  // Permission Check: Owner Only
  if (!await checkCommandPermission(interaction, { ownerOnly: true })) return;

  await interaction.deferReply();

  const actionsString = interaction.options.getString('actions', true);
  const windowSeconds = interaction.options.getInteger('window_seconds') ?? 10;
  const windowMs = windowSeconds * 1000;

  // Parse actions
  let protections: ProtectionAction[];
  if (actionsString === 'ALL') {
    protections = Object.values(ProtectionAction);
  } else {
    protections = actionsString.split(',').map(a => a.trim()) as ProtectionAction[];
  }

  // Validate protections
  const validProtections = Object.values(ProtectionAction);
  const invalid = protections.filter(p => !validProtections.includes(p));

  if (invalid.length > 0) {
    const errorEmbed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setDescription(`${CustomEmojis.CROSS} Invalid protection types: ${invalid.join(', ')}`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Check bot permissions
  const guild = interaction.guild!;
  const botMember = guild.members.me!;
  const requiredPerms = [
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
  ];

  const missingPerms = requiredPerms.filter(perm => !botMember.permissions.has(perm));
  const warnings: string[] = [];

  if (missingPerms.length > 0) {
    warnings.push(`${CustomEmojis.CAUTION} Bot is missing required permissions. Some protections may not work.`);
  }

  // Get existing config and merge protections (append new ones)
  const existingConfig = await services.configService.getConfig(guildId);
  let finalProtections: ProtectionAction[];

  if (actionsString === 'ALL') {
    // If ALL selected, replace with all protections
    finalProtections = protections;
  } else if (existingConfig?.protections) {
    // Append new protections to existing ones (maintain order, avoid duplicates)
    const existingSet = new Set(existingConfig.protections);
    finalProtections = [...existingConfig.protections];

    for (const protection of protections) {
      if (!existingSet.has(protection)) {
        finalProtections.push(protection);
      }
    }
  } else {
    // No existing config, use new protections
    finalProtections = protections;
  }

  // Enable anti-nuke with merged protections
  await services.configService.enableAntiNuke(guildId, finalProtections);

  // Set default limits for newly added protections (3 actions per window)
  const newProtections = actionsString === 'ALL'
    ? finalProtections
    : protections.filter(p => !existingConfig?.protections.includes(p));

  for (const protection of newProtections) {
    const existingLimit = await services.configService.getLimit(guildId, protection);
    if (!existingLimit) {
      // Set default limit: 3 actions per window
      await services.configService.setLimit(guildId, protection, 3, windowMs);
    }
  }

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(`${CustomEmojis.TICK} Anti-Nuke Enabled`)
    .setDescription(`${CustomEmojis.SETTING} Anti-Nuke protection is now active for this server.`)
    .setColor(EmbedColors.SUCCESS)
    .addFields(
      {
        name: `${CustomEmojis.SETTING} Protections`,
        value: protections.map(p => `${CustomEmojis.TICK} ${formatProtectionName(p)}`).join('\n'),
        inline: false,
      },
      {
        name: 'Default Limits',
        value: `3 actions per ${windowSeconds} seconds`,
        inline: true,
      },
      {
        name: 'Next Steps',
        value: [
          '1. Adjust limits: `/setlimit`',
          '2. Configure punishments: `/setpunishment`',
          '3. Set up logging: `/logs security` and `/logs mod`',
          '4. Add whitelist: `/whitelist add_user` or `/whitelist add_role`',
        ].join('\n'),
        inline: false,
      }
    )
    .setFooter({
      text: `Enabled by ${interaction.user.tag} (${interaction.user.id})`,
    })
    .setTimestamp();

  if (warnings.length > 0) {
    embed.addFields({
      name: `${CustomEmojis.CAUTION} Warnings`,
      value: warnings.join('\n'),
      inline: false,
    });
  }

  // Respond without buttons (button handlers not implemented yet)
  await interaction.editReply({
    embeds: [embed],
  });
}

async function handleSetup(
  interaction: ChatInputCommandInteraction,
  services: { configService: ConfigService },
  guildId: string
): Promise<void> {
  // Permission Check: Role > Bot
  if (!await checkCommandPermission(interaction, { ownerOnly: false })) return;

  await interaction.deferReply();

  const allProtections = Object.values(ProtectionAction);

  // 1. Enable Anti-Nuke with ALL protections
  await services.configService.enableAntiNuke(guildId, allProtections);

  // 2. Set default limits (3 actions in 10s)
  const defaultLimit = 3;
  const defaultWindowMs = 10000; // 10s

  for (const action of allProtections) {
    await services.configService.setLimit(guildId, action, defaultLimit, defaultWindowMs);
  }

  // 3. Set default punishment (BAN)
  for (const action of allProtections) {
    await services.configService.setPunishment(guildId, {
      action: action,
      punishment: PunishmentType.BAN
    });
  }

  // 4. Send success embed
  const embed = new EmbedBuilder()
    .setTitle(`${CustomEmojis.TICK} Anti-Nuke Setup Complete`)
    .setDescription(`${CustomEmojis.SETTING} Anti-Nuke has been fully configured with recommended defaults.`)
    .setColor(EmbedColors.SUCCESS)
    .addFields(
      {
        name: 'Configuration',
        value: [
          `${CustomEmojis.TICK} **Enabled:** All Protections`,
          `${CustomEmojis.TICK} **Limits:** 3 actions in 10 seconds`,
          `${CustomEmojis.TICK} **Punishment:** Ban`,
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Next Steps',
        value: 'You can customize specific settings using `/setlimit` and `/setpunishment` if needed.',
        inline: false,
      }
    )
    .setFooter({
      text: `Setup by ${interaction.user.tag} (${interaction.user.id})`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleDisable(
  interaction: ChatInputCommandInteraction,
  services: { configService: ConfigService },
  guildId: string
): Promise<void> {
  // Permission Check: Owner Only
  if (!await checkCommandPermission(interaction, { ownerOnly: true })) return;

  await interaction.deferReply();

  await services.configService.disableAntiNuke(guildId);

  const embed = new EmbedBuilder()
    .setTitle(`${CustomEmojis.CROSS} Anti-Nuke Disabled`)
    .setDescription(`${CustomEmojis.CAUTION} Anti-Nuke protection has been disabled for this server.`)
    .setColor(EmbedColors.ERROR)
    .setFooter({
      text: `Disabled by ${interaction.user.tag} (${interaction.user.id})`,
    })
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
  });
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  services: {
    configService: ConfigService;
    whitelistService: WhitelistService;
    loggingService: LoggingService;
    actionLimiter: ActionLimiter;
    autoModService?: any;
    prisma?: any;
  },
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const brief = interaction.options.getBoolean('brief') ?? false;

  // Get configuration
  const config = await services.configService.getConfig(guildId);
  const loggingConfig = await services.loggingService.getConfig(guildId);

  if (!config) {
    const errorEmbed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setDescription(`${CustomEmojis.CROSS} Anti-Nuke is not configured for this server. Use \`/antinuke enable\` to get started.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${CustomEmojis.SETTING} Anti-Nuke & AutoMod Status`)
    .setColor(config.enabled ? EmbedColors.SUCCESS : EmbedColors.ERROR)
    .addFields(
      {
        name: 'Anti-Nuke Status',
        value: config.enabled ? `${CustomEmojis.TICK} Enabled` : `${CustomEmojis.CROSS} Disabled`,
        inline: true,
      },
      {
        name: `${CustomEmojis.SETTING} Protections`,
        value: config.protections.length > 0
          ? config.protections.map(p => `• ${formatProtectionName(p)}`).join('\n')
          : 'None configured',
        inline: false,
      }
    );

  // Add AutoMod status if service is available
  if (services.autoModService) {
    try {
      const antiSpam = await services.autoModService.getConfig(guildId, 'anti_spam');
      const massMention = await services.autoModService.getConfig(guildId, 'mass_mention');
      const serverInvite = await services.autoModService.getConfig(guildId, 'server_invite');
      const antiLink = await services.autoModService.getConfig(guildId, 'anti_link');

      const automodStatus = [];
      if (antiSpam?.enabled) automodStatus.push(`${CustomEmojis.TICK} Anti-Spam`);
      if (massMention?.enabled) automodStatus.push(`${CustomEmojis.TICK} Mass Mention`);
      if (serverInvite?.enabled) automodStatus.push(`${CustomEmojis.TICK} Server Invite Block`);
      if (antiLink?.enabled) automodStatus.push(`${CustomEmojis.TICK} Anti-Link`);

      embed.addFields({
        name: `${CustomEmojis.CAUTION} AutoMod Features`,
        value: automodStatus.length > 0 ? automodStatus.join('\n') : 'None enabled',
        inline: false,
      });
    } catch (e) {
      // AutoMod not configured
    }
  }

  // Add configured punishments
  const allPunishments = await services.configService.getAllPunishments(guildId);
  if (allPunishments.length > 0) {
    const punishmentLines = allPunishments.map(p => {
      let line = `• ${formatProtectionName(p.action)}: **${p.punishment.toUpperCase()}**`;
      if (p.durationSeconds) {
        line += ` (${formatDuration(p.durationSeconds)})`;
      }
      return line;
    });
    embed.addFields({
      name: 'Configured Punishments',
      value: punishmentLines.join('\n'),
      inline: false,
    });
  }

  // Add logging channels
  const loggingValue = [];
  if (loggingConfig.securityChannel) {
    loggingValue.push(`Security: <#${loggingConfig.securityChannel}>`);
  }
  if (loggingConfig.modChannel) {
    loggingValue.push(`Moderation: <#${loggingConfig.modChannel}>`);
  }
  if (loggingValue.length === 0) {
    loggingValue.push('Not configured');
  }

  embed.addFields({
    name: 'Logging',
    value: loggingValue.join('\n'),
    inline: false,
  });

  // Add recent actions if not brief
  if (!brief) {
    const recentActions = await services.actionLimiter.getRecentActions(guildId, 5);
    if (recentActions.length > 0) {
      embed.addFields({
        name: 'Recent Activity',
        value: recentActions
          .map(a => `• ${formatProtectionName(a.action)} by <@${a.userId}> - <t:${Math.floor(a.timestamp.getTime() / 1000)}:R>`)
          .join('\n'),
        inline: false,
      });
    }
  }

  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

async function handleReset(
  interaction: ChatInputCommandInteraction,
  services: { configService: ConfigService; whitelistService: WhitelistService; actionLimiter: ActionLimiter },
  guildId: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // Reset all configuration for this guild
  await services.configService.resetGuild(guildId);
  await services.whitelistService.clearAllWhitelist(guildId);
  await services.actionLimiter.clearAllActions(guildId);

  const embed = new EmbedBuilder()
    .setTitle(`${CustomEmojis.CAUTION} Anti-Nuke Configuration Reset`)
    .setDescription(
      `${CustomEmojis.CAUTION} **All anti-nuke configuration has been wiped.**\n\n` +
      'The following has been deleted:\n' +
      '• Anti-nuke enabled/disabled status\n' +
      '• All protection settings\n' +
      '• All configured limits\n' +
      '• All configured punishments\n' +
      '• All whitelisted users and roles\n' +
      '• All action history\n\n' +
      'Use `/antinuke enable` to set up protection again.'
    )
    .setColor(EmbedColors.WARNING)
    .setFooter({
      text: `Reset by ${interaction.user.tag} (${interaction.user.id})`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleRestore(
  interaction: ChatInputCommandInteraction,
  services: any,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const mode = (interaction.options.getString('mode') as RecoveryMode) ?? RecoveryMode.PARTIAL;
  const preview = interaction.options.getBoolean('preview') ?? false;

  // This is a placeholder - full recovery implementation would be more complex
  const embed = new EmbedBuilder()
    .setTitle(preview ? `${CustomEmojis.SETTING} Restore Preview` : `${CustomEmojis.SETTING} Restore Started`)
    .setDescription(
      preview
        ? 'Preview mode: Shows what would be restored without making changes'
        : 'Server restore has been queued. This may take several minutes.'
    )
    .setColor(EmbedColors.INFO)
    .addFields(
      { name: 'Mode', value: mode === RecoveryMode.FULL ? 'Full Restore' : 'Partial Restore', inline: true },
      {
        name: 'Note',
        value: `${CustomEmojis.CAUTION} Full implementation requires RecoveryManager and JobQueue integration`,
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

function formatProtectionName(action: ProtectionAction): string {
  const names: Record<ProtectionAction, string> = {
    [ProtectionAction.BAN_MEMBERS]: 'Banning Members',
    [ProtectionAction.KICK_MEMBERS]: 'Kicking Members',
    [ProtectionAction.DELETE_ROLES]: 'Deleting Roles',
    [ProtectionAction.CREATE_ROLES]: 'Creating Roles',
    [ProtectionAction.DELETE_CHANNELS]: 'Deleting Channels',
    [ProtectionAction.CREATE_CHANNELS]: 'Creating Channels',
    [ProtectionAction.ADD_BOTS]: 'Adding Bots',
    [ProtectionAction.DANGEROUS_PERMS]: 'Dangerous Permissions',
    [ProtectionAction.GIVE_ADMIN_ROLE]: 'Giving Admin Roles',
    [ProtectionAction.PRUNE_MEMBERS]: 'Pruning Members',
  };
  return names[action] || action;
}
