import { PermissionFlagsBits } from 'discord.js';
import { PanelData } from './db/postgresDB';

export class PermissionHelper {
  /**
   * Check if user is staff based on panel configuration
   */
  static isStaff(member: any, panel: PanelData | null, hasManageChannels: boolean): boolean {
    if (!member || !panel) return hasManageChannels;
    
    const hasStaffRole = member.roles?.cache?.has(panel.staffRole || '');
    return hasStaffRole || hasManageChannels;
  }

  /**
   * Check if user is owner or staff
   */
  static isOwnerOrStaff(userId: string, ownerId: string, member: any, panel: PanelData | null, hasManageChannels: boolean): boolean {
    const isOwner = userId === ownerId;
    const isStaff = this.isStaff(member, panel, hasManageChannels);
    
    return isOwner || isStaff;
  }

  /**
   * Check if user can close ticket based on panel settings
   */
  static canCloseTicket(userId: string, ownerId: string, member: any, panel: PanelData | null, hasManageChannels: boolean): boolean {
    const isOwner = userId === ownerId;
    const isStaff = this.isStaff(member, panel, hasManageChannels);
    
    // Staff can always close
    if (isStaff) return true;
    
    // Owner can close only if panel allows it (default: true)
    if (isOwner && panel?.allowOwnerClose !== false) return true;
    
    return false;
  }

  /**
   * Map permission names to Discord PermissionFlagsBits
   */
  static mapPermissionsToFlags(permissions: string[]): bigint[] {
    const permissionMap: Record<string, bigint> = {
      'ViewChannel': PermissionFlagsBits.ViewChannel,
      'SendMessages': PermissionFlagsBits.SendMessages,
      'ReadMessageHistory': PermissionFlagsBits.ReadMessageHistory,
      'AttachFiles': PermissionFlagsBits.AttachFiles,
      'EmbedLinks': PermissionFlagsBits.EmbedLinks,
      'AddReactions': PermissionFlagsBits.AddReactions,
      'UseExternalEmojis': PermissionFlagsBits.UseExternalEmojis,
      'MentionEveryone': PermissionFlagsBits.MentionEveryone,
      'ManageMessages': PermissionFlagsBits.ManageMessages,
      'ManageChannels': PermissionFlagsBits.ManageChannels,
      'CreatePublicThreads': PermissionFlagsBits.CreatePublicThreads,
      'CreatePrivateThreads': PermissionFlagsBits.CreatePrivateThreads,
      'SendMessagesInThreads': PermissionFlagsBits.SendMessagesInThreads,
      'UseApplicationCommands': PermissionFlagsBits.UseApplicationCommands,
    };

    return permissions
      .map(perm => permissionMap[perm])
      .filter(flag => flag !== undefined);
  }
}
