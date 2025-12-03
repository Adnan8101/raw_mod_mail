/**
 * WhitelistService - Manages whitelist with fast lookup and NOTIFY
 */

import { PrismaClient } from '@prisma/client';
import { WhitelistCategory, WhitelistEntry } from '../types';

export class WhitelistService {
  // Cache structure: Map<guildId, Map<targetId, Set<category>>>
  private cache: Map<string, Map<string, Set<WhitelistCategory>>> = new Map();

  constructor(private prisma: PrismaClient) {
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
   * Fast whitelist check - optimized for real-time event processing
   * Returns true if user/role is whitelisted for the action
   */
  async isWhitelisted(
    guildId: string,
    userId: string,
    roleIds: string[],
    action: WhitelistCategory
  ): Promise<boolean> {
    // Ensure cache loaded for guild
    await this.ensureGuildCacheLoaded(guildId);

    const guildWhitelist = this.cache.get(guildId);
    if (!guildWhitelist) {
      return false;
    }

    // Check if user has ALL whitelist
    const userCategories = guildWhitelist.get(userId);
    if (userCategories?.has(WhitelistCategory.ALL)) {
      return true;
    }

    // Check if user is whitelisted for specific action
    if (userCategories?.has(action)) {
      return true;
    }

    // Check roles
    for (const roleId of roleIds) {
      const roleCategories = guildWhitelist.get(roleId);
      
      // Check if role has ALL whitelist
      if (roleCategories?.has(WhitelistCategory.ALL)) {
        return true;
      }

      // Check if role is whitelisted for specific action
      if (roleCategories?.has(action)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add role to whitelist
   */
  async addRole(
    guildId: string,
    roleId: string,
    categories: WhitelistCategory[],
    addedBy: string
  ): Promise<void> {
    // Insert entries for each category
    for (const category of categories) {
      await this.prisma.whitelist.upsert({
        where: {
          guildId_targetId_category: {
            guildId,
            targetId: roleId,
            category,
          },
        },
        create: {
          guildId,
          targetId: roleId,
          isRole: true,
          category,
          createdBy: addedBy,
        },
        update: {},
      });
    }

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyWhitelistChange(guildId);
  }

  /**
   * Add user to whitelist
   */
  async addUser(
    guildId: string,
    userId: string,
    categories: WhitelistCategory[],
    addedBy: string
  ): Promise<void> {
    // Insert entries for each category
    for (const category of categories) {
      await this.prisma.whitelist.upsert({
        where: {
          guildId_targetId_category: {
            guildId,
            targetId: userId,
            category,
          },
        },
        create: {
          guildId,
          targetId: userId,
          isRole: false,
          category,
          createdBy: addedBy,
        },
        update: {},
      });
    }

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyWhitelistChange(guildId);
  }

  /**
   * Remove role from whitelist
   */
  async removeRole(
    guildId: string,
    roleId: string,
    categories: WhitelistCategory[] | 'ALL'
  ): Promise<void> {
    if (categories === 'ALL') {
      // Delete all entries for this role
      await this.prisma.whitelist.deleteMany({
        where: {
          guildId,
          targetId: roleId,
          isRole: true,
        },
      });
    } else {
      // Delete specific categories
      await this.prisma.whitelist.deleteMany({
        where: {
          guildId,
          targetId: roleId,
          isRole: true,
          category: { in: categories },
        },
      });
    }

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyWhitelistChange(guildId);
  }

  /**
   * Remove user from whitelist
   */
  async removeUser(
    guildId: string,
    userId: string,
    categories: WhitelistCategory[] | 'ALL'
  ): Promise<void> {
    if (categories === 'ALL') {
      // Delete all entries for this user
      await this.prisma.whitelist.deleteMany({
        where: {
          guildId,
          targetId: userId,
          isRole: false,
        },
      });
    } else {
      // Delete specific categories
      await this.prisma.whitelist.deleteMany({
        where: {
          guildId,
          targetId: userId,
          isRole: false,
          category: { in: categories },
        },
      });
    }

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyWhitelistChange(guildId);
  }

  /**
   * Get whitelist entries for a specific target
   */
  async getEntriesForTarget(guildId: string, targetId: string): Promise<WhitelistEntry[]> {
    const entries = await this.prisma.whitelist.findMany({
      where: {
        guildId,
        targetId,
      },
    });

    return entries.map(entry => ({
      targetId: entry.targetId,
      isRole: entry.isRole,
      category: entry.category as WhitelistCategory,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * List all whitelist entries for a guild
   */
  async listAll(guildId: string, filter?: 'role' | 'user'): Promise<WhitelistEntry[]> {
    const where: any = { guildId };
    
    if (filter === 'role') {
      where.isRole = true;
    } else if (filter === 'user') {
      where.isRole = false;
    }

    const entries = await this.prisma.whitelist.findMany({ where });

    return entries.map(entry => ({
      targetId: entry.targetId,
      isRole: entry.isRole,
      category: entry.category as WhitelistCategory,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Reset all whitelist entries for a guild
   */
  async reset(guildId: string): Promise<void> {
    await this.prisma.whitelist.deleteMany({
      where: { guildId },
    });

    // Invalidate cache
    this.cache.delete(guildId);

    // Emit NOTIFY
    await this.notifyWhitelistChange(guildId);
  }

  /**
   * Clear all whitelist entries for a guild (alias for reset)
   */
  async clearAllWhitelist(guildId: string): Promise<void> {
    await this.reset(guildId);
  }

  /**
   * Ensure guild cache is loaded
   */
  private async ensureGuildCacheLoaded(guildId: string): Promise<void> {
    if (this.cache.has(guildId)) {
      return;
    }

    const entries = await this.prisma.whitelist.findMany({
      where: { guildId },
    });

    const guildMap = new Map<string, Set<WhitelistCategory>>();

    for (const entry of entries) {
      if (!guildMap.has(entry.targetId)) {
        guildMap.set(entry.targetId, new Set());
      }
      guildMap.get(entry.targetId)!.add(entry.category as WhitelistCategory);
    }

    this.cache.set(guildId, guildMap);
  }

  /**
   * Notify whitelist change (PostgreSQL only)
   */
  private async notifyWhitelistChange(guildId: string): Promise<void> {
    // Skip for SQLite - NOTIFY is PostgreSQL only
    return;
  }

  /**
   * Reload cache for a guild
   */
  async reloadGuildCache(guildId: string): Promise<void> {
    this.cache.delete(guildId);
    await this.ensureGuildCacheLoaded(guildId);
  }
}
