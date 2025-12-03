
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, EmbedBuilder, MessageFlags, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { parseDuration } from '../../utils/time';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const category = 'giveaways';

export const data = new SlashCommandBuilder()
    .setName('gcreate')
    .setDescription('Start a new giveaway')
    .addStringOption(option =>
        option.setName('prize')
            .setDescription('The prize to give away')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('winners')
            .setDescription('Number of winners')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('duration')
            .setDescription('Duration (e.g. 10m, 1h, 2d)')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Channel to host the giveaway in (default: current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false))
    .addRoleOption(option =>
        option.setName('role_requirement')
            .setDescription('Required role to enter')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('invite_requirement')
            .setDescription('Minimum invites required')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('account_age')
            .setDescription('Minimum account age in days')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('server_age')
            .setDescription('Minimum days in server')
            .setRequired(false))
    .addBooleanOption(option =>
        option.setName('captcha')
            .setDescription('Require captcha verification')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('message_required')
            .setDescription('Minimum messages required to enter')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('voice')
            .setDescription('Minimum voice minutes required')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('custom_message')
            .setDescription('Custom message to display in giveaway')
            .setRequired(false))

    .addRoleOption(option =>
        option.setName('assign_role')
            .setDescription('Role to assign to participants')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('thumbnail')
            .setDescription('URL for giveaway thumbnail')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
    const prize = interaction.options.getString('prize', true);
    const winners = interaction.options.getInteger('winners', true);
    const durationStr = interaction.options.getString('duration', true);
    const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;

    // Requirements
    const roleRequirement = interaction.options.getRole('role_requirement');
    const inviteRequirement = interaction.options.getInteger('invite_requirement');
    const accountAgeRequirement = interaction.options.getInteger('account_age');
    const serverAgeRequirement = interaction.options.getInteger('server_age');
    const captchaRequirement = interaction.options.getBoolean('captcha');
    const messageRequirement = interaction.options.getInteger('message_required');
    const voiceRequirement = interaction.options.getInteger('voice');
    const customMessage = interaction.options.getString('custom_message');
    const assignRole = interaction.options.getRole('assign_role');
    const thumbnail = interaction.options.getString('thumbnail');

    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds) {
        await interaction.reply({ embeds: [createErrorEmbed('Invalid duration format. Use 10m, 1h, 2d, etc.')], flags: MessageFlags.Ephemeral });
        return;
    }

    if (winners < 1) {
        await interaction.reply({ embeds: [createErrorEmbed('Invalid number of winners.')], flags: MessageFlags.Ephemeral });
        return;
    }

    const endTime = new Date(Date.now() + durationSeconds * 1000);

    const db = DatabaseManager.getInstance();

    // Create Embed
    const embed = new EmbedBuilder()
        .setTitle(prize)
        .setDescription(`React with 🎉 to enter!\nEnds: <t:${Math.floor(endTime.getTime() / 1000)}:R> (<t:${Math.floor(endTime.getTime() / 1000)}:f>)\nHosted by: ${interaction.user}`)
        .addFields(
            { name: 'Winners', value: `${winners}`, inline: true },
            { name: 'Host', value: `${interaction.user}`, inline: true }
        )
        .setColor('#2f3136')
        .setTimestamp(endTime)
        .setFooter({ text: `Ends at` });

    if (thumbnail) {
        embed.setThumbnail(thumbnail);
    }

    if (customMessage) {
        embed.addFields({ name: 'Message', value: customMessage });
    }

    // Requirements text
    const requirements: string[] = [];
    if (roleRequirement) requirements.push(`Role: ${roleRequirement}`);
    if (inviteRequirement) requirements.push(`Invites: ${inviteRequirement}`);
    if (accountAgeRequirement) requirements.push(`Account Age: ${accountAgeRequirement} days`);
    if (serverAgeRequirement) requirements.push(`Server Age: ${serverAgeRequirement} days`);
    if (messageRequirement) requirements.push(`Messages: ${messageRequirement}`);
    if (voiceRequirement) requirements.push(`Voice: ${voiceRequirement} mins`);
    if (captchaRequirement) requirements.push(`Captcha: Required`);

    if (requirements.length > 0) {
        embed.addFields({ name: 'Requirements', value: requirements.join('\n') });
    }

    try {
        const message = await channel.send({ embeds: [embed] });
        await message.react('🎉');

        await db.createGiveaway({
            messageId: message.id,
            channelId: channel.id,
            guildId: interaction.guildId!,
            hostId: interaction.user.id,
            prize,
            winnersCount: winners,
            endTime,
            roleRequirement: roleRequirement?.id,
            inviteRequirement: inviteRequirement || null,
            accountAgeRequirement: accountAgeRequirement || null,
            serverAgeRequirement: serverAgeRequirement || null,
            captchaRequirement: captchaRequirement || false,
            messageRequirement: messageRequirement || null,
            voiceRequirement: voiceRequirement || null,
            customMessage: customMessage || null,
            assignRole: assignRole?.id,
            thumbnail: thumbnail || null
        });

        await interaction.reply({ embeds: [createSuccessEmbed(`Giveaway created in ${channel}!`)], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Failed to create giveaway:', error);
        await interaction.reply({ embeds: [createErrorEmbed('Failed to create giveaway.')], flags: MessageFlags.Ephemeral });
    }
}
