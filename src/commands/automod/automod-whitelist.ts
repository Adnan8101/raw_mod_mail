/**
 * AutoMod Whitelist Command - Manage automod whitelist for users, roles, and channels
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { AutoModService } from '../../services/AutoModService';
import { EmbedColors, SlashCommand } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { createErrorEmbed, createSuccessEmbed, createInfoEmbed } from '../../utils/embedHelpers';

// AutoMod action types
const AUTOMOD_ACTIONS = [
  { name: 'Anti-Spam', value: 'anti_spam' },
  { name: 'Mass Mention', value: 'mass_mention' },
  { name: 'Server Invite', value: 'server_invite' },
  { name: 'Anti-Link', value: 'anti_link' },
  { name: 'Global (All Features)', value: 'global' },
];

export const data = new SlashCommandBuilder()
  .setName('automod-whitelist')
  .setDescription('Manage AutoMod whitelist for users, roles, and channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('Add a user, role, or channel to automod whitelist')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('AutoMod feature to whitelist for')
          .setRequired(true)
          .addChoices(...AUTOMOD_ACTIONS)
      )
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to whitelist')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role to whitelist')
          .setRequired(false)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel to whitelist')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('remove')
      .setDescription('Remove a user, role, or channel from automod whitelist')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('AutoMod feature to remove from')
          .setRequired(true)
          .addChoices(...AUTOMOD_ACTIONS)
      )
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to remove')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role to remove')
          .setRequired(false)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel to remove')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View automod whitelist entries')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('AutoMod feature to view (optional - shows all if not specified)')
          .setRequired(false)
          .addChoices(...AUTOMOD_ACTIONS)
      )
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Specific user to check')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Specific role to check')
          .setRequired(false)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Specific channel to check')
          .setRequired(false)
      )
  );

export const slashCommand: SlashCommand = {
  data: data,
  execute: execute,
  category: 'automod',
  syntax: '/automod-whitelist <add|remove|view>',
  permission: 'Manage Server',
  example: '/automod-whitelist add action:anti_spam user:@Adityaa'
};

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { autoModService: AutoModService }
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  // Permission Check: Owner OR Role > Bot
  const member = interaction.member as import('discord.js').GuildMember;
  const botMember = interaction.guild!.members.me!;

  if (interaction.user.id !== interaction.guild!.ownerId) {
    if (member.roles.highest.position <= botMember.roles.highest.position) {
      const errorEmbed = createErrorEmbed(
        'You must be the **Server Owner** or have a **Role higher than the Bot** to manage whitelists.'
      )
        .setTitle('⛔ Permission Denied');

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
  }

  switch (subcommand) {
    case 'add':
      await handleAdd(interaction, services.autoModService, guildId);
      break;
    case 'remove':
      await handleRemove(interaction, services.autoModService, guildId);
      break;
    case 'view':
      await handleView(interaction, services.autoModService, guildId);
      break;
  }
}

async function handleAdd(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService,
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const action = interaction.options.getString('action', true);
  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');

  // Validate that at least one target is provided
  if (!user && !role && !channel) {
    const errorEmbed = createErrorEmbed('Please specify at least one: user, role, or channel.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const addedTargets: string[] = [];
  const featureName = getFeatureName(action);

  try {
    // Handle global (add to all features)
    if (action === 'global') {
      const features = ['anti_spam', 'mass_mention', 'server_invite', 'anti_link'];

      if (user) {
        for (const feature of features) {
          await autoModService.addWhitelist(guildId, feature, user.id, 'user', interaction.user.id);
        }
        addedTargets.push(`${user} (User)`);
      }

      if (role) {
        for (const feature of features) {
          await autoModService.addWhitelist(guildId, feature, role.id, 'role', interaction.user.id);
        }
        addedTargets.push(`${role} (Role)`);
      }

      if (channel) {
        for (const feature of features) {
          await autoModService.addWhitelist(guildId, feature, channel.id, 'channel', interaction.user.id);
        }
        addedTargets.push(`${channel} (Channel)`);
      }
    } else {
      // Add to specific feature
      if (user) {
        await autoModService.addWhitelist(guildId, action, user.id, 'user', interaction.user.id);
        addedTargets.push(`${user} (User)`);
      }

      if (role) {
        await autoModService.addWhitelist(guildId, action, role.id, 'role', interaction.user.id);
        addedTargets.push(`${role} (Role)`);
      }

      if (channel) {
        await autoModService.addWhitelist(guildId, action, channel.id, 'channel', interaction.user.id);
        addedTargets.push(`${channel} (Channel)`);
      }
    }

    const successEmbed = createSuccessEmbed('Added to AutoMod Whitelist')
      .setTitle(`${CustomEmojis.TICK} Added to AutoMod Whitelist`)
      .setDescription(
        `Successfully whitelisted for **${featureName}**:\n\n` +
        addedTargets.map(t => `• ${t}`).join('\n')
      )
      .addFields({
        name: 'Effect',
        value: action === 'global'
          ? 'These entities will bypass ALL automod features.'
          : `These entities will bypass the ${featureName} feature.`,
        inline: false
      })
      .setFooter({
        text: `Added by ${interaction.user.tag}`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to add to whitelist: ${error.message || 'Unknown error'}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService,
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const action = interaction.options.getString('action', true);
  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');

  // Validate that at least one target is provided
  if (!user && !role && !channel) {
    const errorEmbed = createErrorEmbed('Please specify at least one: user, role, or channel.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const removedTargets: string[] = [];
  const featureName = getFeatureName(action);

  try {
    // Handle global (remove from all features)
    if (action === 'global') {
      const features = ['anti_spam', 'mass_mention', 'server_invite', 'anti_link'];

      if (user) {
        for (const feature of features) {
          try {
            await autoModService.removeWhitelist(guildId, feature, user.id);
          } catch (err) {
            // Ignore if not found
          }
        }
        removedTargets.push(`${user} (User)`);
      }

      if (role) {
        for (const feature of features) {
          try {
            await autoModService.removeWhitelist(guildId, feature, role.id);
          } catch (err) {
            // Ignore if not found
          }
        }
        removedTargets.push(`${role} (Role)`);
      }

      if (channel) {
        for (const feature of features) {
          try {
            await autoModService.removeWhitelist(guildId, feature, channel.id);
          } catch (err) {
            // Ignore if not found
          }
        }
        removedTargets.push(`${channel} (Channel)`);
      }
    } else {
      // Remove from specific feature
      if (user) {
        await autoModService.removeWhitelist(guildId, action, user.id);
        removedTargets.push(`${user} (User)`);
      }

      if (role) {
        await autoModService.removeWhitelist(guildId, action, role.id);
        removedTargets.push(`${role} (Role)`);
      }

      if (channel) {
        await autoModService.removeWhitelist(guildId, action, channel.id);
        removedTargets.push(`${channel} (Channel)`);
      }
    }

    const successEmbed = createSuccessEmbed('Removed from AutoMod Whitelist')
      .setTitle(`${CustomEmojis.TICK} Removed from AutoMod Whitelist`)
      .setDescription(
        `Successfully removed from **${featureName}** whitelist:\n\n` +
        removedTargets.map(t => `• ${t}`).join('\n')
      )
      .setFooter({
        text: `Removed by ${interaction.user.tag}`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to remove from whitelist: ${error.message || 'Unknown error'}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleView(
  interaction: ChatInputCommandInteraction,
  autoModService: AutoModService,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: 64 }); // Ephemeral

  const action = interaction.options.getString('action');
  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');

  try {
    // If specific target is provided, show their whitelist status
    if (user || role || channel) {
      const targetId = user?.id || role?.id || channel?.id;
      const targetType = user ? 'user' : role ? 'role' : 'channel';
      const targetDisplay = user || role || channel;

      const features = action && action !== 'global'
        ? [action]
        : ['anti_spam', 'mass_mention', 'server_invite', 'anti_link'];

      const whitelistedIn: string[] = [];

      for (const feature of features) {
        const whitelists = await autoModService.getWhitelists(guildId, feature);
        if (whitelists.some((w: any) => w.targetId === targetId)) {
          whitelistedIn.push(getFeatureName(feature));
        }
      }

      const embed = createInfoEmbed(`📋 AutoMod Whitelist Status`, `Status for ${targetDisplay}`)
        .setColor(whitelistedIn.length > 0 ? EmbedColors.SUCCESS : EmbedColors.INFO)
        .addFields({
          name: 'Whitelisted Features',
          value: whitelistedIn.length > 0
            ? whitelistedIn.map(f => `✅ ${f}`).join('\n')
            : 'Not whitelisted in any feature',
          inline: false
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Show all whitelist entries for the specified action(s)
    const features = action && action !== 'global'
      ? [action]
      : ['anti_spam', 'mass_mention', 'server_invite', 'anti_link'];

    const allWhitelists: Map<string, { feature: string, targetId: string, targetType: string }[]> = new Map();

    for (const feature of features) {
      const whitelists = await autoModService.getWhitelists(guildId, feature);

      for (const whitelist of whitelists) {
        const key = `${whitelist.targetType}_${whitelist.targetId}`;
        if (!allWhitelists.has(key)) {
          allWhitelists.set(key, []);
        }
        allWhitelists.get(key)!.push({
          feature,
          targetId: whitelist.targetId,
          targetType: whitelist.targetType
        });
      }
    }

    if (allWhitelists.size === 0) {
      const infoEmbed = createInfoEmbed(
        'AutoMod Whitelist',
        action && action !== 'global'
          ? `ℹ️ No whitelist entries found for **${getFeatureName(action)}**.`
          : `ℹ️ No whitelist entries found for any automod feature.`
      );
      await interaction.editReply({ embeds: [infoEmbed] });
      return;
    }

    // Group by type
    const users: string[] = [];
    const roles: string[] = [];
    const channels: string[] = [];

    for (const [key, entries] of allWhitelists) {
      const { targetType, targetId } = entries[0];
      const featuresList = entries.map(e => getFeatureName(e.feature));
      const isGlobal = featuresList.length === 4; // All 4 features

      const statusText = isGlobal
        ? '🌐 Global'
        : featuresList.map(f => `✅ ${f}`).join(', ');

      if (targetType === 'user') {
        users.push(`<@${targetId}>\n   ${statusText}`);
      } else if (targetType === 'role') {
        roles.push(`<@&${targetId}>\n   ${statusText}`);
      } else if (targetType === 'channel') {
        channels.push(`<#${targetId}>\n   ${statusText}`);
      }
    }

    const embed = createInfoEmbed(
      `📋 AutoMod Whitelist${action && action !== 'global' ? ' - ' + getFeatureName(action) : ''}`,
      action && action !== 'global'
        ? `Showing whitelist for **${getFeatureName(action)}**`
        : 'Showing whitelist for all automod features\n🌐 = Global (all features)'
    );

    if (users.length > 0) {
      embed.addFields({
        name: `👤 Users (${users.length})`,
        value: users.slice(0, 5).join('\n\n') + (users.length > 5 ? `\n\n*...and ${users.length - 5} more*` : ''),
        inline: false
      });
    }

    if (roles.length > 0) {
      embed.addFields({
        name: `🔷 Roles (${roles.length})`,
        value: roles.slice(0, 5).join('\n\n') + (roles.length > 5 ? `\n\n*...and ${roles.length - 5} more*` : ''),
        inline: false
      });
    }

    if (channels.length > 0) {
      embed.addFields({
        name: `📢 Channels (${channels.length})`,
        value: channels.slice(0, 5).join('\n\n') + (channels.length > 5 ? `\n\n*...and ${channels.length - 5} more*` : ''),
        inline: false
      });
    }

    embed.setFooter({ text: `Total: ${allWhitelists.size} entries` });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to view whitelist: ${error.message || 'Unknown error'}`);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

function getFeatureName(action: string): string {
  const names: Record<string, string> = {
    'anti_spam': 'Anti-Spam',
    'mass_mention': 'Mass Mention',
    'server_invite': 'Server Invite',
    'anti_link': 'Anti-Link',
    'global': 'Global (All Features)'
  };
  return names[action] || action;
}
