
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const category = 'voice';

export const data = new SlashCommandBuilder()
    .setName('autoafk')
    .setDescription('Configure auto-AFK settings')
    .addSubcommand(sub =>
        sub.setName('set')
            .setDescription('Set auto-AFK channel and timeout')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The AFK channel')
                    .addChannelTypes(ChannelType.GuildVoice)
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('minutes')
                    .setDescription('Minutes before moving to AFK')
                    .setRequired(true)))
    .addSubcommand(sub =>
        sub.setName('disable')
            .setDescription('Disable auto-AFK'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = DatabaseManager.getInstance();

    if (subcommand === 'set') {
        const channel = interaction.options.getChannel('channel', true);
        const minutes = interaction.options.getInteger('minutes', true);

        await db.setAutoAFKSettings(interaction.guildId!, true, minutes, channel.id);
        await interaction.reply({ embeds: [createSuccessEmbed(`Auto-AFK set to <#${channel.id}> after ${minutes} minutes.`)], flags: MessageFlags.Ephemeral });
    } else if (subcommand === 'disable') {
        await db.setAutoAFKSettings(interaction.guildId!, false, 0, '');
        await interaction.reply({ embeds: [createSuccessEmbed('Auto-AFK disabled.')], flags: MessageFlags.Ephemeral });
    }
}
