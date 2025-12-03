/**
 * Server Command - Display server information
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { EmbedColors } from '../types';
import { createInfoEmbed } from '../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('server')
  .setDescription('Display server information')
  .addBooleanOption(option =>
    option
      .setName('full')
      .setDescription('Show full details (admin only)')
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const guild = interaction.guild!;
  const requestFull = interaction.options.getBoolean('full') ?? false;

  // Check if user has permissions for full details
  const member = guild.members.cache.get(interaction.user.id);
  const hasAdminPerms = member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
  const showFull = requestFull && hasAdminPerms;

  // Fetch additional guild data if needed
  const owner = await guild.fetchOwner().catch(() => null);
  const channels = guild.channels.cache;

  // Count channels by type
  const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
  const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
  const threads = channels.filter(c => c.isThread()).size;

  // Create embed
  const embed = createInfoEmbed(`📊 ${guild.name}`, '')
    .setThumbnail(guild.iconURL() ?? null);

  // Basic info
  embed.addFields(
    { name: 'Server ID', value: guild.id, inline: true },
    { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
    { name: 'Owner', value: owner ? `${owner.user.tag}${showFull ? ` (${owner.id})` : ''}` : 'Unknown', inline: true }
  );

  // Member stats
  const memberCount = guild.memberCount;
  const botCount = guild.members.cache.filter(m => m.user.bot).size;
  const humanCount = memberCount - botCount;

  embed.addFields({
    name: 'Members',
    value: `👥 ${humanCount.toLocaleString()} humans\n🤖 ${botCount} bots\n📊 ${memberCount.toLocaleString()} total`,
    inline: true,
  });

  // Channel stats
  embed.addFields({
    name: 'Channels',
    value: [
      `💬 ${textChannels} text`,
      `🔊 ${voiceChannels} voice`,
      `📁 ${categories} categories`,
      threads > 0 ? `🧵 ${threads} threads` : null,
    ].filter(Boolean).join('\n'),
    inline: true,
  });

  // Boost stats
  const boostTier = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount ?? 0;

  embed.addFields({
    name: 'Boost Status',
    value: `Level ${boostTier}\n${boostCount} boosts`,
    inline: true,
  });

  // Role stats
  const roleCount = guild.roles.cache.size - 1; // Exclude @everyone
  const topRoles = guild.roles.cache
    .sort((a, b) => b.position - a.position)
    .filter(r => r.id !== guild.roles.everyone.id)
    .first(10)
    .map(r => r.name)
    .join(', ');

  embed.addFields({
    name: `Roles (${roleCount})`,
    value: topRoles.length > 0 ? topRoles : 'No roles',
    inline: false,
  });

  // Full details (admin only)
  if (showFull) {
    // Features
    const features = guild.features.length > 0
      ? guild.features.map(f => `\`${f}\``).join(', ')
      : 'None';

    embed.addFields({
      name: 'Features',
      value: features,
      inline: false,
    });

    // System channel
    if (guild.systemChannel) {
      embed.addFields({
        name: 'System Channel',
        value: `<#${guild.systemChannel.id}>`,
        inline: true,
      });
    }

    // Rules channel
    if (guild.rulesChannel) {
      embed.addFields({
        name: 'Rules Channel',
        value: `<#${guild.rulesChannel.id}>`,
        inline: true,
      });
    }

    // AFK channel and timeout
    if (guild.afkChannel) {
      embed.addFields({
        name: 'AFK',
        value: `<#${guild.afkChannel.id}> (${guild.afkTimeout}s)`,
        inline: true,
      });
    }

    // Verification level
    const verificationLevels = ['None', 'Low', 'Medium', 'High', 'Very High'];
    embed.addFields({
      name: 'Verification Level',
      value: verificationLevels[guild.verificationLevel] || 'Unknown',
      inline: true,
    });

    // MFA level
    embed.addFields({
      name: '2FA Requirement',
      value: guild.mfaLevel === 1 ? 'Enabled' : 'Disabled',
      inline: true,
    });

    // Explicit content filter
    const contentFilters = ['Disabled', 'Members without roles', 'All members'];
    embed.addFields({
      name: 'Content Filter',
      value: contentFilters[guild.explicitContentFilter] || 'Unknown',
      inline: true,
    });
  } else if (requestFull && !hasAdminPerms) {
    embed.setFooter({
      text: 'Full details require Manage Server permission',
    });
  }

  // Banner if available
  if (guild.banner) {
    embed.setImage(guild.bannerURL({ size: 1024 }) ?? null);
  }

  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
