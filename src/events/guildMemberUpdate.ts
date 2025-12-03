import { Client, GuildMember, PartialGuildMember, AuditLogEvent, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { CONFIG } from '../config';
import { logToChannel } from '../utils/logger';
import { prisma } from '../database/connect';

export const onGuildMemberUpdate = async (client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember) => {
    // 1. Handle Partial Members
    if (oldMember.partial) {
        try { oldMember = await oldMember.fetch(); } catch (e) { console.error('Could not fetch oldMember', e); return; }
    }
    if (newMember.partial) {
        try { newMember = await newMember.fetch(); } catch (e) { console.error('Could not fetch newMember', e); return; }
    }

    // 2. Name Prevention Logic
    if (oldMember.nickname !== newMember.nickname) {
        const newName = newMember.nickname;
        if (newName) {
            try {
                const settings = await prisma.guildConfig.findUnique({ where: { guildId: newMember.guild.id } });
                if (settings && settings.blockedNames && settings.blockedNames.length > 0) {
                    const lowerName = newName.toLowerCase();
                    const isBlocked = settings.blockedNames.some(blocked => lowerName.includes(blocked.toLowerCase()));

                    if (isBlocked) {
                        // Check Audit Logs to see who changed it
                        const fetchedLogs = await newMember.guild.fetchAuditLogs({
                            limit: 1,
                            type: AuditLogEvent.MemberUpdate,
                        });
                        const log = fetchedLogs.entries.first();

                        let executor = log?.executor;

                        // If no log found (rare) or log is old, assume user changed it themselves if they don't have manage nicknames
                        // But to be safe, we only revert if we are sure it wasn't an admin.
                        // Actually, if the user changes their own nickname, the executor is the user.
                        // If the executor is NOT the user AND has ManageNicknames, allow it.
                        // If executor IS the user, revert it.
                        
                        if (log && log.target?.id === newMember.id) {
                            // Check if the change in log matches the nickname change
                            const nickChange = log.changes.find(c => c.key === 'nick');
                            if (nickChange) {
                                // It matches
                            } else {
                                // Might be an old log, be careful.
                                // If we can't verify executor, we might skip or default to revert if user has no perms.
                            }
                        }

                        // Simplified Logic:
                        // If the user who changed it (executor) has ManageNicknames permission, allow it.
                        // Otherwise (user changing own name), revert it.

                        // We need to know WHO changed it.
                        // If we can't find the log, we assume it's the user (safest bet for prevention).

                        let isAuthorized = false;

                        if (log && log.target?.id === newMember.id && log.createdTimestamp > Date.now() - 5000) {
                            if (log.executor) {
                                const executorMember = await newMember.guild.members.fetch(log.executor.id);
                                if (executorMember.permissions.has(PermissionFlagsBits.ManageNicknames) && log.executor.id !== newMember.id) {
                                    isAuthorized = true;
                                }
                            }
                        }

                        if (!isAuthorized) {
                            // Revert
                            await newMember.setNickname(oldMember.nickname || null, 'Name prevention: Blocked name used');

                            try {
                                await newMember.send({
                                    embeds: [new EmbedBuilder()
                                        .setTitle('🚫 Name Not Allowed')
                                        .setDescription(`The name you tried to set contains a blocked word.\nYour name has been reverted.`)
                                    ]
                                });
                            } catch (e) { }
                        }
                    }
                }
            } catch (error) {
                console.error('Error in name prevention:', error);
            }
        }
    }

    // 3. Role Verification Logic (Existing)
    const roleId = CONFIG.ROLES.EARLY_SUPPORTER;
    const oldHasRole = oldMember.roles.cache.has(roleId);
    const newHasRole = newMember.roles.cache.has(roleId);

    if (!oldHasRole && newHasRole) {
        try {
            const fetchedLogs = await newMember.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberRoleUpdate,
            });
            const roleLog = fetchedLogs.entries.first();
            if (!roleLog) return;
            const { executor, target, changes } = roleLog;
            if (target?.id === newMember.id) {
                const roleChange = changes.find(c => c.key === '$add' && (c.new as any[]).some(r => r.id === roleId));
                if (roleChange) {
                    if (executor?.id === client.user?.id) {
                        return;
                    }
                    await newMember.roles.remove(roleId, 'Unauthorized role assignment detected');
                    try {
                        await newMember.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('<:caution:1437997212008185866> Role Removed')
                                .setDescription(`This role is managed ONLY by the verification bot.\nIt has been removed since it was added externally by <@${executor?.id}>.`)
                                .setFooter({ text: 'Unauthorized Assignment' })
                            ]
                        });
                    } catch (e) {
                        console.log('Could not DM user');
                    }
                    await logToChannel(client, `<:caution:1437997212008185866> **Unauthorized Role Add Detected**\nRole removed from <@${newMember.id}>\nAdded by: <@${executor?.id}> <:xieron_staffs:1437995300164730931>`);
                }
            }
        } catch (error) {
            console.error('Error checking audit logs:', error);
        }
    }
};
