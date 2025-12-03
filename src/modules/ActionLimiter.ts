/**
 * ActionLimiter - Records events and evaluates sliding window counters
 */

import { PrismaClient } from '@prisma/client';
import { SecurityEvent, ProtectionAction } from '../types';
import { ConfigService } from '../services/ConfigService';

export class ActionLimiter {
  private memoryCache: Map<string, number[]> = new Map();

  constructor(
    private prisma: PrismaClient,
    private configService: ConfigService
  ) { }

  /**
   * Record a security event and check if limit exceeded
   * Returns the count and whether limit was exceeded
   */
  async recordAndCheck(event: SecurityEvent): Promise<{ count: number; limitExceeded: boolean; limit?: number; resetTime?: number }> {
    // Get limit configuration
    const limitConfig = await this.configService.getLimit(event.guildId, event.action);

    if (!limitConfig) {
      // Record asynchronously even if no limit
      this.recordActionAsync(event);
      return { count: 1, limitExceeded: false };
    }

    const now = event.timestamp.getTime();
    const windowStart = now - limitConfig.windowMs;
    const cacheKey = `${event.guildId}:${event.userId}:${event.action}`;

    // Update memory cache
    let timestamps = this.memoryCache.get(cacheKey) || [];
    timestamps.push(now);

    // Filter out old timestamps
    timestamps = timestamps.filter(t => t >= windowStart);
    this.memoryCache.set(cacheKey, timestamps);

    const count = timestamps.length;
    const limitExceeded = count > limitConfig.limitCount;

    // Calculate reset time (when the oldest action in the window expires)
    // If we have timestamps, the window slides. The count drops when the oldest timestamp + windowMs is reached.
    // However, for a strict "reset", it's usually when the *current* window expires if we consider it fixed,
    // but with a sliding window, it's when the oldest relevant action falls out.
    // Let's return the time when the count will drop below the limit.
    // Actually, simply returning `now + windowMs` is a safe "full reset",
    // but `timestamps[0] + limitConfig.windowMs` is when the *first* action expires.

    const oldestTimestamp = timestamps[0] || now;
    const resetTime = oldestTimestamp + limitConfig.windowMs;

    // Record to DB asynchronously
    this.recordActionAsync(event);

    return {
      count,
      limitExceeded,
      limit: limitConfig.limitCount,
      resetTime
    };
  }

  private async recordActionAsync(event: SecurityEvent): Promise<void> {
    try {
      await this.prisma.antiNukeAction.create({
        data: {
          guildId: event.guildId,
          userId: event.userId,
          action: event.action,
          targetId: event.targetId,
          timestamp: event.timestamp,
          auditLogId: event.auditLogId,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        },
      });
    } catch (error) {
      console.error('Failed to record action to DB:', error);
    }
  }

  /**
   * Get action count for a user in a time window
   */
  async getActionCount(
    guildId: string,
    userId: string,
    action: ProtectionAction,
    windowMs: number
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowMs);

    return await this.prisma.antiNukeAction.count({
      where: {
        guildId,
        userId,
        action,
        timestamp: {
          gte: windowStart,
        },
      },
    });
  }

  /**
   * Get all actions for a user in a time window (for reversion)
   */
  async getActionsByUser(
    guildId: string,
    userId: string,
    action: ProtectionAction,
    windowMs: number
  ): Promise<SecurityEvent[]> {
    const windowStart = new Date(Date.now() - windowMs);

    const actions = await this.prisma.antiNukeAction.findMany({
      where: {
        guildId,
        userId,
        action,
        timestamp: {
          gte: windowStart,
        },
      },
    });

    return actions.map(action => ({
      guildId: action.guildId,
      userId: action.userId,
      action: action.action as ProtectionAction,
      targetId: action.targetId ?? undefined,
      auditLogId: action.auditLogId ?? undefined,
      timestamp: action.timestamp,
      metadata: action.metadata ? JSON.parse(action.metadata) : undefined,
    }));
  }

  /**
   * Get recent actions for a guild
   */
  async getRecentActions(guildId: string, limit: number = 10): Promise<SecurityEvent[]> {
    const actions = await this.prisma.antiNukeAction.findMany({
      where: { guildId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return actions.map(action => ({
      guildId: action.guildId,
      userId: action.userId,
      action: action.action as ProtectionAction,
      targetId: action.targetId ?? undefined,
      auditLogId: action.auditLogId ?? undefined,
      timestamp: action.timestamp,
      metadata: action.metadata ? JSON.parse(action.metadata) : undefined,
    }));
  }

  /**
   * Clean up old actions (should be run periodically)
   */
  async cleanupOldActions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.antiNukeAction.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Clear all actions for a guild
   */
  async clearAllActions(guildId: string): Promise<void> {
    await this.prisma.antiNukeAction.deleteMany({
      where: { guildId },
    });

    // Clear memory cache for this guild
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`${guildId}:`)) {
        this.memoryCache.delete(key);
      }
    }
  }
}
