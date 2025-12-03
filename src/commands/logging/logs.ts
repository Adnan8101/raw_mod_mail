/**
 * Logs Command - Configure logging channels
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { LoggingService } from '../../services/LoggingService';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { createErrorEmbed, createSuccessEmbed, createInfoEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('logs')
  .setDescription('Configure logging channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('mod')
      .setDescription('Set moderation log channel')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel for moderation logs')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('security')
      .setDescription('Set security log channel')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel for security/anti-nuke logs')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View current logging configuration')
  );

export const category = 'logging';
export const syntax = '!logs <mod|security|view> [channel]';
export const example = '!logs mod #mod-logs';
export const permission = 'Manage Guild';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  switch (subcommand) {
    case 'mod':
      await handleModChannel(interaction, services, guildId);
      break;
    case 'security':
      await handleSecurityChannel(interaction, services, guildId);
      break;
    case 'view':
      await handleView(interaction, services, guildId);
      break;
  }
}

async function handleModChannel(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService },
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const channel = interaction.options.getChannel('channel', true);

  if (channel.type !== ChannelType.GuildText) {
    const errorEmbed = createErrorEmbed('Please select a text channel.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const textChannel = channel as TextChannel;

  // Check bot permissions in the channel
  const botMember = interaction.guild!.members.me!;
  const permissions = textChannel.permissionsFor(botMember);

  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    const errorEmbed = createErrorEmbed(`I don't have permission to send messages in ${channel}.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  if (!permissions?.has(PermissionFlagsBits.EmbedLinks)) {
    const errorEmbed = createErrorEmbed(`I need the **Embed Links** permission in ${channel}.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Set the channel
  await services.loggingService.setModChannel(guildId, channel.id);

  // Send test message
  const testEmbed = createSuccessEmbed('Moderation Logs Configured')
    .setTitle(`${CustomEmojis.TICK} Moderation Logs Configured`)
    .setDescription('This channel will now receive moderation action logs.')
    .setTimestamp();

  try {
    await textChannel.send({ embeds: [testEmbed] });
  } catch (error) {
    console.error('Failed to send test message:', error);
    const errorEmbed = createErrorEmbed('Channel configured but failed to send test message. Please check permissions.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Success response
  const embed = createSuccessEmbed('Mod Logs Configured')
    .setTitle(`${CustomEmojis.TICK} Mod Logs Configured`)
    .setDescription(`Moderation logs will be sent to ${channel}`)
    .setFooter({
      text: `Configured by ${interaction.user.tag}`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSecurityChannel(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService },
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const channel = interaction.options.getChannel('channel', true);

  if (channel.type !== ChannelType.GuildText) {
    const errorEmbed = createErrorEmbed('Please select a text channel.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const textChannel = channel as TextChannel;

  // Check bot permissions in the channel
  const botMember = interaction.guild!.members.me!;
  const permissions = textChannel.permissionsFor(botMember);

  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    const errorEmbed = createErrorEmbed(`I don't have permission to send messages in ${channel}.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  if (!permissions?.has(PermissionFlagsBits.EmbedLinks)) {
    const errorEmbed = createErrorEmbed(`I need the **Embed Links** permission in ${channel}.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Set the channel
  await services.loggingService.setSecurityChannel(guildId, channel.id);

  // Send test message
  const testEmbed = createSuccessEmbed('Security Logs Configured')
    .setTitle(`${CustomEmojis.TICK} Security Logs Configured`)
    .setDescription('This channel will now receive anti-nuke and security event logs.')
    .setColor(EmbedColors.SECURITY)
    .setTimestamp();

  try {
    await textChannel.send({ embeds: [testEmbed] });
  } catch (error) {
    console.error('Failed to send test message:', error);
    const errorEmbed = createErrorEmbed('Channel configured but failed to send test message. Please check permissions.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Success response
  const embed = createSuccessEmbed('Security Logs Configured')
    .setTitle(`${CustomEmojis.TICK} Security Logs Configured`)
    .setDescription(`Security logs will be sent to ${channel}`)
    .setFooter({
      text: `Configured by ${interaction.user.tag}`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleView(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService },
  guildId: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const config = await services.loggingService.getConfig(guildId);

  const embed = createInfoEmbed('📋 Logging Configuration', '')
    .setTimestamp();

  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (config.modChannel) {
    fields.push({
      name: 'Moderation Logs',
      value: `<#${config.modChannel}>`,
      inline: true,
    });
  } else {
    fields.push({
      name: 'Moderation Logs',
      value: 'Not configured',
      inline: true,
    });
  }

  if (config.securityChannel) {
    fields.push({
      name: 'Security Logs',
      value: `<#${config.securityChannel}>`,
      inline: true,
    });
  } else {
    fields.push({
      name: 'Security Logs',
      value: 'Not configured',
      inline: true,
    });
  }

  if (!config.modChannel && !config.securityChannel) {
    embed.setDescription('No logging channels have been configured yet.');
    fields.push({
      name: 'Setup Commands',
      value: '• `/logs mod` - Configure moderation logs\n• `/logs security` - Configure security logs',
      inline: false,
    });
  }

  embed.addFields(fields);

  await interaction.editReply({ embeds: [embed] });
}
