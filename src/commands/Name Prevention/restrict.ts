import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { GuildSettingsModel } from '../../database/schema';

export const restrictCommand = new SlashCommandBuilder()
    .setName('restrict')
    .setDescription('Manage restriction settings')
    .addSubcommandGroup(group =>
        group
            .setName('name')
            .setDescription('Manage blocked names')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Add a name to the blocklist')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('The name to block')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a name from the blocklist')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('The name to unblock')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List all blocked names')))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames);

export const handleRestrictCommand = async (interaction: ChatInputCommandInteraction) => {
    if (interaction.commandName !== 'restrict') return;

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'name') {
        const guildId = interaction.guildId;
        if (!guildId) return;

        if (subcommand === 'add') {
            const nameToAdd = interaction.options.getString('name', true).toLowerCase();

            try {
                const settings = await GuildSettingsModel.findOneAndUpdate(
                    { guildId },
                    { $addToSet: { blockedNames: nameToAdd } },
                    { upsert: true, new: true }
                );

                const embed = new EmbedBuilder()
                    .setDescription(`✅ **Added to blocklist:** \`${nameToAdd}\``)
                    .setColor('#00ff00');

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error adding blocked name:', error);
                await interaction.reply({ content: '❌ Failed to add name.', ephemeral: true });
            }
        } else if (subcommand === 'remove') {
            const nameToRemove = interaction.options.getString('name', true).toLowerCase();

            try {
                await GuildSettingsModel.findOneAndUpdate(
                    { guildId },
                    { $pull: { blockedNames: nameToRemove } },
                    { upsert: true }
                );

                const embed = new EmbedBuilder()
                    .setDescription(`✅ **Removed from blocklist:** \`${nameToRemove}\``)
                    .setColor('#00ff00');

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error removing blocked name:', error);
                await interaction.reply({ content: '❌ Failed to remove name.', ephemeral: true });
            }
        } else if (subcommand === 'list') {
            try {
                const settings = await GuildSettingsModel.findOne({ guildId });
                const blockedNames = settings?.blockedNames || [];

                if (blockedNames.length === 0) {
                    await interaction.reply({ content: 'No names are currently blocked.', ephemeral: true });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle('🚫 Blocked Names')
                    .setDescription(blockedNames.map(n => `• \`${n}\``).join('\n'))
                    .setColor('#ff0000');

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error listing blocked names:', error);
                await interaction.reply({ content: '❌ Failed to list names.', ephemeral: true });
            }
        }
    }
};
