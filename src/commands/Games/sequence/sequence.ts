import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getSequenceGameManager } from './sequenceManager';

export const sequenceCommands = [
    new SlashCommandBuilder()
        .setName('sequence')
        .setDescription('Mini Sequence Complete Game commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start a new Sequence Game')
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
                    option.setName('type')
                        .setDescription('Type of sequence (default: auto)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Auto (Random)', value: 'auto' },
                            { name: 'Arithmetic', value: 'arithmetic' },
                            { name: 'Geometric', value: 'geometric' },
                            { name: 'Fibonacci', value: 'fibonacci' },
                            { name: 'Squares', value: 'squares' },
                            { name: 'Primes', value: 'primes' },
                            { name: 'Alternating', value: 'alternating' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('Force stop the current Sequence Game'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];

export const category = 'games';
export const data = sequenceCommands[0];

export const execute = async (interaction: ChatInputCommandInteraction, services: any) => {
    await handleSequenceCommand(interaction);
}

export const handleSequenceCommand = async (interaction: ChatInputCommandInteraction) => {
    const { commandName, options } = interaction;

    if (commandName === 'sequence') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'start') {
            const difficulty = options.getString('difficulty') || 'Easy';
            const time = options.getInteger('time') ?? 0;
            const type = options.getString('type') || 'auto';

            const manager = getSequenceGameManager(interaction.client);
            const success = await manager.startGame(interaction, difficulty, time, type);

            if (!success) {
                await interaction.reply({ content: 'A game is already running in this channel.', flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'end') {
            const manager = getSequenceGameManager(interaction.client);
            const success = await manager.stopGame(interaction);

            if (success) {
                await interaction.reply({ content: 'Game stopped successfully.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'No active game found to stop.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
