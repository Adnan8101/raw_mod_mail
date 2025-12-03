/**
 * Logging Command - Configure audit log monitoring
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  AuditLogEvent,
  Events,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { createErrorEmbed, createSuccessEmbed, createInfoEmbed } from '../../utils/embedHelpers';

interface LoggingServices {
  prisma: any;
}

export const data = new SlashCommandBuilder()
  .setName('logging')
  .setDescription('Configure server logging')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub
      .setName('enable')
      .setDescription('Enable logging to a channel')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Channel to send logs to')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('disable')
      .setDescription('Disable server logging')
  )
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('View current logging configuration')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { prisma: any }
) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'enable') {
    await handleEnable(interaction, services.prisma);
  } else if (subcommand === 'disable') {
    await handleDisable(interaction, services.prisma);
  } else if (subcommand === 'status') {
    await handleStatus(interaction, services.prisma);
  }
}

async function handleEnable(interaction: ChatInputCommandInteraction, prisma: any) {
  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  const guildId = interaction.guild!.id;

  // Verify it's a text channel
  if (!channel.isTextBased()) {
    const errorEmbed = createErrorEmbed('Please select a text channel for logging.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  // Check bot permissions in that channel
  const permissions = channel.permissionsFor(interaction.guild!.members.me!);
  if (!permissions?.has(PermissionFlagsBits.SendMessages) || !permissions?.has(PermissionFlagsBits.EmbedLinks)) {
    const errorEmbed = createErrorEmbed(`I need **Send Messages** and **Embed Links** permissions in ${channel}!`);
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  // Save to database
  await prisma.loggingConfig.upsert({
    where: { guildId },
    create: {
      guildId,
      channelId: channel.id,
      enabled: true,
    },
    update: {
      channelId: channel.id,
      enabled: true,
    },
  });

  const embed = createSuccessEmbed('Logging Enabled')
    .setTitle(`${CustomEmojis.TICK} Logging Enabled`)
    .setDescription(
      `Server logging has been enabled!\n\n` +
      `${CustomEmojis.LOGGING} **Log Channel:** ${channel}\n\n` +
      `**Events Logged:**\n` +
      `${CustomEmojis.ADMIN} Role Create/Edit/Delete\n` +
      `${CustomEmojis.CHANNEL} Channel Create/Edit/Delete\n` +
      `${CustomEmojis.FILES} Message Edit/Delete (with attachments)`
    )
    .setFooter({ text: `Enabled by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  // Send test message to log channel
  const testEmbed = createInfoEmbed(`${CustomEmojis.LOGGING} Logging System Activated`, `Server logging has been enabled by ${interaction.user}.\n\nThis channel will receive audit log events.`)
    .setTimestamp();

  await channel.send({ embeds: [testEmbed] });
}

async function handleDisable(interaction: ChatInputCommandInteraction, prisma: any) {
  const guildId = interaction.guild!.id;

  await prisma.loggingConfig.updateMany({
    where: { guildId },
    data: { enabled: false },
  });

  const embed = createSuccessEmbed('Server logging has been disabled.');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleStatus(interaction: ChatInputCommandInteraction, prisma: any) {
  const guildId = interaction.guild!.id;

  const config = await prisma.loggingConfig.findUnique({
    where: { guildId },
  });

  if (!config || !config.enabled) {
    const embed = createErrorEmbed('Server logging is currently disabled.\n\nUse `/logging enable` to enable it.');
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const channel = interaction.guild!.channels.cache.get(config.channelId!);

  const embed = createInfoEmbed(`${CustomEmojis.LOGGING} Logging Configuration`,
    `${CustomEmojis.TICK} **Status:** Enabled\n` +
    `${CustomEmojis.CHANNEL} **Log Channel:** ${channel || 'Unknown (deleted?)'}\n\n` +
    `**Active Events:**\n` +
    `${config.logRoleCreate ? CustomEmojis.TICK : CustomEmojis.CROSS} Role Create\n` +
    `${config.logRoleEdit ? CustomEmojis.TICK : CustomEmojis.CROSS} Role Edit\n` +
    `${config.logRoleDelete ? CustomEmojis.TICK : CustomEmojis.CROSS} Role Delete\n` +
    `${config.logChannelCreate ? CustomEmojis.TICK : CustomEmojis.CROSS} Channel Create\n` +
    `${config.logChannelEdit ? CustomEmojis.TICK : CustomEmojis.CROSS} Channel Edit\n` +
    `${config.logChannelDelete ? CustomEmojis.TICK : CustomEmojis.CROSS} Channel Delete\n` +
    `${config.logMessageEdit ? CustomEmojis.TICK : CustomEmojis.CROSS} Message Edit\n` +
    `${config.logMessageDelete ? CustomEmojis.TICK : CustomEmojis.CROSS} Message Delete`
  )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
