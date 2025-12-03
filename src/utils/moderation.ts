/**
 * Moderation Utility Functions
 */

import { GuildMember, PermissionFlagsBits, PermissionsBitField } from 'discord.js';

/**
 * Check if moderator has permission and higher role than target
 */
export function canModerate(
  moderator: GuildMember,
  target: GuildMember,
  permission: bigint
): { allowed: boolean; reason?: string } {
  // Owner can always moderate
  if (moderator.id === moderator.guild.ownerId) {
    return { allowed: true };
  }

  // Cannot moderate yourself
  if (moderator.id === target.id) {
    return { allowed: false, reason: 'You cannot moderate yourself.' };
  }

  // Cannot moderate the server owner
  if (target.id === target.guild.ownerId) {
    return { allowed: false, reason: 'You cannot moderate the server owner.' };
  }

  // Check if moderator has the required permission
  if (!moderator.permissions.has(permission)) {
    return { allowed: false, reason: 'You do not have the required permission.' };
  }

  // Special check for Timeout (ModerateMembers): Cannot timeout Administrators
  if (permission === PermissionFlagsBits.ModerateMembers && target.permissions.has(PermissionFlagsBits.Administrator)) {
    return { allowed: false, reason: 'Members with Administrator permission cannot be timed out.' };
  }

  // Check role hierarchy
  if (moderator.roles.highest.position <= target.roles.highest.position) {
    return { allowed: false, reason: 'You cannot moderate someone with an equal or higher role.' };
  }

  return { allowed: true };
}

/**
 * Check if bot can moderate a member
 */
export function botCanModerate(
  bot: GuildMember,
  target: GuildMember,
  permission: bigint
): { allowed: boolean; reason?: string } {
  // Cannot moderate the server owner
  if (target.id === target.guild.ownerId) {
    return { allowed: false, reason: 'I cannot moderate the server owner.' };
  }

  // Check if bot has the required permission
  if (!bot.permissions.has(permission)) {
    return { allowed: false, reason: 'I do not have the required permission.' };
  }

  // Special check for Timeout (ModerateMembers): Cannot timeout Administrators
  if (permission === PermissionFlagsBits.ModerateMembers && target.permissions.has(PermissionFlagsBits.Administrator)) {
    return { allowed: false, reason: 'I cannot mute/timeout a member with Administrator permissions.' };
  }

  // Check role hierarchy
  if (bot.roles.highest.position <= target.roles.highest.position) {
    return { allowed: false, reason: 'I cannot moderate someone with an equal or higher role than mine.' };
  }

  return { allowed: true };
}

/**
 * Parse duration string to milliseconds
 * Examples: 5s, 10m, 1h, 2d
 */
export function parseDuration(durationStr: string): number | null {
  const regex = /^(\d+)([smhd])$/;
  const match = durationStr.toLowerCase().match(regex);

  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,           // seconds
    m: 60 * 1000,      // minutes
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000, // days
  };

  return value * multipliers[unit];
}

/**
 * Format milliseconds to human readable duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Get permission name for display
 */
export function getPermissionName(permission: bigint): string {
  const names: Record<string, string> = {
    [PermissionFlagsBits.BanMembers.toString()]: 'Ban Members',
    [PermissionFlagsBits.KickMembers.toString()]: 'Kick Members',
    [PermissionFlagsBits.ModerateMembers.toString()]: 'Moderate Members (Timeout)',
    [PermissionFlagsBits.ManageChannels.toString()]: 'Manage Channels',
    [PermissionFlagsBits.ManageRoles.toString()]: 'Manage Roles',
    [PermissionFlagsBits.ManageNicknames.toString()]: 'Manage Nicknames',
  };

  return names[permission.toString()] || 'Unknown Permission';
}
