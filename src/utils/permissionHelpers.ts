import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { EmbedColors } from '../types';
import { CustomEmojis } from './emoji';

interface PermissionOptions {
    ownerOnly?: boolean;
}

/**
 * Checks if the user has permission to run the command.
 * Enforces:
 * 1. Owner Only (if requested)
 * 2. Role Hierarchy (User Role > Bot Role)
 * 
 * Returns true if allowed, false if denied (and replies with error).
 */
export async function checkCommandPermission(
    interaction: ChatInputCommandInteraction,
    options: PermissionOptions = {}
): Promise<boolean> {
    const { ownerOnly = false } = options;
    const guild = interaction.guild!;
    const user = interaction.user;
    const member = interaction.member as import('discord.js').GuildMember;
    const botMember = guild.members.me!;

    // 1. Owner Override / Check
    if (user.id === guild.ownerId) {
        return true;
    }

    // 2. Owner Only Restriction
    if (ownerOnly) {
        const errorEmbed = new EmbedBuilder()
            .setColor(EmbedColors.ERROR)
            .setDescription(`${CustomEmojis.CROSS} Only the **Server Owner** can use this command.`);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        return false;
    }

    // 3. Role Hierarchy Check (User > Bot)
    // We only check this if the user is NOT the owner (already handled above)
    if (member.roles.highest.position <= botMember.roles.highest.position) {
        const errorEmbed = new EmbedBuilder()
            .setColor(EmbedColors.ERROR)
            .setTitle('Permission Denied')
            .setDescription(
                `${CustomEmojis.CROSS} **Role Hierarchy Error**\n\n` +
                `You cannot use this command because your highest role is **lower than or equal to** my highest role.\n` +
                `Please ask the Server Owner or a higher-ranked Admin to manage this.`
            );

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        return false;
    }

    return true;
}
