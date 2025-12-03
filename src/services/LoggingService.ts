/**
 * LoggingService - Manages logging channels and posts formatted embeds
 */

import { PrismaClient } from '@prisma/client';
import { Client, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { EmbedColors } from '../types';

export class LoggingService {
  private cache: Map<string, { modChannel?: string; securityChannel?: string }> = new Map();

  constructor(
    private prisma: PrismaClient,
    private client: Client
  ) {
    this.setupNotificationListeners();
  }

  /**
   * Setup Postgres NOTIFY listeners (PostgreSQL only)
   */
  private async setupNotificationListeners(): Promise<void> {
    // Skip for SQLite - LISTEN is PostgreSQL only
    return;
  }

  /**
   * Set mod log channel
   */
  async setModChannel(guildId: string, channelId: string): Promise<void> {
    await this.prisma.guildLogging.upsert({
      where: { guildId },
      create: {
        guildId,
        modChannel: channelId,
      },
      update: {
        modChannel: channelId,
      },
    });

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyLoggingChange(guildId);
  }

  /**
   * Set security log channel
   */
  async setSecurityChannel(guildId: string, channelId: string): Promise<void> {
    await this.prisma.guildLogging.upsert({
      where: { guildId },
      create: {
        guildId,
        securityChannel: channelId,
      },
      update: {
        securityChannel: channelId,
      },
    });

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyLoggingChange(guildId);
  }

  /**
   * Get logging configuration
   */
  async getConfig(guildId: string): Promise<{ modChannel?: string; securityChannel?: string }> {
    // Check cache
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)!;
    }

    // Fetch from database
    const config = await this.prisma.guildLogging.findUnique({
      where: { guildId },
    });

    const result = {
      modChannel: config?.modChannel ?? undefined,
      securityChannel: config?.securityChannel ?? undefined,
    };

    // Cache it
    this.cache.set(guildId, result);
    return result;
  }

  /**
   * Log to mod channel
   */
  async logMod(guildId: string, embed: EmbedBuilder): Promise<boolean> {
    const config = await this.getConfig(guildId);
    if (!config.modChannel) {
      return false;
    }

    return await this.sendToChannel(config.modChannel, embed);
  }

  /**
   * Log to security channel
   */
  async logSecurity(guildId: string, embed: EmbedBuilder): Promise<boolean> {
    const config = await this.getConfig(guildId);
    if (!config.securityChannel) {
      return false;
    }

    return await this.sendToChannel(config.securityChannel, embed);
  }

  /**
   * Log moderation action
   */
  async logModeration(
    guildId: string,
    data: {
      action: string;
      target: { tag: string; id: string };
      moderator: { tag: string; id: string };
      reason: string;
      caseNumber?: number;
      duration?: string;
    }
  ): Promise<boolean> {
    const description = [
      `**Target:** <@${data.target.id}> (\`${data.target.id}\`)`,
      `**Moderator:** <@${data.moderator.id}> (\`${data.moderator.id}\`)`,
      `**Reason:** ${data.reason}`,
      data.duration ? `**Duration:** ${data.duration}` : null,
      data.caseNumber ? `**Case:** #${data.caseNumber}` : null,
    ].filter(Boolean).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`⚖️ Moderation: ${data.action}`)
      .setColor(EmbedColors.MODERATION)
      .setDescription(description)
      .setTimestamp();

    return await this.logMod(guildId, embed);
  }

  /**
   * Send embed to a channel
   */
  private async sendToChannel(channelId: string, embed: EmbedBuilder): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        return false;
      }

      await (channel as TextChannel).send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error(`Failed to send to channel ${channelId}:`, error);
      return false;
    }
  }

  /**
   * Create security action embed
   */
  createSecurityActionEmbed(data: {
    title: string;
    executorId: string;
    executorTag: string;
    action: string;
    limit?: number;
    count?: number;
    punishment?: string;
    caseId?: number;
    resetTime?: number;
  }): EmbedBuilder {
    const description = [
      `**Executor:** <@${data.executorId}> (\`${data.executorId}\`)`,
      `**Action:** ${data.action}`,
      data.limit ? `**Limit:** ${data.limit}` : null,
      data.count ? `**Count:** ${data.count}` : null,
      data.punishment ? `**Punishment:** ${data.punishment.toUpperCase()}` : null,
      data.caseId ? `**Case ID:** #${data.caseId}` : null,
      data.resetTime ? `**Limit Resets:** <t:${Math.floor(data.resetTime / 1000)}:R>` : null,
    ].filter(Boolean).join('\n');

    return new EmbedBuilder()
      .setTitle(`🛡️ Security Alert: ${data.action}`)
      .setColor(EmbedColors.SECURITY)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Create mod action embed
   */
  createModActionEmbed(data: {
    title: string;
    targetId: string;
    targetTag: string;
    moderatorId: string;
    moderatorTag: string;
    action: string;
    reason?: string;
    caseId?: number;
  }): EmbedBuilder {
    const description = [
      `**Target:** <@${data.targetId}> (\`${data.targetId}\`)`,
      `**Moderator:** <@${data.moderatorId}> (\`${data.moderatorId}\`)`,
      `**Action:** ${data.action}`,
      data.reason ? `**Reason:** ${data.reason}` : null,
      data.caseId ? `**Case ID:** #${data.caseId}` : null,
    ].filter(Boolean).join('\n');

    return new EmbedBuilder()
      .setTitle(`⚖️ Moderation: ${data.action}`)
      .setColor(EmbedColors.MODERATION)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Notify logging change (PostgreSQL only)
   */
  private async notifyLoggingChange(guildId: string): Promise<void> {
    // Skip for SQLite - NOTIFY is PostgreSQL only
    return;
  }

  /**
   * Reload cache for a guild
   */
  async reloadGuildCache(guildId: string): Promise<void> {
    this.cache.delete(guildId);
    await this.getConfig(guildId);
  }
}
