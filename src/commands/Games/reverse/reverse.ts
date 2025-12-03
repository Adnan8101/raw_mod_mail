import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getReverseGameManager } from './reverseManager';

export const reverseCommands = [
    new SlashCommandBuilder()
        .setName('reverse')
        .setDescription('Sentence Reverse Game commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start a new Reverse Game')
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
                        .setDescription('How many seconds the image stays visible (default: 5)')
                        .setMinValue(0)
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('charset')
                        .setDescription('Character set (default: mixed)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Words', value: 'words' },
                            { name: 'Alpha', value: 'alpha' },
                            { name: 'Mixed', value: 'mixed' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('Force stop the current Reverse Game'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];

export const category = 'games';
export const data = reverseCommands[0];

export const execute = async (interaction: ChatInputCommandInteraction, services: any) => {
    await handleReverseCommand(interaction);
}

export const handleReverseCommand = async (interaction: ChatInputCommandInteraction) => {
    const { commandName, options } = interaction;

    if (commandName === 'reverse') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'start') {
            const difficulty = options.getString('difficulty') || 'Easy';
            const time = options.getInteger('time') ?? 0;
            const charset = options.getString('charset') || 'mixed';

            const manager = getReverseGameManager(interaction.client);
            const success = await manager.startGame(interaction, difficulty, time, charset);

            if (!success) {
                await interaction.reply({ content: 'A game is already running in this channel.', flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'end') {
            const manager = getReverseGameManager(interaction.client);
            const success = await manager.stopGame(interaction);

            if (success) {
                await interaction.reply({ content: 'Game stopped successfully.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'No active game found to stop.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
