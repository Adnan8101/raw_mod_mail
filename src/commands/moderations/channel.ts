/**
 * Channel Moderation Commands - Lock, unlock, hide, unhide, slowmode
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
  PermissionsBitField,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { parseDuration, formatDuration } from '../../utils/moderation';
import { LoggingService } from '../../services/LoggingService';
import { createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('channel')
  .setDescription('Channel moderation commands')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(subcommand =>
    subcommand
      .setName('lock')
      .setDescription('Lock a channel (prevent @everyone from sending messages)')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel to lock (defaults to current)')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for locking')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unlock')
      .setDescription('Unlock a channel')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel to unlock (defaults to current)')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for unlocking')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('hide')
      .setDescription('Hide a channel from @everyone')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel to hide (defaults to current)')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for hiding')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unhide')
      .setDescription('Unhide a channel')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel to unhide (defaults to current)')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for unhiding')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('slowmode')
      .setDescription('Set channel slowmode')
      .addStringOption(option =>
        option
          .setName('duration')
          .setDescription('Slowmode duration (e.g. 5s, 1m, 1h)')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel to set slowmode (defaults to current)')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for slowmode')
          .setRequired(false)
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'lock':
      await handleLock(interaction, services);
      break;
    case 'unlock':
      await handleUnlock(interaction, services);
      break;
    case 'hide':
      await handleHide(interaction, services);
      break;
    case 'unhide':
      await handleUnhide(interaction, services);
      break;
    case 'slowmode':
      await handleSlowmode(interaction, services);
      break;
  }
}

async function handleLock(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const channel =
    (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;

  try {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: false,
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CustomEmojis.TICK} Channel Locked`)
      .setDescription(`${channel} has been locked.`)
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Send notification in channel
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${CustomEmojis.CAUTION} This channel has been locked by ${interaction.user}.`)
          .setColor(EmbedColors.WARNING),
      ],
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to lock channel: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleUnlock(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const channel =
    (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;

  try {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: null,
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CustomEmojis.TICK} Channel Unlocked`)
      .setDescription(`${channel} has been unlocked.`)
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Send notification in channel
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${CustomEmojis.TICK} This channel has been unlocked by ${interaction.user}.`)
          .setColor(EmbedColors.SUCCESS),
      ],
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to unlock channel: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleHide(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const channel =
    (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;

  try {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: false,
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CustomEmojis.TICK} Channel Hidden`)
      .setDescription(`${channel} has been hidden from @everyone.`)
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to hide channel: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleUnhide(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const channel =
    (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const guild = interaction.guild!;

  try {
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: null,
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CustomEmojis.TICK} Channel Unhidden`)
      .setDescription(`${channel} is now visible to @everyone.`)
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to unhide channel: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSlowmode(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  await interaction.deferReply();

  const durationStr = interaction.options.getString('duration', true);
  const channel =
    (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  // Parse duration
  let duration: number;
  if (durationStr === '0' || durationStr === '0s') {
    duration = 0;
  } else {
    const parsed = parseDuration(durationStr);
    if (!parsed) {
      const errorEmbed = createErrorEmbed('Invalid duration format. Use formats like: 5s, 10s, 1m or 0 to disable');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
    duration = Math.floor(parsed / 1000); // Convert to seconds
  }

  // Max 6 hours (21600 seconds)
  if (duration > 21600) {
    const errorEmbed = createErrorEmbed('Slowmode duration cannot exceed 6 hours.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  try {
    await channel.setRateLimitPerUser(duration, reason);

    const embed = new EmbedBuilder()
      .setTitle(duration === 0 ? `${CustomEmojis.TICK} Slowmode Disabled` : `${CustomEmojis.TICK} Slowmode Enabled`)
      .setDescription(
        duration === 0
          ? `Slowmode has been disabled in ${channel}.`
          : `Slowmode set to ${formatDuration(duration * 1000)} in ${channel}.`
      )
      .setColor(EmbedColors.SUCCESS)
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: 'Duration', value: duration === 0 ? 'Disabled' : formatDuration(duration * 1000), inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to set slowmode: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
