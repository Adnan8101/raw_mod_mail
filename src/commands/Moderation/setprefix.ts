import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Message, EmbedBuilder } from 'discord.js';
import { GuildSettingsModel } from '../../database/schema';

export const setPrefixCommand = new SlashCommandBuilder()
    .setName('setprefix')
    .setDescription('Change the bot prefix for this server')
    .addStringOption(option =>
        option.setName('prefix')
            .setDescription('The new prefix')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const handleSetPrefixCommand = async (interaction: ChatInputCommandInteraction) => {
    if (interaction.commandName === 'setprefix') {
        const newPrefix = interaction.options.getString('prefix', true);
        const guildId = interaction.guildId;

        if (!guildId) {
            await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
            return;
        }

        try {
            await GuildSettingsModel.findOneAndUpdate(
                { guildId },
                { prefix: newPrefix },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setDescription(`✅ **Prefix updated to:** \`${newPrefix}\``)
                .setColor('#00ff00');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting prefix:', error);
            await interaction.reply({ content: '❌ Failed to update prefix.', ephemeral: true });
        }
    }
};

export const handleSetPrefixMessage = async (message: Message, args: string[]) => {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await message.reply('❌ You need **Manage Server** permission to use this command.');
        return;
    }

    if (args.length === 0) {
        await message.reply('❌ Please provide a new prefix. Usage: `!setprefix <new_prefix>`');
        return;
    }

    const newPrefix = args[0];
    const guildId = message.guildId;

    if (!guildId) return;

    try {
        await GuildSettingsModel.findOneAndUpdate(
            { guildId },
            { prefix: newPrefix },
            { upsert: true, new: true }
        );

        const embed = new EmbedBuilder()
            .setDescription(`✅ **Prefix updated to:** \`${newPrefix}\``)
            .setColor('#00ff00');

        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error setting prefix:', error);
        await message.reply('❌ Failed to update prefix.');
    }
};
