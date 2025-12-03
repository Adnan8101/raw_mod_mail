import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('delete-panel')
    .setDescription('Delete a server stats panel')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the panel to delete')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'You need Administrator permissions to use this command.', ephemeral: true });
      return;
    }

    const panelName = interaction.options.getString('name')!;
    const db = DatabaseManager.getInstance();
    const panel = await db.getPanel(interaction.guild.id, panelName);

    if (!panel) {
      await interaction.reply({ content: `Panel "${panelName}" not found.`, ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;

      // Delete channels
      const channels = [
        panel.totalChannelId,
        panel.usersChannelId,
        panel.botsChannelId
      ];

      let deletedChannels = 0;
      for (const channelId of channels) {
        try {
          const channel = await guild.channels.fetch(channelId);
          if (channel) {
            await channel.delete();
            deletedChannels++;
          }
        } catch (error) {
          console.error(`Error deleting channel ${channelId}:`, error);
        }
      }

      // Delete category
      try {
        const category = await guild.channels.fetch(panel.categoryId);
        if (category) await category.delete();
      } catch (error) {
        console.error(`Error deleting category ${panel.categoryId}:`, error);
      }

      // Remove from database
      const dbDeleted = await db.deletePanel(interaction.guild.id, panelName);

      if (dbDeleted) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('Panel Deleted Successfully')
          .setDescription(`The "${panelName}" panel has been completely removed`)
          .addFields([
            { name: 'Panel Name', value: panelName, inline: false },
            { name: 'Channels Deleted', value: deletedChannels.toString(), inline: false },
            { name: 'Category Deleted', value: 'Yes', inline: false }
          ])
          .setTimestamp()
          .setFooter({ text: 'Panel Deletion' });

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply('Failed to remove panel from database.');
      }

    } catch (error) {
      console.error('Error deleting panel:', error);
      await interaction.editReply('An error occurred while deleting the panel.');
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'delete-panel',
  aliases: ['deletepanel', 'remove-panel'],
  description: 'Delete a server stats panel',
  usage: 'delete-panel <panel_name>',
  permissions: [PermissionFlagsBits.Administrator],
  example: 'delete-panel "Main Stats"',

  async execute(message: Message, args: string[]): Promise<void> {
    if (!message.guild) {
      await message.reply('This command can only be used in a server.');
      return;
    }

    const member = message.member;
    if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply('You need Administrator permissions to use this command.');
      return;
    }

    if (args.length === 0) {
      const db = DatabaseManager.getInstance();
      const panels = await db.getPanels(message.guild.id);

      if (panels.length === 0) {
        await message.reply('No panels found to delete.');
        return;
      }

      const panelList = panels.map(p => `- ${p.panelName}`).join('\n');
      await message.reply(`Available panels:\n${panelList}\n\nUsage: \`delete-panel <panel_name>\``);
      return;
    }

    const panelName = args.join(' ').replace(/['"]/g, '');
    const db = DatabaseManager.getInstance();
    const panel = await db.getPanel(message.guild.id, panelName);

    if (!panel) {
      await message.reply(`Panel "${panelName}" not found.`);
      return;
    }

    const statusMessage = await message.reply(`Deleting panel "${panelName}"...`);

    try {
      const guild = message.guild;

      // Delete channels
      const channels = [
        panel.totalChannelId,
        panel.usersChannelId,
        panel.botsChannelId
      ];

      let deletedChannels = 0;
      for (const channelId of channels) {
        try {
          const channel = await guild.channels.fetch(channelId);
          if (channel) {
            await channel.delete();
            deletedChannels++;
          }
        } catch (error) {
          console.error(`Error deleting channel ${channelId}:`, error);
        }
      }

      // Delete category
      try {
        const category = await guild.channels.fetch(panel.categoryId);
        if (category) await category.delete();
      } catch (error) {
        console.error(`Error deleting category ${panel.categoryId}:`, error);
      }

      // Remove from database
      const dbDeleted = await db.deletePanel(message.guild.id, panelName);

      if (dbDeleted) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('Panel Deleted Successfully')
          .setDescription(`The "${panelName}" panel has been completely removed`)
          .addFields([
            { name: 'Panel Name', value: panelName, inline: false },
            { name: 'Channels Deleted', value: deletedChannels.toString(), inline: false },
            { name: 'Category Deleted', value: 'Yes', inline: false }
          ])
          .setTimestamp()
          .setFooter({ text: 'Panel Deletion' });

        await statusMessage.edit({ content: '', embeds: [embed] });
      } else {
        await statusMessage.edit('Failed to remove panel from database.');
      }

    } catch (error) {
      console.error('Error deleting panel:', error);
      await statusMessage.edit('An error occurred while deleting the panel.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
