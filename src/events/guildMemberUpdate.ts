import { Client, GuildMember, PartialGuildMember, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config';
import { logToChannel } from '../utils/logger';

export const onGuildMemberUpdate = async (client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember) => {
    // Check if Early Supporter role was added
    const roleId = CONFIG.ROLES.EARLY_SUPPORTER;

    // If partial, we might not have roles. But usually for role updates we do.
    // If we need to be safe:
    if (oldMember.partial) {
        try {
            oldMember = await oldMember.fetch();
        } catch (e) {
            console.error('Could not fetch oldMember', e);
            return;
        }
    }
    if (newMember.partial) {
        try {
            newMember = await newMember.fetch();
        } catch (e) {
            console.error('Could not fetch newMember', e);
            return;
        }
    }

    const oldHasRole = oldMember.roles.cache.has(roleId);
    const newHasRole = newMember.roles.cache.has(roleId);

    if (!oldHasRole && newHasRole) {
        // Role was added. Check who added it.
        try {
            const fetchedLogs = await newMember.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberRoleUpdate,
            });

            const roleLog = fetchedLogs.entries.first();

            // If no log found, or the target isn't the member, we can't be sure. 
            // But usually the latest log is the one.
            if (!roleLog) return;

            const { executor, target, changes } = roleLog;

            // Check if the log is for the correct user and role
            if (target?.id === newMember.id) {
                // Check if the change involved adding the specific role
                const roleChange = changes.find(c => c.key === '$add' && (c.new as any[]).some(r => r.id === roleId));

                if (roleChange) {
                    // If executor is the bot, it's fine.
                    if (executor?.id === client.user?.id) {
                        return;
                    }

                    // If executor is NOT the bot, remove the role
                    await newMember.roles.remove(roleId, 'Unauthorized role assignment detected');

                    // DM User
                    try {
                        await newMember.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('<:caution:1437997212008185866> Role Removed')
                                .setDescription(`This role is managed ONLY by the verification bot.\nIt has been removed since it was added externally by <@${executor?.id}>.`)
                                .setColor('#ff0000')
                                .setFooter({ text: 'Unauthorized Assignment' })
                            ]
                        });
                    } catch (e) {
                        console.log('Could not DM user');
                    }

                    // Log
                    await logToChannel(client, `<:caution:1437997212008185866> **Unauthorized Role Add Detected**\nRole removed from <@${newMember.id}>\nAdded by: <@${executor?.id}> <:xieron_staffs:1437995300164730931>`);
                }
            }

        } catch (error) {
            console.error('Error checking audit logs:', error);
        }
    }
};
