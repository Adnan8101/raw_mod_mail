
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, EmbedBuilder, MessageFlags, ThreadChannel } from 'discord.js';
import { GuessTheNumberManager } from './manager';

export const category = 'games';

const dataBuilder = new SlashCommandBuilder()
    .setName('gtn')
    .setDescription('Guess the Number game commands')
    .addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('Start a new instance of Guess the Number')
            .addIntegerOption(option =>
                option.setName('min')
                    .setDescription('Minimum number')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('max')
                    .setDescription('Maximum number')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('number')
                    .setDescription('The specific number to guess (overrides random generation)')
                    .setRequired(false))
            .addBooleanOption(option =>
                option.setName('thread')
                    .setDescription('Create a thread for the game')
                    .setRequired(false))
            .addIntegerOption(option =>
                option.setName('slowmode')
                    .setDescription('Set slowmode for the channel (seconds)')
                    .setRequired(false))
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel to start the game in')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('stop')
            .setDescription('Stop the game running in the current channel'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('closest')
            .setDescription('Get the closest guess to the number'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('winner')
            .setDescription('Set the winner role for the server'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('lock')
            .setDescription('Lock the current channel'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('unlock')
            .setDescription('Unlock the current channel'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('slowmode')
            .setDescription('Set the slowmode for the current channel')
            .addIntegerOption(option =>
                option.setName('seconds')
                    .setDescription('Seconds for slowmode')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('hint')
            .setDescription('Provide a hint by narrowing the range')
            .addIntegerOption(option =>
                option.setName('range')
                    .setDescription('Percentage of range to show (default 30%)')
                    .setMinValue(1)
                    .setMaxValue(100)
                    .setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const data = dataBuilder;

let manager: GuessTheNumberManager;

export async function execute(interaction: ChatInputCommandInteraction, services: any) {
    if (!manager) {
        manager = new GuessTheNumberManager(interaction.client);
    }
    await handleGuessTheNumberCommand(interaction, manager);
}

export const handleGuessTheNumberCommand = async (interaction: ChatInputCommandInteraction, manager: GuessTheNumberManager) => {
    const { commandName, options, channelId } = interaction;
    const channel = interaction.channel;

    if (!channel || (!channel.isTextBased() && !(channel as any).isThread())) {
        await interaction.reply({ content: 'This command can only be used in text channels or threads.', flags: MessageFlags.Ephemeral });
        return;
    }

    if (commandName === 'gtn') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'start') {
            const min = options.getInteger('min', true);
            const max = options.getInteger('max', true);
            const slowmode = options.getInteger('slowmode') || undefined;
            const targetNumber = options.getInteger('number') || undefined;
            const useThread = options.getBoolean('thread') || false;
            const targetChannel = options.getChannel('channel');

            if (min >= max) {
                await interaction.reply({ content: 'Minimum number must be less than maximum number.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (targetNumber !== undefined && (targetNumber < min || targetNumber > max)) {
                await interaction.reply({ content: `Target number must be between ${min} and ${max}.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const gameChannelId = targetChannel ? targetChannel.id : channelId;
            const success = await manager.startGame(gameChannelId, min, max, { slowmode, targetNumber, useThread });

            if (success) {
                await interaction.reply({ content: `Game started in <#${gameChannelId}>!`, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'A game is already running in that channel.', flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'stop') {
            const success = await manager.stopGame(channelId);
            if (success) {
                await interaction.reply({ content: 'Game stopped.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'No game is running in this channel.', flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'closest') {
            const game = manager.getGame(channelId);
            if (!game || !game.isActive) {
                await interaction.reply({ content: 'No active game in this channel.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (!game.closestGuess) {
                await interaction.reply({ content: 'No guesses have been made yet.', flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('Closest Guess So Far')
                .setDescription(`**User:** <@${game.closestGuess.userId}>\n**Guess:** ${game.closestGuess.guess}\n**Difference:** ${game.closestGuess.diff}`)
                .setTimestamp(game.closestGuess.timestamp);

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else if (subcommand === 'winner') {
            // Placeholder for winner role setting
            await interaction.reply({ content: 'Winner role configuration is coming soon!', flags: MessageFlags.Ephemeral });
        } else if (subcommand === 'lock') {
            if (channel.isThread()) {
                await channel.setLocked(true);
            } else if (channel.isTextBased() && !channel.isDMBased()) {
                const textChannel = channel as TextChannel;
                await textChannel.permissionOverwrites.edit(textChannel.guild.roles.everyone, { SendMessages: false });
            }
            await interaction.reply({ content: 'Channel locked.', flags: MessageFlags.Ephemeral });
        } else if (subcommand === 'unlock') {
            if (channel.isThread()) {
                await channel.setLocked(false);
            } else if (channel.isTextBased() && !channel.isDMBased()) {
                const textChannel = channel as TextChannel;
                await textChannel.permissionOverwrites.edit(textChannel.guild.roles.everyone, { SendMessages: true });
            }
            await interaction.reply({ content: 'Channel unlocked.', flags: MessageFlags.Ephemeral });
        } else if (subcommand === 'slowmode') {
            const seconds = options.getInteger('seconds', true);
            if (channel.isThread() || (channel.isTextBased() && !channel.isDMBased())) {
                await (channel as TextChannel | ThreadChannel).setRateLimitPerUser(seconds);
            }
            await interaction.reply({ content: `Slowmode set to ${seconds} seconds.`, flags: MessageFlags.Ephemeral });
        } else if (subcommand === 'hint') {
            const range = options.getInteger('range') || 30;
            const success = await manager.provideHint(channelId, range);
            if (success) {
                await interaction.reply({ content: 'Hint provided!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'Failed to provide hint. Is a game running?', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
