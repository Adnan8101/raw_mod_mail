/**
 * Executor - Enforces punishments and cleanup actions
 */

import { PrismaClient } from '@prisma/client';
import { Client, Guild, GuildMember, PermissionsBitField } from 'discord.js';
import { PunishmentType, SecurityEvent, ProtectionAction } from '../types';
import { ConfigService } from '../services/ConfigService';
import { CaseService } from '../services/CaseService';
import { LoggingService } from '../services/LoggingService';

import { ActionLimiter } from './ActionLimiter';

export class Executor {
  // Track locks per guild+executor to prevent duplicate punishments
  private activeLocks: Set<string> = new Set();

  constructor(
    private prisma: PrismaClient,
    private client: Client,
    private configService: ConfigService,
    private caseService: CaseService,
    private loggingService: LoggingService,
    private actionLimiter: ActionLimiter
  ) { }

  /**
   * Execute punishment for a security event
   */
  async executePunishment(event: SecurityEvent, count: number, limit: number, resetTime?: number): Promise<void> {
    const lockKey = `${event.guildId}:${event.userId}`;

    // Check if already processing this executor
    if (this.activeLocks.has(lockKey)) {
      console.log(`Skipping duplicate punishment for ${lockKey}`);
      return;
    }

    // FAILSAFE: Bot should never punish itself
    if (event.userId === this.client.user?.id) {
      console.log('🛡️ Prevented bot self-punishment');
      return;
    }

    try {
      // Acquire lock
      this.activeLocks.add(lockKey);

      // Skip advisory locks for SQLite (PostgreSQL feature)
      // In production with PostgreSQL, enable pg_try_advisory_lock

      // Get punishment configuration (default to BAN if not configured)
      let punishmentConfig = await this.configService.getPunishment(event.guildId, event.action);

      if (!punishmentConfig) {
        console.log(`No punishment configured for ${event.action} in guild ${event.guildId}, defaulting to BAN`);
        // Default punishment: BAN
        punishmentConfig = {
          action: event.action,
          punishment: PunishmentType.BAN,
        };
      }

      // Fetch guild and member
      const guild = await this.client.guilds.fetch(event.guildId);
      const member = await guild.members.fetch(event.userId).catch(() => null);

      if (!member) {
        console.log(`Member ${event.userId} not found in guild ${event.guildId}`);
        return;
      }

      // Safety check: don't punish guild owner
      if (member.id === guild.ownerId) {
        console.log(`Skipping punishment for guild owner ${member.id}`);
        return;
      }

      // Safety check: don't punish if bot can't (role hierarchy)
      if (!this.canPunishMember(guild, member)) {
        console.log(`Cannot punish ${member.id} due to role hierarchy`);
        return;
      }

      // Execute punishment
      let success = false;
      let reason = `Anti-Nuke: ${event.action} limit exceeded (${count}/${limit})`;

      switch (punishmentConfig.punishment) {
        case PunishmentType.BAN:
          success = await this.banMember(guild, member, reason);
          break;
        case PunishmentType.KICK:
          success = await this.kickMember(guild, member, reason);
          break;
        case PunishmentType.TIMEOUT:
          success = await this.timeoutMember(guild, member, reason, punishmentConfig.durationSeconds ?? 600);
          break;
      }

      if (success) {
        // Create case
        const modCase = await this.caseService.createCase({
          guildId: event.guildId,
          targetId: event.userId,
          moderatorId: this.client.user!.id,
          action: punishmentConfig.punishment,
          reason,
          metadata: {
            antiNuke: true,
            triggerAction: event.action,
            count,
            limit,
            auditLogId: event.auditLogId,
          },
        });

        // Log to security channel
        const embed = this.loggingService.createSecurityActionEmbed({
          title: '🚨 Anti-Nuke Action — User Punished',
          executorId: event.userId,
          executorTag: member.user.tag,
          action: event.action,
          limit,
          count,
          punishment: punishmentConfig.punishment,
          caseId: modCase.caseNumber,
          resetTime
        });

        await this.loggingService.logSecurity(event.guildId, embed);

        // REVERSION LOGIC: Undo the actions that triggered this
        await this.revertRecentActions(event.guildId, event.userId, event.action, 60000); // Look back 60s
      }

      // Lock released by in-memory lock timeout
    } finally {
      // Remove in-memory lock
      this.activeLocks.delete(lockKey);
    }
  }

  /**
   * Revert recent actions by a user
   */
  async revertRecentActions(
    guildId: string,
    userId: string,
    action: ProtectionAction,
    windowMs: number
  ): Promise<void> {
    try {
      const actions = await this.actionLimiter.getActionsByUser(guildId, userId, action, windowMs);

      if (actions.length === 0) return;

      console.log(`Reverting ${actions.length} actions for ${userId} in ${guildId}`);

      let revertedCount = 0;
      for (const event of actions) {
        const success = await this.revertAction(event);
        if (success) revertedCount++;
      }

      if (revertedCount > 0) {
        // Log reversion
        const embed = this.loggingService.createSecurityActionEmbed({
          title: '♻️ Anti-Nuke Reversion',
          executorId: userId,
          executorTag: 'System',
          action: action,
          limit: 0,
          count: revertedCount,
          punishment: PunishmentType.BAN, // Just reusing the type for the embed
          caseId: 0,
        });

        // Override description to be more specific
        embed.setDescription(`**Reverted ${revertedCount} actions** of type \`${action}\` performed by <@${userId}>.`);

        await this.loggingService.logSecurity(guildId, embed);
      }

    } catch (error) {
      console.error('Error reverting actions:', error);
    }
  }

  /**
   * Revert a single action
   */
  async revertAction(event: SecurityEvent): Promise<boolean> {
    if (!event.targetId) return false;

    try {
      const guild = await this.client.guilds.fetch(event.guildId);

      switch (event.action) {
        case ProtectionAction.CREATE_CHANNELS:
          const channel = await guild.channels.fetch(event.targetId).catch(() => null);
          if (channel) {
            await channel.delete('Anti-Nuke: Reverting channel creation');
            return true;
          }
          break;

        case ProtectionAction.CREATE_ROLES:
          const role = await guild.roles.fetch(event.targetId).catch(() => null);
          if (role) {
            await role.delete('Anti-Nuke: Reverting role creation');
            return true;
          }
          break;

        case ProtectionAction.ADD_BOTS:
          const bot = await guild.members.fetch(event.targetId).catch(() => null);
          if (bot) {
            await bot.ban({ reason: 'Anti-Nuke: Reverting bot addition' });
            return true;
          }
          break;

        case ProtectionAction.GIVE_ADMIN_ROLE:
          const member = await guild.members.fetch(event.targetId).catch(() => null);
          if (member && event.metadata?.adminRoles) {
            // Try to find the roles mentioned in metadata
            // This is tricky because we only stored names in metadata in AuditLogMonitor
            // But we can try to find roles by name or just check all admin roles on the user
            // Better approach: AuditLogMonitor should store role IDs in metadata if possible
            // For now, let's remove all dangerous roles from the target
            await this.removeDangerousRoles(event.guildId, event.targetId);
            return true;
          }
          break;

        case ProtectionAction.DANGEROUS_PERMS:
          // If a role was given dangerous perms, we should revert that change
          // For now, we can just delete the role if it was just created, or remove the perms
          // But since we don't know if it was just created or updated easily here without more context
          // We will try to remove the dangerous permissions from the role
          const dangerousRole = await guild.roles.fetch(event.targetId).catch(() => null);
          if (dangerousRole) {
            const permissions = dangerousRole.permissions;
            const newPermissions = permissions.remove([
              PermissionsBitField.Flags.Administrator,
              PermissionsBitField.Flags.ManageGuild,
              PermissionsBitField.Flags.ManageRoles,
              PermissionsBitField.Flags.BanMembers,
              PermissionsBitField.Flags.KickMembers,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageWebhooks
            ]);
            await dangerousRole.setPermissions(newPermissions, 'Anti-Nuke: Reverting dangerous permissions');
            return true;
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to revert action ${event.action} on target ${event.targetId}:`, error);
    }
    return false;
  }

  /**
   * Ban a member
   */
  private async banMember(guild: Guild, member: GuildMember, reason: string): Promise<boolean> {
    try {
      await guild.members.ban(member, { reason });
      return true;
    } catch (error) {
      console.error(`Failed to ban ${member.id}:`, error);
      return false;
    }
  }

  /**
   * Kick a member
   */
  private async kickMember(guild: Guild, member: GuildMember, reason: string): Promise<boolean> {
    try {
      await member.kick(reason);
      return true;
    } catch (error) {
      console.error(`Failed to kick ${member.id}:`, error);
      return false;
    }
  }

  /**
   * Timeout a member
   */
  private async timeoutMember(
    guild: Guild,
    member: GuildMember,
    reason: string,
    durationSeconds: number
  ): Promise<boolean> {
    try {
      const timeoutUntil = new Date(Date.now() + durationSeconds * 1000);
      await member.timeout(timeoutUntil.getTime() - Date.now(), reason);
      return true;
    } catch (error) {
      console.error(`Failed to timeout ${member.id}:`, error);
      return false;
    }
  }

  /**
   * Check if bot can punish a member (role hierarchy check)
   */
  private canPunishMember(guild: Guild, member: GuildMember): boolean {
    const botMember = guild.members.me;
    if (!botMember) return false;

    // Check if bot has required permissions
    if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return false;
    }

    // Check role hierarchy
    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return false;
    }

    return true;
  }

  /**
   * Kick all bots (used for ADD_BOTS protection)
   */
  async kickRecentBots(guildId: string, exceptBotId?: string): Promise<number> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const members = await guild.members.fetch();

      let kickCount = 0;
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      for (const [_, member] of members) {
        if (
          member.user.bot &&
          member.id !== this.client.user!.id &&
          member.id !== exceptBotId &&
          member.joinedTimestamp &&
          member.joinedTimestamp > fiveMinutesAgo
        ) {
          try {
            await member.kick('Anti-Nuke: Unauthorized bot addition');
            kickCount++;
          } catch (error) {
            console.error(`Failed to kick bot ${member.id}:`, error);
          }
        }
      }

      return kickCount;
    } catch (error) {
      console.error(`Failed to kick bots in guild ${guildId}:`, error);
      return 0;
    }
  }

  /**
   * Remove dangerous roles from a user
   */
  async removeDangerousRoles(guildId: string, userId: string): Promise<number> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      let removeCount = 0;

      for (const [_, role] of member.roles.cache) {
        if (
          role.permissions.has(PermissionsBitField.Flags.Administrator) ||
          role.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
          role.permissions.has(PermissionsBitField.Flags.ManageRoles)
        ) {
          try {
            await member.roles.remove(role, 'Anti-Nuke: Dangerous role detected');
            removeCount++;
          } catch (error) {
            console.error(`Failed to remove role ${role.id}:`, error);
          }
        }
      }

      return removeCount;
    } catch (error) {
      console.error(`Failed to remove dangerous roles from ${userId}:`, error);
      return 0;
    }
  }
}
