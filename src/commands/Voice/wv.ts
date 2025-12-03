
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, VoiceChannel, EmbedBuilder, ChannelType, Message } from 'discord.js';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const category = 'voice';

export const data = new SlashCommandBuilder()
    .setName('wv')
    .setDescription('Who is in voice? List members in a channel')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The voice channel to check (defaults to your current channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    const channelOption = interaction.options.getChannel('channel');

    let channel: VoiceChannel | null = null;

    if (channelOption) {
        channel = channelOption as VoiceChannel;
    } else if (member?.voice.channel) {
        channel = member.voice.channel as VoiceChannel;
    } else {
        // Check for reply if prefix command (interaction might be a message wrapper)
        // But this is 'execute' which takes ChatInputCommandInteraction.
        // Wait, my bot handles prefix commands by calling execute too?
        // Usually I have separate logic or I pass 'any'.
        // Let's check if interaction has 'message' property (for prefix)
        const message = (interaction as any).message as Message;
        if (message && message.reference && message.reference.messageId) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMessage.member && repliedMessage.member.voice.channel) {
                    channel = repliedMessage.member.voice.channel as VoiceChannel;
                }
            } catch (e) { }
        }

        if (!channel) {
            await interaction.reply({ embeds: [createErrorEmbed('You must be in a voice channel, reply to a user in a VC, or specify a channel to check.')], flags: MessageFlags.Ephemeral });
            return;
        }
    }

    const members = channel.members;

    if (members.size === 0) {
        await interaction.reply({ embeds: [createErrorEmbed(`No one is in ${channel.name}.`)], flags: MessageFlags.Ephemeral });
        return;
    }

    const memberList = members.map(m => {
        let status = '';
        if (m.voice.serverMute) status += '🔇 ';
        if (m.voice.serverDeaf) status += '🙉 ';
        if (m.voice.selfMute) status += 'mic off ';
        if (m.voice.selfDeaf) status += 'deafened ';
        return `• ${m.user.tag} ${status}`;
    }).join('\n');

    await interaction.reply({
        content: `<#${channel.id}>\n${memberList}`,
        flags: MessageFlags.Ephemeral
    });
}
