/**
 * Logging Monitor - Monitors and logs audit events
 */

import {
  Client,
  EmbedBuilder,
  AuditLogEvent,
  TextChannel,
  Message,
  Role,
  GuildChannel,
  Events,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { EmbedColors } from '../types';
import { CustomEmojis } from '../utils/emoji';

export class LoggingMonitor {
  private client: Client;
  private prisma: PrismaClient;

  constructor(client: Client, prisma: PrismaClient) {
    this.client = client;
    this.prisma = prisma;
    this.setupListeners();
  }

  private setupListeners() {
    // Role events
    this.client.on(Events.GuildRoleCreate, async (role) => {
      await this.logRoleCreate(role);
    });

    this.client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
      await this.logRoleEdit(oldRole, newRole);
    });

    this.client.on(Events.GuildRoleDelete, async (role) => {
      await this.logRoleDelete(role);
    });

    // Channel events
    this.client.on(Events.ChannelCreate, async (channel) => {
      if (channel.isDMBased()) return;
      await this.logChannelCreate(channel as GuildChannel);
    });

    this.client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
      if (newChannel.isDMBased()) return;
      await this.logChannelEdit(oldChannel as GuildChannel, newChannel as GuildChannel);
    });

    this.client.on(Events.ChannelDelete, async (channel) => {
      if (channel.isDMBased()) return;
      await this.logChannelDelete(channel as GuildChannel);
    });

    // Message events
    this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      if (!newMessage.guild || newMessage.author?.bot) return;
      await this.logMessageEdit(oldMessage as Message, newMessage as Message);
    });

    this.client.on(Events.MessageDelete, async (message) => {
      if (!message.guild || message.author?.bot) return;
      await this.logMessageDelete(message as Message);
    });

    this.client.on(Events.MessageBulkDelete, async (messages) => {
      const firstMessage = messages.first();
      if (!firstMessage?.guild) return;
      await this.logBulkDelete(messages.size, firstMessage.guild.id, firstMessage.channel as TextChannel);
    });

    // Member events
    this.client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
      await this.logMemberUpdate(oldMember, newMember);
    });
  }

  private async logMemberUpdate(oldMember: any, newMember: any) {
    const logChannel = await this.getLogChannel(newMember.guild.id);
    if (!logChannel) return;

    // Check for nickname changes
    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setColor(EmbedColors.WARNING)
        .setTitle(`${CustomEmojis.USER} Member Nickname Changed`)
        .addFields(
          { name: 'Member', value: `${newMember.user}`, inline: true },
          { name: 'Old Nickname', value: oldMember.nickname || '*None*', inline: true },
          { name: 'New Nickname', value: newMember.nickname || '*None*', inline: true },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }

    // Check for role changes
    const addedRoles = newMember.roles.cache.filter((r: any) => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter((r: any) => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0) {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 1,
      });
      const auditEntry = auditLogs.entries.first();

      const embed = new EmbedBuilder()
        .setColor(EmbedColors.SUCCESS)
        .setTitle(`${CustomEmojis.ADMIN} Role Added to Member`)
        .addFields(
          { name: 'Member', value: `${newMember.user}`, inline: true },
          { name: 'Roles Added', value: addedRoles.map((r: any) => r).join(', '), inline: true },
          { name: 'Added By', value: auditEntry?.executor ? `${auditEntry.executor}` : 'Unknown', inline: true },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }

    if (removedRoles.size > 0) {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 1,
      });
      const auditEntry = auditLogs.entries.first();

      const embed = new EmbedBuilder()
        .setColor(EmbedColors.ERROR)
        .setTitle(`${CustomEmojis.ADMIN} Role Removed from Member`)
        .addFields(
          { name: 'Member', value: `${newMember.user}`, inline: true },
          { name: 'Roles Removed', value: removedRoles.map((r: any) => r).join(', '), inline: true },
          { name: 'Removed By', value: auditEntry?.executor ? `${auditEntry.executor}` : 'Unknown', inline: true },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }
  }

  private async getLogChannel(guildId: string): Promise<TextChannel | null> {
    try {
      // Check if loggingConfig table exists
      if (!this.prisma.loggingConfig) {
        return null;
      }

      const config = await this.prisma.loggingConfig.findUnique({
        where: { guildId },
      });

      if (!config || !config.enabled || !config.channelId) return null;

      const channel = this.client.channels.cache.get(config.channelId) as TextChannel;
      return channel || null;
    } catch (error) {
      // Silently fail if table doesn't exist yet
      return null;
    }
  }

  private async logRoleCreate(role: Role) {
    const logChannel = await this.getLogChannel(role.guild.id);
    if (!logChannel) return;

    const auditLogs = await role.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleCreate,
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.SUCCESS)
      .setTitle(`${CustomEmojis.ADMIN} Role Created`)
      .addFields(
        { name: 'Role', value: `${role} (\`${role.id}\`)`, inline: true },
        { name: 'Created By', value: auditEntry?.executor ? `${auditEntry.executor}` : 'Unknown', inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
      )
      .setFooter({ text: `Role ID: ${role.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  private async logRoleEdit(oldRole: Role, newRole: Role) {
    const logChannel = await this.getLogChannel(newRole.guild.id);
    if (!logChannel) return;

    const changes: string[] = [];
    if (oldRole.name !== newRole.name) changes.push(`**Name:** ${oldRole.name} → ${newRole.name}`);
    if (oldRole.color !== newRole.color) changes.push(`**Color:** ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Hoisted:** ${oldRole.hoist} → ${newRole.hoist}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Mentionable:** ${oldRole.mentionable} → ${newRole.mentionable}`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push(`**Permissions:** Modified`);

    if (changes.length === 0) return;

    const auditLogs = await newRole.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleUpdate,
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.WARNING)
      .setTitle(`${CustomEmojis.ADMIN} Role Updated`)
      .setDescription(changes.join('\n'))
      .addFields(
        { name: 'Role', value: `${newRole} (\`${newRole.id}\`)`, inline: true },
        { name: 'Updated By', value: auditEntry?.executor ? `${auditEntry.executor}` : 'Unknown', inline: true },
      )
      .setFooter({ text: `Role ID: ${newRole.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  private async logRoleDelete(role: Role) {
    const logChannel = await this.getLogChannel(role.guild.id);
    if (!logChannel) return;

    const auditLogs = await role.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleDelete,
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setTitle(`${CustomEmojis.ADMIN} Role Deleted`)
      .addFields(
        { name: 'Role Name', value: role.name, inline: true },
        { name: 'Deleted By', value: auditEntry?.executor ? `${auditEntry.executor}` : 'Unknown', inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
      )
      .setFooter({ text: `Role ID: ${role.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  private async logChannelCreate(channel: GuildChannel) {
    const logChannel = await this.getLogChannel(channel.guild.id);
    if (!logChannel) return;

    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelCreate,
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.SUCCESS)
      .setTitle(`${CustomEmojis.CHANNEL} Channel Created`)
      .addFields(
        { name: 'Channel', value: `${channel} (\`${channel.id}\`)`, inline: true },
        { name: 'Type', value: channel.type.toString(), inline: true },
        { name: 'Created By', value: auditEntry?.executor ? `${auditEntry.executor}` : 'Unknown', inline: true },
      )
      .setFooter({ text: `Channel ID: ${channel.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  private async logChannelEdit(oldChannel: GuildChannel, newChannel: GuildChannel) {
    const logChannel = await this.getLogChannel(newChannel.guild.id);
    if (!logChannel) return;

    const changes: string[] = [];
    if (oldChannel.name !== newChannel.name) changes.push(`**Name:** ${oldChannel.name} → ${newChannel.name}`);
    if (oldChannel.position !== newChannel.position) changes.push(`**Position:** ${oldChannel.position} → ${newChannel.position}`);

    if (changes.length === 0) return;

    const auditLogs = await newChannel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelUpdate,
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.WARNING)
      .setTitle(`${CustomEmojis.CHANNEL} Channel Updated`)
      .setDescription(changes.join('\n'))
      .addFields(
        { name: 'Channel', value: `${newChannel} (\`${newChannel.id}\`)`, inline: true },
        { name: 'Updated By', value: auditEntry?.executor ? `${auditEntry.executor}` : 'Unknown', inline: true },
      )
      .setFooter({ text: `Channel ID: ${newChannel.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  private async logChannelDelete(channel: GuildChannel) {
    const logChannel = await this.getLogChannel(channel.guild.id);
    if (!logChannel) return;

    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 1,
    });

    const auditEntry = auditLogs.entries.first();

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setTitle(`${CustomEmojis.CHANNEL} Channel Deleted`)
      .addFields(
        { name: 'Channel Name', value: channel.name, inline: true },
        { name: 'Type', value: channel.type.toString(), inline: true },
        { name: 'Deleted By', value: auditEntry?.executor ? `${auditEntry.executor}` : 'Unknown', inline: true },
      )
      .setFooter({ text: `Channel ID: ${channel.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  private async logMessageEdit(oldMessage: Message, newMessage: Message) {
    const logChannel = await this.getLogChannel(newMessage.guild!.id);
    if (!logChannel) return;

    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.WARNING)
      .setTitle(`${CustomEmojis.FILES} Message Edited`)
      .addFields(
        { name: 'Author', value: `${newMessage.author}`, inline: true },
        { name: 'Channel', value: `${newMessage.channel}`, inline: true },
        { name: 'Before', value: oldMessage.content?.slice(0, 1024) || '*No content*', inline: false },
        { name: 'After', value: newMessage.content?.slice(0, 1024) || '*No content*', inline: false },
      )
      .setFooter({ text: `Message ID: ${newMessage.id} | User ID: ${newMessage.author.id}` })
      .setTimestamp();

    if (newMessage.url) {
      embed.addFields({ name: 'Jump to Message', value: `[Click here](${newMessage.url})`, inline: false });
    }

    await logChannel.send({ embeds: [embed] });
  }

  private async logMessageDelete(message: Message) {
    const logChannel = await this.getLogChannel(message.guild!.id);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setTitle(`${CustomEmojis.FILES} Message Deleted`)
      .addFields(
        { name: 'Author', value: message.author ? `${message.author}` : 'Unknown', inline: true },
        { name: 'Channel', value: `${message.channel}`, inline: true },
        { name: 'Content', value: message.content?.slice(0, 1024) || '*No content*', inline: false },
      )
      .setFooter({ text: `Message ID: ${message.id}` })
      .setTimestamp();

    if (message.attachments.size > 0) {
      const attachmentUrls = message.attachments.map(a => a.url).join('\n');
      embed.addFields({ name: `${CustomEmojis.FILES} Attachments`, value: attachmentUrls, inline: false });
    }

    await logChannel.send({ embeds: [embed] });
  }

  private async logBulkDelete(count: number, guildId: string, channel: TextChannel) {
    const logChannel = await this.getLogChannel(guildId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setTitle(`${CustomEmojis.FILES} Bulk Message Delete`)
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Count', value: count.toString(), inline: true },
      )
      .setFooter({ text: 'Bulk delete operation' })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
}
