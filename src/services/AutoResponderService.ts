/**
 * AutoResponderService - Manages auto-responder trigger-response pairs
 */

import { PrismaClient } from '@prisma/client';

export interface AutoResponderEntry {
  id: string;
  guildId: string;
  trigger: string;
  response: string;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AutoResponderService {
  private cache: Map<string, AutoResponderEntry[]> = new Map();

  constructor(private prisma: PrismaClient) {}

  /**
   * Add a new auto-responder
   */
  async addAutoResponder(
    guildId: string,
    trigger: string,
    response: string,
    createdBy: string
  ): Promise<AutoResponderEntry> {
    const entry = await this.prisma.autoResponder.create({
      data: {
        guildId,
        trigger: trigger.toLowerCase(), // Store triggers in lowercase for case-insensitive matching
        response,
        createdBy,
        enabled: true,
      },
    });

    // Invalidate cache
    this.cache.delete(guildId);

    return this.mapToEntry(entry);
  }

  /**
   * Get a specific auto-responder by ID
   */
  async getAutoResponder(id: string): Promise<AutoResponderEntry | null> {
    const entry = await this.prisma.autoResponder.findUnique({
      where: { id },
    });

    return entry ? this.mapToEntry(entry) : null;
  }

  /**
   * Get all auto-responders for a guild
   */
  async getAllAutoResponders(guildId: string): Promise<AutoResponderEntry[]> {
    // Check cache
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)!;
    }

    // Fetch from database
    const entries = await this.prisma.autoResponder.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = entries.map(e => this.mapToEntry(e));

    // Cache it
    this.cache.set(guildId, mapped);

    return mapped;
  }

  /**
   * Get all enabled auto-responders for a guild
   */
  async getEnabledAutoResponders(guildId: string): Promise<AutoResponderEntry[]> {
    const all = await this.getAllAutoResponders(guildId);
    return all.filter(ar => ar.enabled);
  }

  /**
   * Update an auto-responder
   */
  async updateAutoResponder(
    id: string,
    trigger: string,
    response: string
  ): Promise<AutoResponderEntry> {
    const entry = await this.prisma.autoResponder.update({
      where: { id },
      data: {
        trigger: trigger.toLowerCase(),
        response,
      },
    });

    // Invalidate cache
    this.cache.delete(entry.guildId);

    return this.mapToEntry(entry);
  }

  /**
   * Toggle auto-responder enabled status
   */
  async toggleAutoResponder(id: string, enabled: boolean): Promise<AutoResponderEntry> {
    const entry = await this.prisma.autoResponder.update({
      where: { id },
      data: { enabled },
    });

    // Invalidate cache
    this.cache.delete(entry.guildId);

    return this.mapToEntry(entry);
  }

  /**
   * Delete an auto-responder
   */
  async deleteAutoResponder(id: string): Promise<void> {
    const entry = await this.prisma.autoResponder.findUnique({
      where: { id },
    });

    if (entry) {
      await this.prisma.autoResponder.delete({
        where: { id },
      });

      // Invalidate cache
      this.cache.delete(entry.guildId);
    }
  }

  /**
   * Find matching auto-responder for a message
   */
  async findMatch(guildId: string, messageContent: string): Promise<string | null> {
    const autoResponders = await this.getEnabledAutoResponders(guildId);
    const lowerContent = messageContent.toLowerCase();

    // Find first matching trigger
    for (const ar of autoResponders) {
      if (lowerContent.includes(ar.trigger)) {
        return ar.response;
      }
    }

    return null;
  }

  /**
   * Clear all auto-responders for a guild
   */
  async clearAll(guildId: string): Promise<number> {
    const result = await this.prisma.autoResponder.deleteMany({
      where: { guildId },
    });

    // Invalidate cache
    this.cache.delete(guildId);

    return result.count;
  }

  /**
   * Map database entry to interface
   */
  private mapToEntry(entry: any): AutoResponderEntry {
    return {
      id: entry.id,
      guildId: entry.guildId,
      trigger: entry.trigger,
      response: entry.response,
      enabled: entry.enabled,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
