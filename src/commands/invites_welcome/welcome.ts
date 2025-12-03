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
    .setName('welcome')
    .setDescription('Set the welcome channel for new members (Manage Server only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send welcome messages to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: 'Welcome',
  syntax: '/welcome <channel>',
  permission: 'Manage Server',
  example: '/welcome #general',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.options.getChannel('channel', true);
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    try {
      const db = DatabaseManager.getInstance();
      db.setWelcomeChannel(guild.id, channel.id);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('<:tcet_tick:1437995479567962184> Welcome Channel Set')
        .setDescription(
          `Welcome messages will now be sent to ${channel.toString()}\n\n` +
          `**Channel:** ${channel.name}\n` +
          `**Set By:** ${interaction.user.username}`
        )
        .setTimestamp()
        .setFooter({ text: 'Welcome System' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error setting welcome channel:', error);
      await interaction.reply({
        content: 'An error occurred while setting the welcome channel.',
        ephemeral: true
      });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'welcome',
  aliases: ['welcomechannel', 'setwelcome'],
  description: 'Set the welcome channel for new members (Manage Server only)',
  usage: 'welcome <#channel>',
  example: 'welcome #general',
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]): Promise<void> {
    const guild = message.guild;
    if (!guild) {
      await message.reply('This command can only be used in a server!');
      return;
    }

    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply('❌ You need Manage Server permissions to use this command!');
      return;
    }

    if (args.length === 0) {
      await message.reply('Please mention a channel! Usage: `welcome #channel`');
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
      db.setWelcomeChannel(guild.id, channel.id);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('<:tcet_tick:1437995479567962184> Welcome Channel Set')
        .setDescription(
          `Welcome messages will now be sent to ${channel.toString()}\n\n` +
          `**Channel:** ${channel.name}\n` +
          `**Set By:** ${message.author.username}`
        )
        .setTimestamp()
        .setFooter({ text: 'Welcome System' });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error setting welcome channel:', error);
      await message.reply('An error occurred while setting the welcome channel.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
