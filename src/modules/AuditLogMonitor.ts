/**
 * AuditLogMonitor - Monitors audit log and correlates with gateway events
 * Emits SecurityEvents for processing by ActionLimiter
 */

import {
  Client,
  Guild,
  AuditLogEvent,
  GuildAuditLogsEntry,
  Events,
  GuildMember,
  Role,
  GuildChannel,
  User,
} from 'discord.js';
import { EventEmitter } from 'events';
import { ProtectionAction, SecurityEvent, WhitelistCategory } from '../types';
import { ConfigService } from '../services/ConfigService';
import { WhitelistService } from '../services/WhitelistService';
import { ActionLimiter } from './ActionLimiter';
import { Executor } from './Executor';

export class AuditLogMonitor extends EventEmitter {
  private processedLogIds: Set<string> = new Set();

  constructor(
    private client: Client,
    private configService: ConfigService,
    private whitelistService: WhitelistService,
    private actionLimiter: ActionLimiter,
    private executor: Executor
  ) {
    super();
    this.setupEventListeners();
  }

  /**
   * Setup Discord gateway event listeners
   */
  private setupEventListeners(): void {
    // Member events
    this.client.on(Events.GuildBanAdd, async (ban) => {
      await this.handleMemberBan(ban.guild, ban.user);
    });

    this.client.on(Events.GuildMemberRemove, async (member) => {
      if (member.partial) return; // Skip partial members
      await this.handleMemberRemove(member);
    });

    this.client.on(Events.GuildMemberAdd, async (member) => {
      if (member.user.bot) {
        await this.handleBotAdd(member);
      }
    });

    // Role events
    this.client.on(Events.GuildRoleCreate, async (role) => {
      await this.handleRoleCreate(role);
    });

    this.client.on(Events.GuildRoleDelete, async (role) => {
      await this.handleRoleDelete(role);
    });

    this.client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
      await this.handleRoleUpdate(oldRole, newRole);
    });

    // Channel events
    this.client.on(Events.ChannelCreate, async (channel) => {
      if (channel.isDMBased()) return;
      await this.handleChannelCreate(channel as GuildChannel);
    });

    this.client.on(Events.ChannelDelete, async (channel) => {
      if (channel.isDMBased()) return;
      await this.handleChannelDelete(channel as GuildChannel);
    });

    // Member update for role changes
    this.client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
      if (oldMember.partial || newMember.partial) return; // Skip partials
      await this.handleMemberUpdate(oldMember, newMember);
    });

    console.log('✔ AuditLogMonitor: Event listeners registered');
  }

  /**
   * Handle member ban
   */
  private async handleMemberBan(guild: Guild, user: User): Promise<void> {
    const guildId = guild.id;

    // Check if anti-nuke is enabled
    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    // Check if BAN_MEMBERS protection is active
    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.BAN_MEMBERS
    );
    if (!protectionActive) return;

    // Fetch audit log to find executor
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanAdd,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    // Skip if action is old (more than 5 seconds)
    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.BAN_MEMBERS,
      targetId: user.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        targetTag: user.tag,
        reason: auditEntry.reason,
      },
    });
  }

  /**
   * Handle member remove (could be kick)
   */
  private async handleMemberRemove(member: GuildMember): Promise<void> {
    const guildId = member.guild.id;

    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.KICK_MEMBERS
    );
    if (!protectionActive) return;

    // Fetch audit log
    const auditLogs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberKick,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    // Check if target matches
    if (auditEntry.target?.id !== member.id) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.KICK_MEMBERS,
      targetId: member.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        targetTag: member.user.tag,
        reason: auditEntry.reason,
      },
    });
  }

  /**
   * Handle bot add
   */
  private async handleBotAdd(member: GuildMember): Promise<void> {
    const guildId = member.guild.id;

    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    // Skip the bot itself
    if (member.id === this.client.user?.id) return;

    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.ADD_BOTS
    );
    if (!protectionActive) return;

    // Fetch audit log
    const auditLogs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.BotAdd,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.ADD_BOTS,
      targetId: member.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        botTag: member.user.tag,
      },
    });
  }

  /**
   * Handle role creation
   */
  private async handleRoleCreate(role: Role): Promise<void> {
    const guildId = role.guild.id;

    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.CREATE_ROLES
    );
    if (!protectionActive) return;

    // Fetch audit log
    const auditLogs = await role.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleCreate,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.CREATE_ROLES,
      targetId: role.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        roleName: role.name,
      },
    });
  }

  /**
   * Handle role deletion
   */
  private async handleRoleDelete(role: Role): Promise<void> {
    const guildId = role.guild.id;

    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.DELETE_ROLES
    );
    if (!protectionActive) return;

    // Fetch audit log
    const auditLogs = await role.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleDelete,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.DELETE_ROLES,
      targetId: role.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        roleName: role.name,
      },
    });
  }

  /**
   * Handle role update (check for dangerous permissions)
   */
  private async handleRoleUpdate(oldRole: Role, newRole: Role): Promise<void> {
    const guildId = newRole.guild.id;

    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.DANGEROUS_PERMS
    );
    if (!protectionActive) return;

    // Check if dangerous permissions were added
    const oldPerms = oldRole.permissions.toArray();
    const newPerms = newRole.permissions.toArray();
    const addedPerms = newPerms.filter(p => !oldPerms.includes(p));

    const dangerousPerms = ['ManageGuild', 'ManageRoles', 'BanMembers', 'KickMembers', 'ManageChannels'];
    const addedDangerous = addedPerms.filter(p => dangerousPerms.includes(p));

    if (addedDangerous.length === 0) return;

    // Fetch audit log
    const auditLogs = await newRole.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleUpdate,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.DANGEROUS_PERMS,
      targetId: newRole.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        roleName: newRole.name,
        addedPermissions: addedDangerous,
      },
    });
  }

  /**
   * Handle channel creation
   */
  private async handleChannelCreate(channel: GuildChannel): Promise<void> {
    const guildId = channel.guild.id;

    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.CREATE_CHANNELS
    );
    if (!protectionActive) return;

    // Fetch audit log
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelCreate,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.CREATE_CHANNELS,
      targetId: channel.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        channelName: channel.name,
      },
    });
  }

  /**
   * Handle channel deletion
   */
  private async handleChannelDelete(channel: GuildChannel): Promise<void> {
    const guildId = channel.guild.id;

    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.DELETE_CHANNELS
    );
    if (!protectionActive) return;

    // Fetch audit log
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.DELETE_CHANNELS,
      targetId: channel.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        channelName: channel.name,
      },
    });
  }

  /**
   * Handle member update (role changes)
   */
  private async handleMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    const guildId = newMember.guild.id;

    const enabled = await this.configService.isEnabled(guildId);
    if (!enabled) return;

    const protectionActive = await this.configService.isProtectionEnabled(
      guildId,
      ProtectionAction.GIVE_ADMIN_ROLE
    );
    if (!protectionActive) return;

    // Check if admin role was added
    const oldRoleIds = oldMember.roles.cache.map(r => r.id);
    const newRoleIds = newMember.roles.cache.map(r => r.id);
    const addedRoleIds = newRoleIds.filter(id => !oldRoleIds.includes(id));

    if (addedRoleIds.length === 0) return;

    // Check if any added role has admin permissions
    const addedRoles = addedRoleIds.map(id => newMember.guild.roles.cache.get(id)).filter(Boolean) as Role[];
    const adminRoles = addedRoles.filter(r => r.permissions.has('Administrator'));

    if (adminRoles.length === 0) return;

    // Fetch audit log
    const auditLogs = await newMember.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberRoleUpdate,
      limit: 1,
    }).catch(() => null);

    if (!auditLogs || auditLogs.entries.size === 0) return;

    const auditEntry = auditLogs.entries.first();
    if (!auditEntry || !auditEntry.executor) return;

    // Ignore actions by the bot itself
    if (auditEntry.executor.id === this.client.user?.id) return;

    const ageMs = Date.now() - auditEntry.createdTimestamp;
    if (ageMs > 5000) return;

    await this.processSecurityEvent({
      guildId,
      userId: auditEntry.executor.id,
      action: ProtectionAction.GIVE_ADMIN_ROLE,
      targetId: newMember.id,
      auditLogId: auditEntry.id,
      timestamp: new Date(auditEntry.createdTimestamp),
      metadata: {
        targetTag: newMember.user.tag,
        adminRoles: adminRoles.map(r => r.name),
      },
    });
  }

  /**
   * Process a security event through the full pipeline
   */
  private async processSecurityEvent(event: SecurityEvent): Promise<void> {
    // Deduplicate by Audit Log ID
    if (event.auditLogId) {
      if (this.processedLogIds.has(event.auditLogId)) return;

      this.processedLogIds.add(event.auditLogId);
      // Cleanup after 10 seconds
      setTimeout(() => {
        if (event.auditLogId) this.processedLogIds.delete(event.auditLogId);
      }, 10000);
    }

    try {
      // 1. Check whitelist first
      const guild = await this.client.guilds.fetch(event.guildId).catch(() => null);
      if (!guild) return;

      const member = await guild.members.fetch(event.userId).catch(() => null);
      if (!member) return;

      // Skip guild owner
      if (member.id === guild.ownerId) {
        console.log(`Skipping security event for guild owner: ${member.user.tag}`);
        return;
      }

      // Check whitelist
      const roleIds = member.roles.cache.map(r => r.id);
      const whitelisted = await this.whitelistService.isWhitelisted(
        event.guildId,
        event.userId,
        roleIds,
        event.action as unknown as WhitelistCategory
      );

      if (whitelisted) {
        console.log(`User ${member.user.tag} is whitelisted for ${event.action}`);
        return;
      }

      // 2. Record and check limit
      const result = await this.actionLimiter.recordAndCheck(event);

      if (result.limitExceeded) {
        console.log(
          `🚨 Limit exceeded: ${member.user.tag} - ${event.action} (${result.count}/${result.limit})`
        );

        // 3. Execute punishment
        await this.executor.executePunishment(event, result.count, result.limit!, result.resetTime);

        // Emit event for external listeners
        this.emit('limitExceeded', { event, count: result.count, limit: result.limit });
      } else {
        console.log(
          `✔ Action within limit: ${member.user.tag} - ${event.action} (${result.count}${result.limit ? `/${result.limit}` : ''})`
        );
      }
    } catch (error) {
      console.error('Error processing security event:', error);
    }
  }
}
