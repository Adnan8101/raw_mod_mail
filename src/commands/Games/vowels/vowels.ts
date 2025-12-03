import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getVowelsGameManager } from './vowelsManager';

export const vowelsCommands = [
    new SlashCommandBuilder()
        .setName('vowels')
        .setDescription('Count the Vowels Game commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start a new Count the Vowels Game')
                .addStringOption(option =>
                    option.setName('difficulty')
                        .setDescription('Difficulty level')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Easy', value: 'Easy' },
                            { name: 'Medium', value: 'Medium' },
                            { name: 'Hard', value: 'Hard' }
                        ))
                .addIntegerOption(option =>
                    option.setName('time')
                        .setDescription('How many seconds the image stays visible (default: 4)')
                        .setMinValue(0)
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Category of text (default: mixed)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Letters', value: 'letters' },
                            { name: 'Words', value: 'words' },
                            { name: 'Mixed', value: 'mixed' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('Force stop the current Vowels Game'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];

export const category = 'games';
export const data = vowelsCommands[0];

export const execute = async (interaction: ChatInputCommandInteraction, services: any) => {
    await handleVowelsCommand(interaction);
}

export const handleVowelsCommand = async (interaction: ChatInputCommandInteraction) => {
    const { commandName, options } = interaction;

    if (commandName === 'vowels') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'start') {
            const difficulty = options.getString('difficulty') || 'Easy';
            const time = options.getInteger('time') ?? 0; // Default 0 (unlimited)
            const category = options.getString('category') || 'mixed';

            const manager = getVowelsGameManager(interaction.client);
            const success = await manager.startGame(interaction, difficulty, time, category);

            if (!success) {
                await interaction.reply({ content: 'A game is already running in this channel.', flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'end') {
            const manager = getVowelsGameManager(interaction.client);
            const success = await manager.stopGame(interaction);

            if (success) {
                await interaction.reply({ content: 'Game stopped successfully.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'No active game found to stop.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
