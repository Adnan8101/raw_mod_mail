import { Client, GuildMember, PartialGuildMember, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config';
import { logToChannel } from '../utils/logger';
export const onGuildMemberUpdate = async (client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember) => {
    const roleId = CONFIG.ROLES.EARLY_SUPPORTER;
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
                                .setColor('#ff0000')
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
