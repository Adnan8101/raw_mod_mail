
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, EmbedBuilder } from 'discord.js';
import { getEmojiEquationManager, Difficulty } from './gameInstance';

export const category = 'games';

export const equationCommand = new SlashCommandBuilder()
    .setName('equation')
    .setDescription('Manage Emoji Equation games')
    .addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('Start a new Emoji Equation game')
            .addStringOption(option =>
                option.setName('difficulty')
                    .setDescription('Game difficulty')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Easy', value: 'easy' },
                        { name: 'Medium', value: 'medium' },
                        { name: 'Hard', value: 'hard' }
                    ))
            .addIntegerOption(option =>
                option.setName('time')
                    .setDescription('Time in seconds before image deletion (optional)')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('end')
            .setDescription('End the current game'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const data = equationCommand;

export const execute = async (interaction: ChatInputCommandInteraction, services: any) => {
    await handleEquationCommand(interaction);
}

export const handleEquationCommand = async (interaction: ChatInputCommandInteraction) => {
    if (interaction.commandName !== 'equation') return;

    const subcommand = interaction.options.getSubcommand();
    const manager = getEmojiEquationManager(interaction.client);
    const channelId = interaction.channelId;

    if (subcommand === 'start') {
        const difficulty = interaction.options.getString('difficulty', true) as Difficulty;
        const time = interaction.options.getInteger('time') || undefined;

        await interaction.deferReply({ ephemeral: true });

        const success = await manager.startGame(channelId, difficulty, interaction.user.id, time);

        if (success) {
            await interaction.editReply('🎮 **Game Started!** Check the channel for the equation.');
        } else {
            await interaction.editReply('❌ A game is already active in this channel.');
        }
    } else if (subcommand === 'end') {
        await interaction.deferReply({ ephemeral: true });
        const answer = await manager.stopGame(channelId);

        if (answer !== null) {
            const channel = interaction.channel as TextChannel;
            const embed = new EmbedBuilder()
                .setDescription(`🛑 ** Game Ended by Admin.**\nNo correct answer was found.\nThe correct answer was: ** ${answer}** `)
                .setColor('#ff0000');

            if (channel) {
                await channel.send({ embeds: [embed] });
            }

            await interaction.editReply('✅ Game ended successfully.');
        } else {
            await interaction.editReply('❌ No active game found in this channel.');
        }
    }
};
