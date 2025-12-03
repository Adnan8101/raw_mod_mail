
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ChannelType, VoiceChannel, MessageFlags } from 'discord.js';
import { getRecordingManager } from './RecordingManager';
import { createSuccessEmbed, createErrorEmbed, createPendingEmbed, createInfoEmbed } from '../../utils/embeds';

export const recorderCommand = new SlashCommandBuilder()
    .setName('record')
    .setDescription('Manage voice recordings')
    .addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('Start recording the voice channel'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('stop')
            .setDescription('Stop recording and process files'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Show current recording status'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('formats')
            .setDescription('Select output formats')
            .addBooleanOption(option => option.setName('wav').setDescription('Export as WAV (Lossless)'))
            .addBooleanOption(option => option.setName('mp3').setDescription('Export as MP3'))
            .addBooleanOption(option => option.setName('opus').setDescription('Export as Opus'))
            .addBooleanOption(option => option.setName('flac').setDescription('Export as FLAC')))
    .addSubcommand(subcommand =>
        subcommand
            .setName('delete')
            .setDescription('Delete local recordings manually'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const handleRecorderCommand = async (interaction: ChatInputCommandInteraction) => {
    if (interaction.commandName !== 'record') return;

    const subcommand = interaction.options.getSubcommand();
    const manager = getRecordingManager(interaction.client);
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a server.')], ephemeral: true });
        return;
    }

    // Defer immediately to prevent "Unknown interaction" errors
    // We use ephemeral: true for status/formats/delete, public for start/stop (or as needed)
    // Actually, let's defer based on subcommand
    const ephemeralSubcommands = ['status', 'formats', 'delete'];
    const isEphemeral = ephemeralSubcommands.includes(subcommand);

    try {
        await interaction.deferReply({ flags: isEphemeral ? MessageFlags.Ephemeral : undefined });
    } catch (error) {
        console.error('Failed to defer reply:', error);
        return;
    }

    const member = interaction.member as any; // Cast to any to access voice
    const voiceChannel = member?.voice?.channel as VoiceChannel;

    if (subcommand === 'start') {
        if (!voiceChannel) {
            await interaction.editReply({ embeds: [createErrorEmbed('You must be in a voice channel to start recording.')] });
            return;
        }

        const mode = 'mixed';
        const success = await manager.startRecording(guildId, voiceChannel, interaction.channelId);
        if (success) {
            await interaction.editReply({ embeds: [createSuccessEmbed(`**Recording Started**\nChannel: ${voiceChannel.name}\nMode:Mixed\n\n*Your audio is being captured.*`)] });
        } else {
            await interaction.editReply({ embeds: [createErrorEmbed('A recording is already active in this server.')] });
        }

    } else if (subcommand === 'stop') {
        if (!manager.getStatus(guildId)) {
            await interaction.editReply({ embeds: [createErrorEmbed('No active recording found.')] });
            return;
        }

        await interaction.editReply({ embeds: [createPendingEmbed('**Stopping recording...** Processing audio files, please wait.')] });
        const result = await manager.stopRecording(guildId);

        if (result) {
            await interaction.editReply({ embeds: [createSuccessEmbed('**Recording Stopped & Processed.** Files have been sent.')] });
        } else {
            await interaction.editReply({ embeds: [createErrorEmbed('No active recording found.')] });
        }

    } else if (subcommand === 'status') {
        const status = manager.getStatus(guildId);
        if (!status) {
            await interaction.editReply({ embeds: [createErrorEmbed('No active recording.')] });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Recording Status')
            .addFields(
                { name: 'Duration', value: status.duration, inline: true },
                { name: 'Active Users', value: status.userCount.toString(), inline: true },
                { name: 'Mode', value: status.mode.toUpperCase(), inline: true },
                { name: 'Current Size', value: status.size || '0 MB', inline: true }
            )
            .setColor('#ff0000');

        await interaction.editReply({ embeds: [embed] });

    } else if (subcommand === 'formats') {
        // Just update preferences in manager
        const wav = interaction.options.getBoolean('wav') ?? false;
        const mp3 = interaction.options.getBoolean('mp3') ?? false;
        const opus = interaction.options.getBoolean('opus') ?? false;
        const flac = interaction.options.getBoolean('flac') ?? false;

        manager.updateFormats(guildId, { wav, mp3, opus, flac });
        await interaction.editReply({ embeds: [createSuccessEmbed('Output formats updated.')] });
    } else if (subcommand === 'delete') {
        // Implement delete logic
        await interaction.editReply({ embeds: [createSuccessEmbed('Local recordings deleted (Placeholder).')] });
    }
};
