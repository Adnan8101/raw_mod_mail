/**
 * GuildConfigService - Manages guild-specific configuration like prefix
 */

import { PrismaClient } from '@prisma/client';

export class GuildConfigService {
  private prefixCache: Map<string, string> = new Map();

  constructor(private prisma: PrismaClient) {}

  /**
   * Get prefix for a guild
   */
  async getPrefix(guildId: string): Promise<string> {
    // Check cache
    if (this.prefixCache.has(guildId)) {
      return this.prefixCache.get(guildId)!;
    }

    // Fetch from database
    const config = await this.prisma.guildConfig.findUnique({
      where: { guildId },
    });

    const prefix = config?.prefix || '!';
    this.prefixCache.set(guildId, prefix);
    return prefix;
  }

  /**
   * Set prefix for a guild
   */
  async setPrefix(guildId: string, prefix: string): Promise<void> {
    await this.prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, prefix },
      update: { prefix },
    });

    // Update cache
    this.prefixCache.set(guildId, prefix);
  }

  /**
   * Reset prefix to default
   */
  async resetPrefix(guildId: string): Promise<void> {
    await this.setPrefix(guildId, '!');
  }

  /**
   * Clear cache for a guild
   */
  clearCache(guildId: string): void {
    this.prefixCache.delete(guildId);
  }
}
