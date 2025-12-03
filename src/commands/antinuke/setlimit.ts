/**
 * SetLimit Command - Configure action limits
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { ConfigService } from '../../services/ConfigService';
import { ProtectionAction, EmbedColors, SlashCommand } from '../../types';

export const data = new SlashCommandBuilder()
  .setName('setlimit')
  .setDescription('Configure action limits for anti-nuke protection')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('The action to set limit for')
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
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('Maximum allowed count (0 for strict/none allowed)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .addStringOption(option =>
    option
      .setName('window_time')
      .setDescription('Time window (e.g., 10s, 1m, 1h). Default: 10s')
      .setRequired(false)
  );

export const slashCommand: SlashCommand = {
  data: data,
  execute: execute,
  category: 'antinuke',
  syntax: '/setlimit <action> <limit> [window_time]',
  permission: 'Administrator',
  example: '/setlimit action:ban_members limit:3 window_time:1m'
};

import { parseDuration, formatDurationVerbose } from '../../utils/time';
import { checkCommandPermission } from '../../utils/permissionHelpers';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { configService: ConfigService }
): Promise<void> {
  // Permission Check: Role > Bot
  if (!await checkCommandPermission(interaction, { ownerOnly: false })) return;

  await interaction.deferReply();

  const action = interaction.options.getString('action', true) as ProtectionAction;
  const limit = interaction.options.getInteger('limit', true);
  const windowInput = interaction.options.getString('window_time') || '10s';
  const windowSeconds = parseDuration(windowInput);

  if (windowSeconds === null || windowSeconds <= 0) {
    await interaction.editReply({
      content: '❌ Invalid time format. Please use formats like `10s`, `1m`, `1h`.',
    });
    return;
  }

  const windowMs = windowSeconds * 1000;
  const guildId = interaction.guildId!;

  // Validate that anti-nuke is enabled
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
        `The limit will be saved, but won't take effect until you enable this protection with \`/antinuke enable\`.`
      )
      .setColor(EmbedColors.WARNING);

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  }

  // Warn about very short windows (only if limit > 0)
  if (limit > 0 && windowSeconds < 5) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Short Time Window')
      .setDescription(
        `You're setting a very short time window (${formatDurationVerbose(windowSeconds)}). This may cause false positives for legitimate actions.`
      )
      .setColor(EmbedColors.WARNING);

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  }

  // Set the limit
  await services.configService.setLimit(guildId, action, limit, windowMs);

  // Determine effect string
  let effectString = '';
  if (limit === 0) {
    effectString = `**Strict Mode:** Users are **not allowed** to ${formatActionName(action).toLowerCase()}. Any attempt will trigger the punishment immediately.`;
  } else {
    effectString = `Users performing more than **${limit}** ${formatActionName(action).toLowerCase()} within **${formatDurationVerbose(windowSeconds)}** will trigger the configured punishment.`;
  }

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('<:tcet_tick:1437995479567962184> Limit Set')
    .setDescription(`Action limit has been configured successfully.`)
    .setColor(EmbedColors.SUCCESS)
    .addFields(
      { name: 'Action', value: formatActionName(action), inline: true },
      { name: 'Limit', value: limit === 0 ? '**0 (Strict)**' : `${limit} actions`, inline: true },
      { name: 'Window', value: formatDurationVerbose(windowSeconds), inline: true },
      {
        name: 'Effect',
        value: effectString,
        inline: false,
      }
    )
    .setFooter({
      text: `Configured by ${interaction.user.tag} (${interaction.user.id})`,
    })
    .setTimestamp();

  // Add warning for high window time (only if limit > 0)
  if (limit > 0 && windowSeconds > 60) {
    embed.addFields({
      name: '⚠️ Recommendation',
      value: 'We do not recommend setting the window time higher than **60 seconds** as it may affect the effectiveness of the anti-nuke.',
      inline: false,
    });
  }

  // Special recommendation for dangerous actions if limit > 0
  const dangerousActions = [ProtectionAction.ADD_BOTS, ProtectionAction.GIVE_ADMIN_ROLE];
  if (dangerousActions.includes(action) && limit > 0) {
    embed.addFields({
      name: '⚠️ Security Recommendation',
      value: `For **${formatActionName(action)}**, we strongly recommend setting the limit to **0** to prevent any unauthorized access.`,
      inline: false,
    });
  }

  // Check if punishment is configured
  const punishment = await services.configService.getPunishment(guildId, action);
  if (!punishment) {
    embed.addFields({
      name: '⚠️ Next Step',
      value: `Set a punishment for this action using \`/setpunishment ${action}\``,
      inline: false,
    });
  } else {
    embed.addFields({
      name: 'Current Punishment',
      value: `**${punishment.punishment.toUpperCase()}**${punishment.durationSeconds ? ` for ${punishment.durationSeconds}s` : ''
        }`,
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
