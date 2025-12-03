/**
 * InviteService - Handles invite tracking with database persistence
 */

import { Collection, Guild, Invite } from 'discord.js';
import { prisma } from '../database/connect';

export class InviteService {
  constructor() { }

  /**
   * Cache all invites for a guild in the database
   */
  async cacheGuildInvites(guild: Guild): Promise<void> {
    try {
      const invites = await guild.invites.fetch();

      // Delete old cache for this guild
      await prisma.inviteCache.deleteMany({ where: { guildId: guild.id } });

      // Insert new cache
      const inviteData = invites.map(invite => ({
        guildId: guild.id,
        code: invite.code,
        inviterId: invite.inviter?.id || 'unknown',
        inviterTag: invite.inviter?.tag || 'unknown',
        uses: invite.uses || 0,
        maxUses: invite.maxUses || 0,
        createdAt: invite.createdAt || new Date()
      }));

      if (inviteData.length > 0) {
        await prisma.inviteCache.createMany({ data: inviteData });
      }
    } catch (error: any) {
      if (error.code === 50013) {
        console.warn(`⚠️ Missing permissions to cache invites for guild ${guild.name} (${guild.id})`);
      } else {
        console.error('Error caching guild invites:', error);
      }
    }
  }

  /**
   * Update invite cache for a guild
   */
  async updateInviteCache(guild: Guild): Promise<void> {
    await this.cacheGuildInvites(guild);
  }

  /**
   * Find which invite was used by comparing old and new invite data
   */
  async findUsedInvite(guildId: string, newInvites: Collection<string, Invite>): Promise<{
    inviterId: string | null;
    inviterTag: string | null;
    inviteCode: string | null;
    joinType: 'invite' | 'vanity' | 'unknown' | 'oauth';
  }> {
    try {
      // Get cached invites from database
      const cachedInvites = await prisma.inviteCache.findMany({ where: { guildId } });

      // Convert to map for easy lookup
      const oldInvitesMap = new Map(
        cachedInvites.map(inv => [inv.code, inv])
      );

      // Find invite with increased use count
      for (const [code, newInvite] of newInvites) {
        const oldInvite = oldInvitesMap.get(code);

        if (oldInvite && newInvite.uses! > oldInvite.uses) {
          // This invite was used!
          return {
            inviterId: newInvite.inviter?.id || null,
            inviterTag: newInvite.inviter?.tag || null,
            inviteCode: code,
            joinType: code === newInvite.guild?.vanityURLCode ? 'vanity' : 'invite'
          };
        } else if (!oldInvite && newInvite.uses! > 0) {
          // New invite that was immediately used (edge case)
          return {
            inviterId: newInvite.inviter?.id || null,
            inviterTag: newInvite.inviter?.tag || null,
            inviteCode: code,
            joinType: 'invite'
          };
        }
      }

      // Check for vanity URL
      const guild = newInvites.first()?.guild;
      if (guild && 'vanityURLCode' in guild && guild.vanityURLCode) {
        const vanityInvite = newInvites.find(inv => inv.code === guild.vanityURLCode);
        const oldVanity = oldInvitesMap.get(guild.vanityURLCode);

        if (vanityInvite && oldVanity && vanityInvite.uses! > oldVanity.uses) {
          return {
            inviterId: null,
            inviterTag: null,
            inviteCode: guild.vanityURLCode,
            joinType: 'vanity'
          };
        }
      }

      // Could be OAuth2 (bot add), widget, discovery, etc.
      return {
        inviterId: null,
        inviterTag: null,
        inviteCode: null,
        joinType: 'unknown'
      };
    } catch (error) {
      console.error('Error finding used invite:', error);
      return {
        inviterId: null,
        inviterTag: null,
        inviteCode: null,
        joinType: 'unknown'
      };
    }
  }

  /**
   * Store member join data
   */
  async storeMemberJoin(
    guildId: string,
    userId: string,
    inviterId: string | null,
    inviterTag: string | null,
    inviteCode: string | null,
    joinType: 'invite' | 'vanity' | 'unknown' | 'oauth'
  ): Promise<void> {
    await prisma.memberJoinData.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: {
        inviterId,
        inviterTag,
        inviteCode,
        joinType
      },
      create: {
        guildId,
        userId,
        inviterId,
        inviterTag,
        inviteCode,
        joinType
      }
    });
  }

  /**
   * Get member join data
   */
  async getMemberJoinData(guildId: string, userId: string) {
    return await prisma.memberJoinData.findUnique({ where: { guildId_userId: { guildId, userId } } });
  }

  /**
   * Delete member join data (cleanup after leave)
   */
  async deleteMemberJoinData(guildId: string, userId: string): Promise<void> {
    try {
      await prisma.memberJoinData.delete({ where: { guildId_userId: { guildId, userId } } });
    } catch (error) {
      // Ignore if not found
    }
  }

  /**
   * Get total invites for a user in a guild (net invites = total - left - fake + bonus)
   */
  async getUserInviteCount(guildId: string, userId: string): Promise<number> {
    const tracker = await prisma.inviteTracker.findUnique({ where: { guildId_userId: { guildId, userId } } });

    if (!tracker) return 0;

    return tracker.totalInvites - tracker.leftInvites - tracker.fakeInvites + tracker.bonusInvites;
  }

  /**
   * Increment invite count for a user (someone joined using their invite)
   */
  async incrementInvites(guildId: string, userId: string): Promise<number> {
    const tracker = await prisma.inviteTracker.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { totalInvites: { increment: 1 } },
      create: { guildId, userId, totalInvites: 1 }
    });

    return tracker.totalInvites - tracker.leftInvites - tracker.fakeInvites + tracker.bonusInvites;
  }

  /**
   * Decrement invite count when someone leaves (increment leftInvites)
   */
  async decrementInvites(guildId: string, userId: string): Promise<number> {
    const tracker = await prisma.inviteTracker.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { leftInvites: { increment: 1 } },
      create: { guildId, userId, leftInvites: 1 }
    });

    return tracker.totalInvites - tracker.leftInvites - tracker.fakeInvites + tracker.bonusInvites;
  }

  /**
   * Get all members invited by a specific user
   */
  async getMembersInvitedBy(guildId: string, inviterId: string) {
    return await prisma.memberJoinData.findMany({
      where: {
        guildId,
        inviterId,
        joinType: 'invite'
      }
    });
  }

  /**
   * Get invite tracker stats for a user
   */
  async getInviteStats(guildId: string, userId: string) {
    return await prisma.inviteTracker.findUnique({ where: { guildId_userId: { guildId, userId } } });
  }
}
