/**
 * AutoMod Service - Manages automod configuration
 */

import { PrismaClient } from '@prisma/client';

export class AutoModService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getConfig(guildId: string, type: string) {
    return this.prisma.autoModConfig.findUnique({
      where: { guildId_type: { guildId, type } },
    });
  }

  async upsertConfig(guildId: string, type: string, data: any) {
    return this.prisma.autoModConfig.upsert({
      where: { guildId_type: { guildId, type } },
      create: {
        guildId,
        type,
        ...data,
      },
      update: data,
    });
  }

  async updateConfig(guildId: string, type: string, data: any) {
    return this.prisma.autoModConfig.update({
      where: { guildId_type: { guildId, type } },
      data,
    });
  }

  async disableAll(guildId: string) {
    return this.prisma.autoModConfig.updateMany({
      where: { guildId },
      data: { enabled: false },
    });
  }

  async getWhitelists(guildId: string, type: string) {
    return this.prisma.autoModWhitelist.findMany({
      where: { guildId, type },
    });
  }

  async getAllWhitelists(guildId: string, type: string) {
    // Get both feature-specific and global whitelists
    return this.prisma.autoModWhitelist.findMany({
      where: {
        guildId,
        OR: [
          { type: type },
          { type: 'global' },
          { type: 'all' }
        ]
      }
    });
  }

  async addWhitelist(guildId: string, type: string, targetId: string, targetType: string, createdBy: string) {
    return this.prisma.autoModWhitelist.upsert({
      where: { guildId_type_targetId: { guildId, type, targetId } },
      create: {
        guildId,
        type,
        targetId,
        targetType,
        createdBy,
      },
      update: {},
    });
  }

  async removeWhitelist(guildId: string, type: string, targetId: string) {
    return this.prisma.autoModWhitelist.delete({
      where: { guildId_type_targetId: { guildId, type, targetId } },
    });
  }
}
