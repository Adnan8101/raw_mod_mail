import { Message, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { parseDuration } from '../../utils/time';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embedHelpers';

const prefixCommand: PrefixCommand = {
    name: 'gstart',
    description: 'Quickly start a giveaway',
    usage: 'gstart <prize> <winners> <duration>',
    example: 'gstart Nitro 1 1h',
    permissions: [PermissionFlagsBits.ManageGuild],
    aliases: ['gquick'],

    async execute(interaction: any): Promise<void> {
        const args = interaction.args;
        const message = interaction.message;

        if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply('❌ You need Manage Server permissions to use this command!');
            return;
        }

        const helpEmbed = new EmbedBuilder()
            .setTitle('🎉 Quick Giveaway Help')
            .setDescription('Start a giveaway quickly with a single command.')
            .addFields(
                { name: 'Usage', value: '`!gstart <prize> <winners> <duration>`' },
                { name: 'Examples', value: '`!gstart Nitro 1 1h`\n`!gstart Mystery Box 5 30m`\n`!gstart $10 Gift Card 2 1d`' },
                { name: 'Arguments', value: '• **Prize:** What you are giving away (can be multiple words)\n• **Winners:** Number of winners (must be at least 1)\n• **Duration:** How long the giveaway lasts (e.g., 10m, 1h, 2d)' }
            )
            .setColor('#2f3136')
            .setFooter({ text: 'Tip: Duration must be the last argument!' });

        if (args.length < 3) {
            await interaction.reply({ embeds: [helpEmbed] });
            return;
        }

        // Parse arguments
        // Expected: <prize> <winners> <duration>
        // But prize can be multiple words.
        // So we should probably parse from the end.
        // Last arg: duration
        // Second to last: winners
        // Rest: prize

        const durationStr = args[args.length - 1];
        const winnersStr = args[args.length - 2];
        const prize = args.slice(0, args.length - 2).join(' ');

        if (!durationStr || !winnersStr || !prize) {
            await interaction.reply({ embeds: [helpEmbed] });
            return;
        }

        const durationSeconds = parseDuration(durationStr);
        if (!durationSeconds) {
            await interaction.reply({ content: '❌ Invalid duration format. Use 10m, 1h, 2d, etc.', embeds: [helpEmbed] });
            return;
        }

        const winners = parseInt(winnersStr);
        if (isNaN(winners) || winners < 1) {
            await interaction.reply({ content: '❌ Invalid number of winners.', embeds: [helpEmbed] });
            return;
        }

        // Delete author message (if possible, might not be possible with interaction abstraction but we try)
        // In prefix command, we don't have direct access to message delete via interaction wrapper usually
        // But we can try to find the message if we passed it, or just skip deletion if not critical.
        // For now, we skip deletion as it's not critical and hard to do cleanly via interaction wrapper without casting.

        const endTime = new Date(Date.now() + durationSeconds * 1000);
        const db = DatabaseManager.getInstance();

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

        try {
            const channel = message.channel as TextChannel;
            const giveawayMessage = await channel.send({ embeds: [embed] });
            await giveawayMessage.react('🎉');

            await db.createGiveaway({
                messageId: giveawayMessage.id,
                channelId: channel.id,
                guildId: message.guild!.id,
                hostId: message.author.id,
                prize,
                winnersCount: winners,
                endTime,
                roleRequirement: null,
                inviteRequirement: null,
                accountAgeRequirement: null,
                serverAgeRequirement: null,
                captchaRequirement: false,
                messageRequirement: null,
                voiceRequirement: null,
                entryFee: null,
                customMessage: null,
                assignRole: null,
                thumbnail: null
            });

            // Optional: Send a temporary success message or just let the giveaway message be the confirmation
            await interaction.message.delete().catch(() => { });
        } catch (error) {
            console.error('Failed to create giveaway:', error);
            const channel = message.channel as TextChannel;
            await channel.send('Failed to create giveaway.');
        }
    }
};

export = prefixCommand;
