import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    GuildMember,
    ChannelType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    VoiceChannel,
    TextChannel,
    MessageFlags
} from 'discord.js';
import { SlashCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createInfoEmbed, createErrorEmbed, createSuccessEmbed } from '../../utils/embedHelpers';
import { CustomEmojis } from '../../utils/emoji';



async function updateServerStats(guild: any): Promise<{ updated: number; errors: string[] }> {
    const db = DatabaseManager.getInstance();
    const panels = await db.getPanels(guild.id);

    let updated = 0;
    const errors: string[] = [];

    for (const panel of panels) {
        try {
            try {
                await guild.members.fetch({ time: 5000 }).catch(() => null);
                await guild.members.fetch({ withPresences: true, time: 5000 }).catch(() => null);
            } catch (e) {
                console.log('Member fetch timed out, using cache');
            }

            const totalMembers = guild.memberCount;
            const users = guild.members.cache.filter((member: any) => !member.user.bot).size;
            const bots = guild.members.cache.filter((member: any) => member.user.bot).size;

            // Status counts
            const online = guild.members.cache.filter((m: any) => m.presence?.status === 'online').size;
            const idle = guild.members.cache.filter((m: any) => m.presence?.status === 'idle').size;
            const dnd = guild.members.cache.filter((m: any) => m.presence?.status === 'dnd').size;

            // Update channels
            const updateChannel = async (id: string, name: string) => {
                if (!id) return;
                try {
                    const channel = await guild.channels.fetch(id);
                    if (channel) {
                        // Optimization: Skip update if name is already correct to avoid rate limits
                        if (channel.name === name) return;

                        if (panel.channelType === 'vc') {
                            await (channel as VoiceChannel).setName(name);
                        } else {
                            await (channel as TextChannel).setName(name);
                        }
                    }
                } catch (e) {
                    // Ignore missing channels
                }
            };

            await updateChannel(panel.usersChannelId, panel.channelType === 'vc' ? `Members : ${users}` : `members-${users}`);
            await updateChannel(panel.botsChannelId, panel.channelType === 'vc' ? `Bots : ${bots}` : `bots-${bots}`);

            // Status channel (stored in onlineChannelId)
            if (panel.onlineChannelId) {
                await updateChannel(panel.onlineChannelId, panel.channelType === 'vc' ? `🟢 ${online} | 🌙 ${idle} | ⛔ ${dnd}` : `status-${online}-${idle}-${dnd}`);
            }

            await updateChannel(panel.totalChannelId, panel.channelType === 'vc' ? `All : ${totalMembers}` : `all-${totalMembers}`);

            // Legacy support
            if (panel.idleChannelId) await updateChannel(panel.idleChannelId, panel.channelType === 'vc' ? `🌙 Idle: ${idle}` : `idle-${idle}`);
            if (panel.dndChannelId) await updateChannel(panel.dndChannelId, panel.channelType === 'vc' ? `⛔ DND: ${dnd}` : `dnd-${dnd}`);

            updated++;

        } catch (error) {
            errors.push(`Error updating panel "${panel.panelName}": ${error}`);
        }
    }

    return { updated, errors };
}

const slashCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('server-stats')
        .setDescription('Manage server stats panels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Setup a new server stats panel')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Channel type for the stats')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Voice Channels', value: 'vc' },
                            { name: 'Text Channels', value: 'text' }
                        )
                )
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name for this stats panel')
                        .setRequired(true)
                        .setMaxLength(50)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh')
                .setDescription('Manually refresh all server stats panels')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a server stats panel')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the panel to delete')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all server stats panels')
        ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'setup':
                await handleSetup(interaction);
                break;
            case 'refresh':
                await handleRefresh(interaction);
                break;
            case 'delete':
                await handleDelete(interaction);
                break;
            case 'list':
                await handleList(interaction);
                break;
        }
    }
};

async function handleSetup(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'You need Administrator permissions to use this command.', flags: MessageFlags.Ephemeral });
        return;
    }

    const channelType = interaction.options.getString('type') as 'vc' | 'text';
    const panelName = interaction.options.getString('name')!;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const db = DatabaseManager.getInstance();
        const existingPanel = await db.getPanel(interaction.guild!.id, panelName);
        if (existingPanel) {
            await interaction.editReply(`A panel named "${panelName}" already exists!`);
            return;
        }

        const guild = interaction.guild!;

        // Create Category
        const category = await guild.channels.create({
            name: `📊 ${panelName}`,
            type: ChannelType.GuildCategory,
            position: 0
        });

        let totalChannel, usersChannel, botsChannel, onlineChannel;

        // Create Channels with Placeholders
        if (channelType === 'vc') {
            const createVc = async (name: string) => {
                return await guild.channels.create({
                    name,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.Connect]
                        }
                    ]
                });
            };

            usersChannel = await createVc('Members : Loading...');
            botsChannel = await createVc('Bots : Loading...');
            onlineChannel = await createVc('Status : Loading...');
            totalChannel = await createVc('All : Loading...');
        } else {
            const createText = async (name: string) => {
                return await guild.channels.create({
                    name,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
                        }
                    ]
                });
            };

            usersChannel = await createText('members-loading');
            botsChannel = await createText('bots-loading');
            onlineChannel = await createText('status-loading');
            totalChannel = await createText('all-loading');
        }

        // Save to Database
        await db.createPanel({
            guildId: guild.id,
            panelName: panelName,
            channelType: channelType,
            categoryId: category.id,
            totalChannelId: totalChannel.id,
            usersChannelId: usersChannel.id,
            botsChannelId: botsChannel.id,
            onlineChannelId: onlineChannel.id,
            idleChannelId: undefined,
            dndChannelId: undefined
        });

        // Fetch Data and Update Channels
        await updateServerStats(guild);

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('Server Stats Panel Created')
            .setDescription(`Successfully created "${panelName}" stats panel`)
            .addFields([
                { name: 'Panel Name', value: panelName, inline: false },
                { name: 'Channel Type', value: channelType === 'vc' ? 'Voice Channels' : 'Text Channels', inline: false },
                { name: 'Status', value: 'Stats have been initialized and updated.', inline: false }
            ])
            .setTimestamp()
            .setFooter({ text: 'Server Stats will auto-update immediately on changes' });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error setting up stats panel:', error);
        await interaction.editReply('An error occurred while setting up the stats panel.');
    }
}

async function handleRefresh(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: 'You need Manage Channels permissions to use this command.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { updated, errors } = await updateServerStats(interaction.guild);

        if (updated === 0 && errors.length === 0) {
            await interaction.editReply('No server stats panels found to refresh.');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(updated > 0 ? 0x00ff00 : 0xff6b6b)
            .setTitle('Server Stats Refresh')
            .setDescription(`Refreshed ${updated} panel(s)`)
            .setTimestamp();

        if (errors.length > 0) {
            embed.addFields([{
                name: 'Errors',
                value: errors.slice(0, 5).join('\n'),
                inline: false
            }]);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error refreshing stats:', error);
        await interaction.editReply('An error occurred while refreshing server stats.');
    }
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'You need Administrator permissions to use this command.', flags: MessageFlags.Ephemeral });
        return;
    }

    const panelName = interaction.options.getString('name')!;
    const db = DatabaseManager.getInstance();
    const panel = await db.getPanel(interaction.guild!.id, panelName);

    if (!panel) {
        await interaction.reply({ content: `Panel "${panelName}" not found.`, flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const guild = interaction.guild!;
        const channels = [
            panel.totalChannelId,
            panel.usersChannelId,
            panel.botsChannelId,
            panel.onlineChannelId,
            panel.idleChannelId,
            panel.dndChannelId
        ].filter(id => id); // Filter out undefined/null

        let deletedChannels = 0;
        for (const channelId of channels) {
            try {
                const channel = await guild.channels.fetch(channelId);
                if (channel) {
                    await channel.delete();
                    deletedChannels++;
                }
            } catch (error) {
                console.error(`Error deleting channel ${channelId}:`, error);
            }
        }

        try {
            const category = await guild.channels.fetch(panel.categoryId);
            if (category) await category.delete();
        } catch (error) {
            console.error(`Error deleting category ${panel.categoryId}:`, error);
        }

        const dbDeleted = await db.deletePanel(guild.id, panelName);

        if (dbDeleted) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Panel Deleted Successfully')
                .setDescription(`The "${panelName}" panel has been completely removed`)
                .addFields([
                    { name: 'Panel Name', value: panelName, inline: false },
                    { name: 'Channels Deleted', value: deletedChannels.toString(), inline: false },
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply('Failed to remove panel from database.');
        }

    } catch (error) {
        console.error('Error deleting panel:', error);
        await interaction.editReply('An error occurred while deleting the panel.');
    }
}

async function handleList(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: 'You need Manage Channels permissions to use this command.', flags: MessageFlags.Ephemeral });
        return;
    }

    const db = DatabaseManager.getInstance();
    const panels = await db.getPanels(interaction.guild!.id);

    if (panels.length === 0) {
        await interaction.reply({ content: 'No server stats panels found.', flags: MessageFlags.Ephemeral });
        return;
    }

    const embed = createInfoEmbed('Server Stats Panels', 'Here are all the active stats panels on this server')
        .setTimestamp();

    for (const panel of panels) {
        const channelTypeText = panel.channelType === 'vc' ? 'Voice Channels' : 'Text Channels';
        const createdDate = new Date(panel.createdAt).toLocaleDateString();

        embed.addFields([{
            name: `📊 ${panel.panelName}`,
            value: `Type: ${channelTypeText}\nCreated: ${createdDate}`,
            inline: false
        }]);
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { updateServerStats };
