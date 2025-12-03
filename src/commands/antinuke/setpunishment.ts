/**
 * SetPunishment Command - Configure punishments for actions
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { ConfigService } from '../../services/ConfigService';
import { ProtectionAction, PunishmentType, EmbedColors, SlashCommand } from '../../types';

export const data = new SlashCommandBuilder()
  .setName('setpunishment')
  .setDescription('Configure punishment for anti-nuke violations')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('The action to set punishment for')
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
        { name: 'Pruning Members', value: ProtectionAction.PRUNE_MEMBERS }
      )
  )
  .addStringOption(option =>
    option
      .setName('punishment')
      .setDescription('Punishment to apply')
      .setRequired(true)
      .addChoices(
        { name: 'Ban (permanent)', value: PunishmentType.BAN },
        { name: 'Kick (remove from server)', value: PunishmentType.KICK },
        { name: 'Timeout (temporary mute)', value: PunishmentType.TIMEOUT }
      )
  )
  .addIntegerOption(option =>
    option
      .setName('duration_seconds')
      .setDescription('Duration in seconds (required for timeout)')
      .setRequired(false)
      .setMinValue(60)
      .setMaxValue(2419200) // 28 days max
  );

export const slashCommand: SlashCommand = {
  data: data,
  execute: execute,
  category: 'antinuke',
  syntax: '/setpunishment <action> <punishment> [duration_seconds]',
  permission: 'Administrator',
  example: '/setpunishment action:ban_members punishment:ban'
};

import { checkCommandPermission } from '../../utils/permissionHelpers';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { configService: ConfigService }
): Promise<void> {
  // Permission Check: Role > Bot
  if (!await checkCommandPermission(interaction, { ownerOnly: false })) return;

  await interaction.deferReply();

  const action = interaction.options.getString('action', true) as ProtectionAction;
  const punishment = interaction.options.getString('punishment', true) as PunishmentType;
  const durationSeconds = interaction.options.getInteger('duration_seconds');

  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const botMember = guild.members.me!;

  // Validate timeout duration
  if (punishment === PunishmentType.TIMEOUT && !durationSeconds) {
    await interaction.editReply({
      content: '❌ Duration in seconds is required for timeout punishment.',
    });
    return;
  }

  // Validate bot permissions
  const permissionWarnings: string[] = [];

  if (punishment === PunishmentType.BAN && !botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
    permissionWarnings.push('❌ Bot lacks **BAN_MEMBERS** permission');
  }

  if (punishment === PunishmentType.KICK && !botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
    permissionWarnings.push('❌ Bot lacks **KICK_MEMBERS** permission');
  }

  if (punishment === PunishmentType.TIMEOUT && !botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    permissionWarnings.push('❌ Bot lacks **MODERATE_MEMBERS** permission');
  }

  if (permissionWarnings.length > 0) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Missing Permissions')
      .setDescription(
        'The bot is missing required permissions to execute this punishment:\n\n' +
        permissionWarnings.join('\n') +
        '\n\nThe punishment will be saved but won\'t work until permissions are granted.'
      )
      .setColor(EmbedColors.WARNING);

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  }

  // Validate anti-nuke is enabled
  const config = await services.configService.getConfig(guildId);
  if (!config?.enabled) {
    await interaction.editReply({
      content: '❌ Anti-Nuke is not enabled. Use `/antinuke enable` first.',
    });
    return;
  }

  // Check if this protection is active
  if (!config.protections.includes(action)) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Warning')
      .setDescription(
        `The protection for **${formatActionName(action)}** is not currently enabled.\n\n` +
        `The punishment will be saved, but won't take effect until you enable this protection.`
      )
      .setColor(EmbedColors.WARNING);

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  }

  // Set the punishment
  await services.configService.setPunishment(guildId, {
    action,
    punishment,
    durationSeconds: durationSeconds ?? undefined,
  });

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('<:tcet_tick:1437995479567962184> Punishment Configured')
    .setDescription(`When users exceed the limit for this action, they will be punished.`)
    .setColor(EmbedColors.SUCCESS)
    .addFields(
      { name: 'Action', value: formatActionName(action), inline: true },
      { name: 'Punishment', value: punishment.toUpperCase(), inline: true }
    )
    .setFooter({
      text: `Configured by ${interaction.user.tag} (${interaction.user.id})`,
    })
    .setTimestamp();

  if (durationSeconds) {
    embed.addFields({
      name: 'Duration',
      value: formatDuration(durationSeconds),
      inline: true,
    });
  }

  // Add enforcement description
  const limit = await services.configService.getLimit(guildId, action);
  if (limit) {
    embed.addFields({
      name: 'Enforcement',
      value: `Users performing more than **${limit.limitCount}** ${formatActionName(action).toLowerCase()} ` +
        `within **${limit.windowMs / 1000}** seconds will be **${punishment}**${durationSeconds ? ` for ${formatDuration(durationSeconds)}` : ''
        }.`,
      inline: false,
    });
  } else {
    embed.addFields({
      name: '⚠️ Next Step',
      value: `Set a limit for this action using \`/setlimit ${action}\``,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

function formatActionName(action: ProtectionAction): string {
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
