/**
 * AutoMod Command - Simple and Clean System
 * Quick setup with sensible defaults
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { EmbedColors, SlashCommand } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { AutoModService } from '../../services/AutoModService';
import { createErrorEmbed, createSuccessEmbed, createInfoEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Configure server automod system')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

  // Setup command
  .addSubcommand(sub =>
    sub
      .setName('setup')
      .setDescription('Quick setup automod with default settings')
  )

  // View command
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View current automod configuration')
  )

  // Enable command
  .addSubcommand(sub =>
    sub
      .setName('enable')
      .setDescription('Enable automod feature')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Feature to enable')
          .setRequired(true)
          .addChoices(
            { name: 'Anti-Spam', value: 'anti_spam' },
            { name: 'Mass Mention', value: 'mass_mention' },
            { name: 'Server Invite', value: 'server_invite' },
            { name: 'Anti-Link', value: 'anti_link' },
            { name: 'All Features', value: 'all' }
          )
      )
      .addStringOption(option =>
        option
          .setName('punishment')
          .setDescription('Punishment type (optional, default: timeout)')
          .addChoices(
            { name: 'Timeout', value: 'timeout' },
            { name: 'Kick', value: 'kick' },
            { name: 'Ban', value: 'ban' }
          )
      )
      .addStringOption(option =>
        option
          .setName('action_type')
          .setDescription('Action type (optional, default: delete & warn)')
          .addChoices(
            { name: 'Delete Message', value: 'delete' },
            { name: 'Warn User', value: 'warn' },
            { name: 'Delete & Warn', value: 'delete_warn' }
          )
      )
  )

  // Disable command
  .addSubcommand(sub =>
    sub
      .setName('disable')
      .setDescription('Disable automod feature')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Feature to disable')
          .setRequired(true)
          .addChoices(
            { name: 'Anti-Spam', value: 'anti_spam' },
            { name: 'Mass Mention', value: 'mass_mention' },
            { name: 'Server Invite', value: 'server_invite' },
            { name: 'Anti-Link', value: 'anti_link' },
            { name: 'All Features', value: 'all' }
          )
      )
  )

  // Anti-spam limit command
  .addSubcommandGroup(group =>
    group
      .setName('anti-spam')
      .setDescription('Configure anti-spam')
      .addSubcommand(sub =>
        sub
          .setName('limit')
          .setDescription('Set anti-spam limits')
          .addIntegerOption(option =>
            option
              .setName('message')
              .setDescription('Max messages allowed')
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(20)
          )
          .addStringOption(option =>
            option
              .setName('threshold_time')
              .setDescription('Time threshold (e.g., 5s, 10s, 1m)')
              .setRequired(true)
          )
      )
  )

  // Mass mention limit command
  .addSubcommandGroup(group =>
    group
      .setName('mass-mention')
      .setDescription('Configure mass mention')
      .addSubcommand(sub =>
        sub
          .setName('limit')
          .setDescription('Set mass mention limit')
          .addIntegerOption(option =>
            option
              .setName('mentions_allowed')
              .setDescription('Max mentions allowed per message')
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(20)
          )
      )
  );

export const slashCommand: SlashCommand = {
  data: data,
  execute: execute,
  category: 'automod',
  syntax: '/automod <setup|view|enable|disable|anti-spam|mass-mention>',
  permission: 'Manage Server',
  example: '/automod setup'
};

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { autoModService: AutoModService }
) {
  const { autoModService } = services;
  const guildId = interaction.guild!.id;

  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  try {
    // Root commands
    if (!subcommandGroup) {
      if (subcommand === 'setup') {
        await handleSetup(interaction, autoModService);
      } else if (subcommand === 'view') {
        await handleView(interaction, autoModService);
      } else if (subcommand === 'enable') {
        await handleEnable(interaction, autoModService);
      } else if (subcommand === 'disable') {
        await handleDisable(interaction, autoModService);
      }
      return;
    }

    // Subcommand groups
    if (subcommandGroup === 'anti-spam') {
      if (subcommand === 'limit') {
        await handleAntiSpamLimit(interaction, autoModService);
      }
    } else if (subcommandGroup === 'mass-mention') {
      if (subcommand === 'limit') {
        await handleMassMentionLimit(interaction, autoModService);
      }
    }
  } catch (error) {
    console.error('AutoMod command error:', error);
    const errorEmbed = createErrorEmbed(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
}

import { checkCommandPermission } from '../../utils/permissionHelpers';

// ============================================================================
// SETUP COMMAND - Shows button to enable all with defaults
// ============================================================================

async function handleSetup(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService
) {
  // Permission Check: Role > Bot
  if (!await checkCommandPermission(interaction, { ownerOnly: false })) return;

  const guildId = interaction.guild!.id;

  const embed = createInfoEmbed(
    `${CustomEmojis.SETTING} AutoMod Setup`,
    '**All AutoMod features are currently disabled**\n\n' +
    'Click the button below to enable all features with default settings:\n\n' +
    '**Default Settings:**\n' +
    `${CustomEmojis.CAUTION} **Anti-Spam:** 3 messages in 5 seconds\n` +
    `${CustomEmojis.USER} **Mass Mention:** 3 mentions per message\n` +
    `${CustomEmojis.CHANNEL} **Server Invite:** Block Discord invites\n` +
    `${CustomEmojis.FILES} **Anti-Link:** Block external links\n\n` +
    '**Action:** Delete & Warn\n' +
    '**Punishment:** 10 minute timeout'
  ).setFooter({ text: 'Click "Apply Default Settings" to enable all features' });

  const button = new ButtonBuilder()
    .setCustomId(`automod_apply_defaults_${interaction.user.id}`)
    .setLabel('Apply Default Settings')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    fetchReply: true,
  });

  // Wait for button click
  try {
    const confirmation = await response.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: 60000,
    });

    await confirmation.deferUpdate();

    // Enable all features with defaults
    const features = ['anti_spam', 'mass_mention', 'server_invite', 'anti_link'];

    for (const feature of features) {
      const config: any = {
        enabled: true,
        actionType: 'delete_warn',
        punishmentType: 'timeout',
      };

      if (feature === 'anti_spam') {
        config.maxMessages = 3;
        config.timeSpanMs = 5000; // 5 seconds
        config.maxLines = 10;
      } else if (feature === 'mass_mention') {
        config.maxMentions = 3;
      }

      await autoModService.upsertConfig(guildId, feature, config);
    }

    // Update embed with success
    const successEmbed = createSuccessEmbed('AutoMod Enabled Successfully!')
      .setTitle(`${CustomEmojis.TICK} AutoMod Enabled Successfully!`)
      .setDescription(
        '**All features have been enabled with default settings:**\n\n' +
        `${CustomEmojis.TICK} **Anti-Spam:** 3 messages in 5 seconds\n` +
        `${CustomEmojis.TICK} **Mass Mention:** 3 mentions per message\n` +
        `${CustomEmojis.TICK} **Server Invite:** Blocking Discord invites\n` +
        `${CustomEmojis.TICK} **Anti-Link:** Blocking external links\n\n` +
        '**Action:** Delete & Warn\n' +
        '**Punishment:** 10 minute timeout\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '**Start editing with these commands:**\n' +
        '• `/automod view` - View current settings\n' +
        '• `/automod enable action:<feature>` - Enable specific feature\n' +
        '• `/automod disable action:<feature>` - Disable specific feature\n' +
        '• `/automod anti-spam limit` - Adjust spam limits\n' +
        '• `/automod mass-mention limit` - Adjust mention limits'
      )
      .setFooter({ text: 'AutoMod is now protecting your server!' });

    await confirmation.editReply({
      embeds: [successEmbed],
      components: [],
    });
  } catch (error) {
    const timeoutEmbed = createErrorEmbed('Setup timed out. Please try again.');

    await interaction.editReply({
      embeds: [timeoutEmbed],
      components: [],
    });
  }
}

// ============================================================================
// VIEW COMMAND
// ============================================================================

async function handleView(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService
) {
  const guildId = interaction.guild!.id;

  const [antiSpam, massMention, serverInvite, antiLink] = await Promise.all([
    autoModService.getConfig(guildId, 'anti_spam'),
    autoModService.getConfig(guildId, 'mass_mention'),
    autoModService.getConfig(guildId, 'server_invite'),
    autoModService.getConfig(guildId, 'anti_link'),
  ]);

  const embed = createInfoEmbed(`${CustomEmojis.SETTING} AutoMod Configuration`, 'Current automod settings for this server')
    .addFields(
      {
        name: `${CustomEmojis.CAUTION} Anti-Spam`,
        value: antiSpam?.enabled
          ? `${CustomEmojis.TICK} **Enabled**\n` +
          `Max Messages: ${antiSpam.maxMessages || 3}\n` +
          `Time Span: ${(antiSpam.timeSpanMs || 5000) / 1000}s\n` +
          `Action: ${antiSpam.actionType || 'delete_warn'}\n` +
          `Punishment: ${antiSpam.punishmentType || 'timeout'}`
          : `${CustomEmojis.CROSS} **Disabled**`,
        inline: false,
      },
      {
        name: `${CustomEmojis.USER} Mass Mention`,
        value: massMention?.enabled
          ? `${CustomEmojis.TICK} **Enabled**\n` +
          `Max Mentions: ${massMention.maxMentions || 3}\n` +
          `Action: ${massMention.actionType || 'delete_warn'}\n` +
          `Punishment: ${massMention.punishmentType || 'timeout'}`
          : `${CustomEmojis.CROSS} **Disabled**`,
        inline: false,
      },
      {
        name: `${CustomEmojis.CHANNEL} Server Invite`,
        value: serverInvite?.enabled
          ? `${CustomEmojis.TICK} **Enabled**\n` +
          `Action: ${serverInvite.actionType || 'delete_warn'}\n` +
          `Punishment: ${serverInvite.punishmentType || 'timeout'}`
          : `${CustomEmojis.CROSS} **Disabled**`,
        inline: false,
      },
      {
        name: `${CustomEmojis.FILES} Anti-Link`,
        value: antiLink?.enabled
          ? `${CustomEmojis.TICK} **Enabled**\n` +
          `Action: ${antiLink.actionType || 'delete_warn'}\n` +
          `Punishment: ${antiLink.punishmentType || 'timeout'}`
          : `${CustomEmojis.CROSS} **Disabled**`,
        inline: false,
      }
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================================================
// ENABLE COMMAND
// ============================================================================

async function handleEnable(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService
) {
  // Permission Check: Owner Only
  if (!await checkCommandPermission(interaction, { ownerOnly: true })) return;

  const guildId = interaction.guild!.id;
  const action = interaction.options.getString('action', true);
  const punishment = interaction.options.getString('punishment') || 'timeout';
  const actionType = interaction.options.getString('action_type') || 'delete_warn';

  // If timeout is selected, show modal to get duration
  if (punishment === 'timeout') {
    const modal = new ModalBuilder()
      .setCustomId(`timeout_duration_${interaction.user.id}`)
      .setTitle('Set Timeout Duration');

    const timeInput = new TextInputBuilder()
      .setCustomId('timeout_time')
      .setLabel('Timeout Duration (e.g., 10s, 5m, 1h, 1d)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('10m')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput));

    await interaction.showModal(modal);

    // Wait for modal submit
    const modalSubmit = await interaction.awaitModalSubmit({ time: 60000 }).catch(() => null);
    if (!modalSubmit) return;

    const timeoutDuration = modalSubmit.fields.getTextInputValue('timeout_time');
    const timeMs = parseTimeToMs(timeoutDuration);

    if (timeMs === null) {
      const embed = createErrorEmbed(
        'Invalid time format!\n\n' +
        'Valid formats: `10s`, `5m`, `1h`, `1d`, etc.'
      );
      await modalSubmit.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    await modalSubmit.deferReply({ flags: MessageFlags.Ephemeral });

    const features = action === 'all'
      ? ['anti_spam', 'mass_mention', 'server_invite', 'anti_link']
      : [action];

    for (const feature of features) {
      const config: any = {
        enabled: true,
        actionType,
        punishmentType: punishment,
        punishmentDuration: Math.floor(timeMs / 1000), // Convert ms to seconds
      };

      // Set defaults for specific features
      if (feature === 'anti_spam') {
        const existing = await autoModService.getConfig(guildId, feature);
        config.maxMessages = existing?.maxMessages || 3;
        config.timeSpanMs = existing?.timeSpanMs || 5000;
        config.maxLines = existing?.maxLines || 10;
      } else if (feature === 'mass_mention') {
        const existing = await autoModService.getConfig(guildId, feature);
        config.maxMentions = existing?.maxMentions || 3;
      }

      await autoModService.upsertConfig(guildId, feature, config);
    }

    const featureNames: any = {
      anti_spam: 'Anti-Spam',
      mass_mention: 'Mass Mention',
      server_invite: 'Server Invite',
      anti_link: 'Anti-Link',
    };

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.SUCCESS)
      .setTitle(`${CustomEmojis.TICK} Feature Enabled`)
      .setDescription(
        action === 'all'
          ? '**All features have been enabled!**\n\n' +
          `${CustomEmojis.TICK} Anti-Spam\n` +
          `${CustomEmojis.TICK} Mass Mention\n` +
          `${CustomEmojis.TICK} Server Invite\n` +
          `${CustomEmojis.TICK} Anti-Link`
          : `**${featureNames[action]} has been enabled!**`
      )
      .addFields(
        { name: 'Action', value: actionType.replace('_', ' & '), inline: true },
        { name: 'Punishment', value: `Timeout ${timeoutDuration}`, inline: true }
      );

    if (action === 'anti_spam') {
      embed.addFields({
        name: 'Default Settings',
        value: 'Anti-Spam: 3 messages in 5 seconds',
        inline: false,
      });
      embed.setFooter({ text: '💡 Tip: Use /automod anti-spam limit to adjust spam detection limits' });
    } else if (action === 'mass_mention') {
      embed.addFields({
        name: 'Default Settings',
        value: 'Mass Mention: 3 mentions per message',
        inline: false,
      });
      embed.setFooter({ text: '💡 Tip: Use /automod mass-mention limit to adjust maximum mentions allowed' });
    } else if (action === 'all') {
      embed.addFields({
        name: 'Default Settings',
        value: 'Anti-Spam: 3 messages in 5 seconds\nMass Mention: 3 mentions per message',
        inline: false,
      });
      embed.setFooter({ text: '💡 Tip: Use dedicated limit commands to customize detection thresholds' });
    }

    await modalSubmit.editReply({ embeds: [embed] });
  } else {
    // No timeout, proceed normally
    const features = action === 'all'
      ? ['anti_spam', 'mass_mention', 'server_invite', 'anti_link']
      : [action];

    for (const feature of features) {
      const config: any = {
        enabled: true,
        actionType,
        punishmentType: punishment,
      };

      // Set defaults for specific features
      if (feature === 'anti_spam') {
        const existing = await autoModService.getConfig(guildId, feature);
        config.maxMessages = existing?.maxMessages || 3;
        config.timeSpanMs = existing?.timeSpanMs || 5000;
        config.maxLines = existing?.maxLines || 10;
      } else if (feature === 'mass_mention') {
        const existing = await autoModService.getConfig(guildId, feature);
        config.maxMentions = existing?.maxMentions || 3;
      }

      await autoModService.upsertConfig(guildId, feature, config);
    }

    const featureNames: any = {
      anti_spam: 'Anti-Spam',
      mass_mention: 'Mass Mention',
      server_invite: 'Server Invite',
      anti_link: 'Anti-Link',
    };

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.SUCCESS)
      .setTitle(`${CustomEmojis.TICK} Feature Enabled`)
      .setDescription(
        action === 'all'
          ? '**All features have been enabled!**\n\n' +
          `${CustomEmojis.TICK} Anti-Spam\n` +
          `${CustomEmojis.TICK} Mass Mention\n` +
          `${CustomEmojis.TICK} Server Invite\n` +
          `${CustomEmojis.TICK} Anti-Link`
          : `**${featureNames[action]} has been enabled!**`
      )
      .addFields(
        { name: 'Action', value: actionType.replace('_', ' & '), inline: true },
        { name: 'Punishment', value: punishment, inline: true }
      );

    if (action === 'anti_spam') {
      embed.addFields({
        name: 'Default Settings',
        value: 'Anti-Spam: 3 messages in 5 seconds',
        inline: false,
      });
      embed.setFooter({ text: '💡 Tip: Use /automod anti-spam limit to adjust spam detection limits' });
    } else if (action === 'mass_mention') {
      embed.addFields({
        name: 'Default Settings',
        value: 'Mass Mention: 3 mentions per message',
        inline: false,
      });
      embed.setFooter({ text: '💡 Tip: Use /automod mass-mention limit to adjust maximum mentions allowed' });
    } else if (action === 'all') {
      embed.addFields({
        name: 'Default Settings',
        value: 'Anti-Spam: 3 messages in 5 seconds\nMass Mention: 3 mentions per message',
        inline: false,
      });
      embed.setFooter({ text: '💡 Tip: Use dedicated limit commands to customize detection thresholds' });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

// ============================================================================
// DISABLE COMMAND
// ============================================================================

async function handleDisable(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService
) {
  // Permission Check: Owner Only
  if (!await checkCommandPermission(interaction, { ownerOnly: true })) return;

  const guildId = interaction.guild!.id;
  const action = interaction.options.getString('action', true);

  const features = action === 'all'
    ? ['anti_spam', 'mass_mention', 'server_invite', 'anti_link']
    : [action];

  for (const feature of features) {
    await autoModService.upsertConfig(guildId, feature, { enabled: false });
  }

  const featureNames: any = {
    anti_spam: 'Anti-Spam',
    mass_mention: 'Mass Mention',
    server_invite: 'Server Invite',
    anti_link: 'Anti-Link',
  };

  const embed = createErrorEmbed(
    action === 'all'
      ? '**All automod features have been disabled!**'
      : `**${featureNames[action]} has been disabled!**`
  );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================================================
// ANTI-SPAM LIMIT COMMAND
// ============================================================================

async function handleAntiSpamLimit(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService
) {
  // Permission Check: Role > Bot
  if (!await checkCommandPermission(interaction, { ownerOnly: false })) return;

  const guildId = interaction.guild!.id;
  const maxMessages = interaction.options.getInteger('message', true);
  const thresholdTime = interaction.options.getString('threshold_time', true);

  // Parse time string (e.g., "5s", "10s", "1m")
  const timeMs = parseTimeToMs(thresholdTime);

  if (timeMs === null) {
    const embed = createErrorEmbed(
      'Invalid time format!\n\n' +
      'Valid formats: `5s`, `10s`, `1m`, `30s`, etc.'
    );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  await autoModService.upsertConfig(guildId, 'anti_spam', {
    maxMessages,
    timeSpanMs: timeMs,
  });

  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setTitle(`${CustomEmojis.TICK} Anti-Spam Limit Updated`)
    .setDescription(
      `**New Settings:**\n` +
      `Max Messages: ${maxMessages}\n` +
      `Time Threshold: ${thresholdTime} (${timeMs / 1000}s)`
    )
    .setFooter({ text: 'Make sure anti-spam is enabled with /automod enable' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================================================
// MASS MENTION LIMIT COMMAND
// ============================================================================

async function handleMassMentionLimit(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService
) {
  // Permission Check: Role > Bot
  if (!await checkCommandPermission(interaction, { ownerOnly: false })) return;

  const guildId = interaction.guild!.id;
  const mentionsAllowed = interaction.options.getInteger('mentions_allowed', true);

  await autoModService.upsertConfig(guildId, 'mass_mention', {
    maxMentions: mentionsAllowed,
  });

  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setTitle(`${CustomEmojis.TICK} Mass Mention Limit Updated`)
    .setDescription(
      `**New Setting:**\n` +
      `Maximum mentions per message: ${mentionsAllowed}`
    )
    .setFooter({ text: 'Make sure mass-mention is enabled with /automod enable' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function parseTimeToMs(time: string): number | null {
  const match = time.match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}
