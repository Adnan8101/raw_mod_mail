import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Set the leave channel for when members leave (Admin only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send leave messages to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  category: 'invites_welcome',
  syntax: '/leave <channel>',
  permission: 'Administrator',
  example: '/leave #goodbye',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.options.getChannel('channel', true);
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    try {
      const db = DatabaseManager.getInstance();
      db.setLeaveChannel(guild.id, channel.id);

      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('🚪 Leave Channel Set')
        .setDescription(
          `Leave messages will now be sent to ${channel.toString()}\n\n` +
          `**Channel:** ${channel.name}\n` +
          `**Set By:** ${interaction.user.username}`
        )
        .setTimestamp()
        .setFooter({ text: 'Leave System' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error setting leave channel:', error);
      await interaction.reply({
        content: 'An error occurred while setting the leave channel.',
        ephemeral: true
      });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'leave',
  aliases: ['leavechannel', 'setleave'],
  description: 'Set the leave channel for when members leave (Admin only)',
  usage: 'leave <#channel>',
  example: 'leave #general',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]): Promise<void> {
    const guild = message.guild;
    if (!guild) {
      await message.reply('This command can only be used in a server!');
      return;
    }

    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply('❌ You need Administrator permissions to use this command!');
      return;
    }

    if (args.length === 0) {
      await message.reply('Please mention a channel! Usage: `leave #channel`');
      return;
    }

    const channelMention = args[0];
    const channelId = channelMention.replace(/[<#>]/g, '');

    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await message.reply('Please provide a valid text channel!');
        return;
      }

      const db = DatabaseManager.getInstance();
      db.setLeaveChannel(guild.id, channel.id);

      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('🚪 Leave Channel Set')
        .setDescription(
          `Leave messages will now be sent to ${channel.toString()}\n\n` +
          `**Channel:** ${channel.name}\n` +
          `**Set By:** ${message.author.username}`
        )
        .setTimestamp()
        .setFooter({ text: 'Leave System' });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error setting leave channel:', error);
      await message.reply('An error occurred while setting the leave channel.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
