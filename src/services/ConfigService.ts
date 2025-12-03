/**
 * ConfigService - Manages anti-nuke configuration with caching and NOTIFY
 */

import { PrismaClient } from '@prisma/client';
import { ProtectionAction, AntiNukeConfiguration, LimitConfiguration, PunishmentConfiguration } from '../types';

export class ConfigService {
  private cache: Map<string, AntiNukeConfiguration> = new Map();
  private limitsCache: Map<string, Map<ProtectionAction, LimitConfiguration>> = new Map();
  private punishmentsCache: Map<string, Map<ProtectionAction, PunishmentConfiguration>> = new Map();

  constructor(private prisma: PrismaClient) {
    this.setupNotificationListeners();
  }

  /**
   * Setup Postgres NOTIFY listeners for cache invalidation
   * Note: LISTEN/NOTIFY only works with PostgreSQL, disabled for SQLite
   */
  private async setupNotificationListeners(): Promise<void> {
    // Skip for SQLite - LISTEN/NOTIFY is PostgreSQL only
    // In production with PostgreSQL, use pg-listen library for proper NOTIFY handling
    return;
  }

  /**
   * Get anti-nuke configuration for a guild
   */
  async getConfig(guildId: string): Promise<AntiNukeConfiguration | null> {
    // Check cache first
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)!;
    }

    // Fetch from database
    const config = await this.prisma.antiNukeConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return null;
    }

    const parsed: AntiNukeConfiguration = {
      guildId: config.guildId,
      enabled: config.enabled,
      protections: JSON.parse(config.protections) as ProtectionAction[],
    };

    // Cache it
    this.cache.set(guildId, parsed);
    return parsed;
  }

  /**
   * Enable anti-nuke with specified protections
   */
  async enableAntiNuke(guildId: string, protections: ProtectionAction[]): Promise<void> {
    await this.prisma.antiNukeConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        enabled: true,
        protections: JSON.stringify(protections),
      },
      update: {
        enabled: true,
        protections: JSON.stringify(protections),
      },
    });

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyConfigChange(guildId);
  }

  /**
   * Disable anti-nuke
   */
  async disableAntiNuke(guildId: string): Promise<void> {
    await this.prisma.antiNukeConfig.update({
      where: { guildId },
      data: { enabled: false },
    });

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyConfigChange(guildId);
  }

  /**
   * Check if anti-nuke is enabled for a guild
   */
  async isEnabled(guildId: string): Promise<boolean> {
    const config = await this.getConfig(guildId);
    return config?.enabled ?? false;
  }

  /**
   * Check if a specific protection is enabled
   */
  async isProtectionEnabled(guildId: string, action: ProtectionAction): Promise<boolean> {
    const config = await this.getConfig(guildId);
    return config?.protections.includes(action) ?? false;
  }

  /**
   * Set limit for an action
   */
  async setLimit(guildId: string, action: ProtectionAction, limitCount: number, windowMs: number = 10000): Promise<void> {
    await this.prisma.antiNukeLimit.upsert({
      where: {
        guildId_action: { guildId, action },
      },
      create: {
        guildId,
        action,
        limitCount,
        windowMs,
      },
      update: {
        limitCount,
        windowMs,
      },
    });

    // Invalidate cache
    this.limitsCache.delete(guildId);

    // Emit NOTIFY
    await this.notifyLimitsChange(guildId);
  }

  /**
   * Get limit for an action
   */
  async getLimit(guildId: string, action: ProtectionAction): Promise<LimitConfiguration | null> {
    // Check cache
    const guildLimits = this.limitsCache.get(guildId);
    if (guildLimits?.has(action)) {
      return guildLimits.get(action)!;
    }

    // Fetch from database
    const limit = await this.prisma.antiNukeLimit.findUnique({
      where: {
        guildId_action: { guildId, action },
      },
    });

    if (!limit) {
      return null;
    }

    const config: LimitConfiguration = {
      action: action,
      limitCount: limit.limitCount,
      windowMs: limit.windowMs,
    };

    // Cache it
    if (!this.limitsCache.has(guildId)) {
      this.limitsCache.set(guildId, new Map());
    }
    this.limitsCache.get(guildId)!.set(action, config);

    return config;
  }

  /**
   * Set punishment for an action
   */
  async setPunishment(guildId: string, config: PunishmentConfiguration): Promise<void> {
    await this.prisma.antiNukePunishment.upsert({
      where: {
        guildId_action: { guildId, action: config.action },
      },
      create: {
        guildId,
        action: config.action,
        punishment: config.punishment,
        durationSeconds: config.durationSeconds,
      },
      update: {
        punishment: config.punishment,
        durationSeconds: config.durationSeconds,
      },
    });

    // Invalidate cache
    this.punishmentsCache.delete(guildId);

    // Emit NOTIFY
    await this.notifyPunishmentsChange(guildId);
  }

  /**
   * Get punishment for an action
   */
  async getPunishment(guildId: string, action: ProtectionAction): Promise<PunishmentConfiguration | null> {
    // Check cache
    const guildPunishments = this.punishmentsCache.get(guildId);
    if (guildPunishments?.has(action)) {
      return guildPunishments.get(action)!;
    }

    // Fetch from database
    const punishment = await this.prisma.antiNukePunishment.findUnique({
      where: {
        guildId_action: { guildId, action },
      },
    });

    if (!punishment) {
      return null;
    }

    const config: PunishmentConfiguration = {
      action: action,
      punishment: punishment.punishment as any,
      durationSeconds: punishment.durationSeconds ?? undefined,
    };

    // Cache it
    if (!this.punishmentsCache.has(guildId)) {
      this.punishmentsCache.set(guildId, new Map());
    }
    this.punishmentsCache.get(guildId)!.set(action, config);

    return config;
  }

  /**
   * Get all punishments for a guild
   */
  async getAllPunishments(guildId: string): Promise<PunishmentConfiguration[]> {
    // Fetch from database
    const punishments = await this.prisma.antiNukePunishment.findMany({
      where: { guildId },
    });

    return punishments.map(p => ({
      action: p.action as ProtectionAction,
      punishment: p.punishment as any,
      durationSeconds: p.durationSeconds ?? undefined,
    }));
  }

  /**
   * Notify config change (PostgreSQL only)
   */
  private async notifyConfigChange(guildId: string): Promise<void> {
    // Skip for SQLite - NOTIFY is PostgreSQL only
    return;
  }

  /**
   * Notify limits change (PostgreSQL only)
   */
  private async notifyLimitsChange(guildId: string): Promise<void> {
    // Skip for SQLite - NOTIFY is PostgreSQL only
    return;
  }

  /**
   * Notify punishments change (PostgreSQL only)
   */
  private async notifyPunishmentsChange(guildId: string): Promise<void> {
    // Skip for SQLite - NOTIFY is PostgreSQL only
    return;
  }

  /**
   * Reload cache for a guild (called when NOTIFY received)
   */
  async reloadGuildCache(guildId: string): Promise<void> {
    this.cache.delete(guildId);
    this.limitsCache.delete(guildId);
    this.punishmentsCache.delete(guildId);
    
    // Preload fresh data
    await this.getConfig(guildId);
  }

  /**
   * Reset all anti-nuke configuration for a guild
   */
  async resetGuild(guildId: string): Promise<void> {
    // Delete all anti-nuke related data
    await this.prisma.antiNukeConfig.deleteMany({ where: { guildId } });
    await this.prisma.antiNukeLimit.deleteMany({ where: { guildId } });
    await this.prisma.antiNukePunishment.deleteMany({ where: { guildId } });

    // Clear caches
    this.cache.delete(guildId);
    this.limitsCache.delete(guildId);
    this.punishmentsCache.delete(guildId);

    // Emit NOTIFY
    await this.notifyConfigChange(guildId);
  }
}
