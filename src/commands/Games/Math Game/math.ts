import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getMathGameManager } from './mathGameInstance';

export const mathCommands = [
    new SlashCommandBuilder()
        .setName('math')
        .setDescription('Math Memory Game commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('quiz')
                .setDescription('Start a new Math Memory Game')
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
                        .setDescription('How many seconds the image stays visible')
                        .setMinValue(1)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('Force stop the current Math Game'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];

export const category = 'games';
export const data = mathCommands[0];

export const execute = async (interaction: ChatInputCommandInteraction, services: any) => {
    await handleMathCommand(interaction);
}

export const handleMathCommand = async (interaction: ChatInputCommandInteraction) => {
    const { commandName, options } = interaction;

    if (commandName === 'math') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'quiz') {
            const difficulty = options.getString('difficulty') || 'Easy';
            const time = options.getInteger('time') || 0;

            const manager = getMathGameManager(interaction.client);
            const success = await manager.startGame(interaction, difficulty, time);

            if (!success) {
                await interaction.reply({ content: 'A game is already running in this channel.', flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'end') {
            const manager = getMathGameManager(interaction.client);
            const success = await manager.stopGame(interaction);

            if (success) {
                await interaction.reply({ content: 'Game stopped successfully.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'No active game found to stop.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
