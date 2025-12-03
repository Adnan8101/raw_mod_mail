/**
 * DatabaseManager - Implementation for invite tracking, welcome/leave, and server stats
 * Integrates with Prisma database
 */

import { prisma } from '../database/connect';

export class DatabaseManager {
  private static instance: DatabaseManager;



  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  // ===========================
  // Welcome/Leave Configuration
  // ===========================

  async setWelcomeChannel(guildId: string, channelId: string): Promise<void> {
    try {
      await prisma.welcomeConfig.upsert({
        where: { guildId },
        update: { welcomeChannelId: channelId, welcomeEnabled: true },
        create: { guildId, welcomeChannelId: channelId, welcomeEnabled: true }
      });
    } catch (error) {
      console.error('Failed to set welcome channel:', error);
      throw error;
    }
  }

  async getWelcomeChannel(guildId: string): Promise<string | null> {
    try {
      const config = await prisma.welcomeConfig.findUnique({ where: { guildId } });
      return config?.welcomeChannelId || null;
    } catch (error) {
      console.error('Failed to get welcome channel:', error);
      return null;
    }
  }

  async setLeaveChannel(guildId: string, channelId: string): Promise<void> {
    try {
      await prisma.welcomeConfig.upsert({
        where: { guildId },
        update: { leaveChannelId: channelId, leaveEnabled: true },
        create: { guildId, leaveChannelId: channelId, leaveEnabled: true }
      });
    } catch (error) {
      console.error('Failed to set leave channel:', error);
      throw error;
    }
  }

  async getLeaveChannel(guildId: string): Promise<string | null> {
    try {
      const config = await prisma.welcomeConfig.findUnique({ where: { guildId } });
      return config?.leaveChannelId || null;
    } catch (error) {
      console.error('Failed to get leave channel:', error);
      return null;
    }
  }

  async getWelcomeConfig(guildId: string): Promise<{
    channelId: string | null;
    message: string | null;
    enabled: boolean;
    welcomeChannelId: string | null;
    leaveChannelId: string | null;
    welcomeEnabled: boolean;
    leaveEnabled: boolean;
    welcomeMessage: string | null;
    leaveMessage: string | null;
  }> {
    try {
      const config = await prisma.welcomeConfig.findUnique({ where: { guildId } });

      return {
        channelId: config?.welcomeChannelId || null,
        message: config?.welcomeMessage || null,
        enabled: config?.welcomeEnabled || false,
        welcomeChannelId: config?.welcomeChannelId || null,
        leaveChannelId: config?.leaveChannelId || null,
        welcomeEnabled: config?.welcomeEnabled || false,
        leaveEnabled: config?.leaveEnabled || false,
        welcomeMessage: config?.welcomeMessage || null,
        leaveMessage: config?.leaveMessage || null
      };
    } catch (error) {
      console.error('Failed to get welcome config:', error);
      return {
        channelId: null,
        message: null,
        enabled: false,
        welcomeChannelId: null,
        leaveChannelId: null,
        welcomeEnabled: false,
        leaveEnabled: false,
        welcomeMessage: null,
        leaveMessage: null
      };
    }
  }

  // ===========================
  // Invite tracking methods
  // ===========================

  async getUserInviteCount(guildId: string, userId: string): Promise<number> {
    try {
      const tracker = await prisma.inviteTracker.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      return tracker?.totalInvites || 0;
    } catch (error) {
      console.error('Failed to get user invite count:', error);
      return 0;
    }
  }

  async getUserLeftCount(guildId: string, userId: string): Promise<number> {
    try {
      const tracker = await prisma.inviteTracker.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      return tracker?.leftInvites || 0;
    } catch (error) {
      console.error('Failed to get user left count:', error);
      return 0;
    }
  }

  async getUserFakeCount(guildId: string, userId: string): Promise<number> {
    try {
      const tracker = await prisma.inviteTracker.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      return tracker?.fakeInvites || 0;
    } catch (error) {
      console.error('Failed to get user fake count:', error);
      return 0;
    }
  }

  async getUserBonusInvites(guildId: string, userId: string): Promise<number> {
    try {
      const tracker = await prisma.inviteTracker.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      return tracker?.bonusInvites || 0;
    } catch (error) {
      console.error('Failed to get user bonus invites:', error);
      return 0;
    }
  }

  async addBonusInvites(guildId: string, userId: string, amount: number): Promise<void> {
    try {
      await prisma.inviteTracker.upsert({
        where: { guildId_userId: { guildId, userId } },
        update: { bonusInvites: { increment: amount } },
        create: { guildId, userId, bonusInvites: amount }
      });
    } catch (error) {
      console.error('Failed to add bonus invites:', error);
    }
  }

  async removeBonusInvites(guildId: string, userId: string, amount: number): Promise<void> {
    try {
      await prisma.inviteTracker.upsert({
        where: { guildId_userId: { guildId, userId } },
        update: { bonusInvites: { increment: -amount } },
        create: { guildId, userId, bonusInvites: -amount }
      });
    } catch (error) {
      console.error('Failed to remove bonus invites:', error);
    }
  }

  async removeNormalInvites(guildId: string, userId: string, amount: number): Promise<number> {
    try {
      const tracker = await prisma.inviteTracker.upsert({
        where: { guildId_userId: { guildId, userId } },
        update: { totalInvites: { increment: -amount } },
        create: { guildId, userId, totalInvites: -amount }
      });
      return tracker.totalInvites;
    } catch (error) {
      console.error('Failed to remove normal invites:', error);
      return 0;
    }
  }

  async resetInvites(guildId: string, userId: string): Promise<void> {
    try {
      await prisma.inviteTracker.delete({
        where: { guildId_userId: { guildId, userId } }
      });
    } catch (error) {
      // Ignore if not found
    }
  }

  async resetUserInvites(guildId: string, userId: string): Promise<{ regular: number; left: number; fake: number; bonus: number; normalRemoved: number; bonusRemoved: number }> {
    try {
      const tracker = await prisma.inviteTracker.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });

      if (!tracker) {
        return { regular: 0, left: 0, fake: 0, bonus: 0, normalRemoved: 0, bonusRemoved: 0 };
      }

      await prisma.inviteTracker.delete({
        where: { guildId_userId: { guildId, userId } }
      });

      return {
        regular: tracker.totalInvites,
        left: tracker.leftInvites,
        fake: tracker.fakeInvites,
        bonus: tracker.bonusInvites,
        normalRemoved: tracker.totalInvites,
        bonusRemoved: tracker.bonusInvites
      };
    } catch (error) {
      console.error('Failed to reset user invites:', error);
      return { regular: 0, left: 0, fake: 0, bonus: 0, normalRemoved: 0, bonusRemoved: 0 };
    }
  }

  async getInviteData(guildId: string, userId: string): Promise<{ inviterId: string | null; inviteCode: string | null; isVanity: boolean }> {
    try {
      const data = await prisma.memberJoinData.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });

      return {
        inviterId: data?.inviterId || null,
        inviteCode: data?.inviteCode || null,
        isVanity: data?.joinType === 'vanity'
      };
    } catch (error) {
      console.error('Failed to get invite data:', error);
      return { inviterId: null, inviteCode: null, isVanity: false };
    }
  }

  async getInviteTrackers(guildId: string, userId: string): Promise<Array<{ inviteCode: string; uses: number; createdAt: Date; expiresAt: Date | null; maxUses: number | null }>> {
    try {
      const invites = await prisma.inviteCache.findMany({
        where: { guildId, inviterId: userId }
      });

      return invites.map(inv => ({
        inviteCode: inv.code,
        uses: inv.uses,
        createdAt: inv.createdAt,
        expiresAt: null,
        maxUses: inv.maxUses || null
      }));
    } catch (error) {
      console.error('Failed to get invite trackers:', error);
      return [];
    }
  }

  // ===========================
  // Server stats panel methods
  // ===========================

  async createPanel(data: {
    guildId: string;
    panelName: string;
    channelType: 'vc' | 'text';
    categoryId: string;
    totalChannelId: string;
    usersChannelId: string;
    botsChannelId: string;
    onlineChannelId?: string;
    idleChannelId?: string;
    dndChannelId?: string;
    offlineChannelId?: string;
  }): Promise<void> {
    try {
      await prisma.serverStatsPanel.create({ data });
    } catch (error) {
      console.error('Failed to create stats panel:', error);
      throw error;
    }
  }

  async getPanel(guildId: string, panelName: string): Promise<any> {
    try {
      return await prisma.serverStatsPanel.findUnique({
        where: { guildId_panelName: { guildId, panelName } }
      });
    } catch (error) {
      console.error('Failed to get stats panel:', error);
      return null;
    }
  }

  async getPanels(guildId: string): Promise<any[]> {
    try {
      return await prisma.serverStatsPanel.findMany({ where: { guildId } });
    } catch (error) {
      console.error('Failed to get stats panels:', error);
      return [];
    }
  }

  async getAllPanels(): Promise<any[]> {
    try {
      return await prisma.serverStatsPanel.findMany();
    } catch (error) {
      console.error('Failed to get all stats panels:', error);
      return [];
    }
  }

  async deletePanel(guildId: string, panelName: string): Promise<boolean> {
    try {
      const result = await prisma.serverStatsPanel.delete({
        where: { guildId_panelName: { guildId, panelName } }
      });
      return !!result;
    } catch (error) {
      console.error('Failed to delete stats panel:', error);
      return false;
    }
  }

  // ===========================
  // User Stats (Messages & Voice)
  // ===========================

  // ===========================
  // User Stats (Messages & Voice)
  // ===========================

  private messageCountBuffer: Map<string, number> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startFlushInterval();
  }

  private startFlushInterval() {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => this.flushMessageCounts(), 60000); // Flush every 60 seconds
  }

  private async flushMessageCounts() {
    if (this.messageCountBuffer.size === 0) return;

    const buffer = new Map(this.messageCountBuffer);
    this.messageCountBuffer.clear();

    for (const [key, count] of buffer.entries()) {
      const [guildId, userId] = key.split(':');
      try {
        await prisma.userStats.upsert({
          where: { guildId_userId: { guildId, userId } },
          update: { messageCount: { increment: count } },
          create: { guildId, userId, messageCount: count }
        });
      } catch (error) {
        console.error(`Failed to flush message count for ${guildId}:${userId}`, error);
      }
    }
  }

  async incrementMessageCount(guildId: string, userId: string): Promise<void> {
    const key = `${guildId}:${userId}`;
    const currentCount = this.messageCountBuffer.get(key) || 0;
    this.messageCountBuffer.set(key, currentCount + 1);
  }

  async addVoiceMinutes(guildId: string, userId: string, minutes: number): Promise<void> {
    try {
      await prisma.userStats.upsert({
        where: { guildId_userId: { guildId, userId } },
        update: { voiceMinutes: { increment: minutes } },
        create: { guildId, userId, voiceMinutes: minutes }
      });
    } catch (error) {
      console.error('Failed to add voice minutes:', error);
    }
  }

  async getUserStats(guildId: string, userId: string): Promise<{ messageCount: number; voiceMinutes: number } | null> {
    try {
      const stats = await prisma.userStats.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      return stats ? { messageCount: stats.messageCount, voiceMinutes: stats.voiceMinutes } : null;
    } catch (error) {
      console.error('Failed to get user stats:', error);
      return null;
    }
  }

  // ===========================
  // Voice System (AutoDrag & AFK)
  // ===========================

  async createAutoDragRule(guildId: string, userId: string, targetChannelId: string, createdBy: string): Promise<void> {
    try {
      await prisma.autoDragRule.upsert({
        where: { guildId_userId: { guildId, userId } },
        update: { targetChannelId, createdBy },
        create: { guildId, userId, targetChannelId, createdBy }
      });
    } catch (error) {
      console.error('Failed to create autodrag rule:', error);
      throw error;
    }
  }

  async getAutoDragRule(guildId: string, userId: string): Promise<string | null> {
    try {
      const rule = await prisma.autoDragRule.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      return rule?.targetChannelId || null;
    } catch (error) {
      console.error('Failed to get autodrag rule:', error);
      return null;
    }
  }

  async deleteAutoDragRule(guildId: string, userId: string): Promise<void> {
    try {
      await prisma.autoDragRule.delete({
        where: { guildId_userId: { guildId, userId } }
      });
    } catch (error) {
      // Ignore if not found
    }
  }

  async setAutoAFKSettings(guildId: string, enabled: boolean, minutes: number, afkChannelId: string): Promise<void> {
    try {
      await prisma.autoAFKSettings.upsert({
        where: { guildId },
        update: { enabled, minutes, afkChannelId },
        create: { guildId, enabled, minutes, afkChannelId }
      });
    } catch (error) {
      console.error('Failed to set auto AFK settings:', error);
      throw error;
    }
  }

  async getAutoAFKSettings(guildId: string): Promise<any> {
    try {
      return await prisma.autoAFKSettings.findUnique({ where: { guildId } });
    } catch (error) {
      console.error('Failed to get auto AFK settings:', error);
      return null;
    }
  }

  // ===========================
  // Giveaway System
  // ===========================

  async createGiveaway(data: any): Promise<string> {
    try {
      // Ensure data matches Prisma schema
      // Mongoose schema had participants and winners as arrays of strings
      // Prisma has them as relations.
      // If data comes with participants/winners as arrays, we need to handle them or ignore them if empty initially.

      const { participants, winners, ...giveawayData } = data;

      const giveaway = await prisma.giveaway.create({
        data: {
          ...giveawayData,
          // If we need to create initial participants/winners, we'd do it here, but usually a new giveaway has none.
        }
      });
      return giveaway.messageId;
    } catch (error) {
      console.error('Failed to create giveaway:', error);
      throw error;
    }
  }

  async getGiveaway(messageId: string): Promise<any> {
    try {
      const giveaway = await prisma.giveaway.findUnique({
        where: { messageId },
        include: {
          participants: true,
          winners: true
        }
      });

      if (!giveaway) return null;

      // Map back to expected format if needed (arrays of userIds)
      return {
        ...giveaway,
        participants: giveaway.participants.map(p => p.userId),
        winners: giveaway.winners.map(w => w.userId)
      };
    } catch (error) {
      console.error('Failed to get giveaway:', error);
      return null;
    }
  }

  async getActiveGiveaways(): Promise<any[]> {
    try {
      const giveaways = await prisma.giveaway.findMany({
        where: { ended: false },
        include: {
          participants: true,
          winners: true
        }
      });

      return giveaways.map(g => ({
        ...g,
        participants: g.participants.map(p => p.userId),
        winners: g.winners.map(w => w.userId)
      }));
    } catch (error) {
      console.error('Failed to get active giveaways:', error);
      return [];
    }
  }

  async endGiveaway(messageId: string): Promise<void> {
    try {
      await prisma.giveaway.update({
        where: { messageId },
        data: { ended: true }
      });
    } catch (error) {
      console.error('Failed to end giveaway:', error);
      throw error;
    }
  }

  async addGiveawayParticipant(giveawayId: string, userId: string): Promise<void> {
    try {
      // giveawayId is messageId
      const giveaway = await prisma.giveaway.findUnique({ where: { messageId: giveawayId } });
      if (!giveaway) return;

      await prisma.giveawayParticipant.create({
        data: {
          giveawayId: giveaway.id, // Use internal ID
          userId
        }
      });
    } catch (error) {
      console.error('Failed to add giveaway participant:', error);
    }
  }

  async getGiveawayParticipants(giveawayId: string): Promise<string[]> {
    try {
      const giveaway = await prisma.giveaway.findUnique({
        where: { messageId: giveawayId },
        include: { participants: true }
      });
      return giveaway?.participants.map(p => p.userId) || [];
    } catch (error) {
      console.error('Failed to get giveaway participants:', error);
      return [];
    }
  }

  async addGiveawayWinner(giveawayId: string, userId: string): Promise<void> {
    try {
      const giveaway = await prisma.giveaway.findUnique({ where: { messageId: giveawayId } });
      if (!giveaway) return;

      await prisma.giveawayWinner.create({
        data: {
          giveawayId: giveaway.id,
          userId
        }
      });
    } catch (error) {
      console.error('Failed to add giveaway winner:', error);
    }
  }
}

