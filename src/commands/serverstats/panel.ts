import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createInfoEmbed, createErrorEmbed, createSuccessEmbed } from '../../utils/embedHelpers';
import { CustomEmojis } from '../../utils/emoji';

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('View and manage server stats panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  category: 'serverstats',
  syntax: '/panel',
  permission: 'Manage Channels',
  example: '/panel',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      const errorEmbed = createErrorEmbed('This command can only be used in a server.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const errorEmbed = createErrorEmbed('You need Manage Channels permissions to use this command.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    const db = DatabaseManager.getInstance();
    const panels = await db.getPanels(interaction.guild.id);

    if (panels.length === 0) {
      const errorEmbed = createErrorEmbed('No server stats panels found. Use `/setup` to create one.');
      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true
      });
      return;
    }

    const embed = createInfoEmbed('Server Stats Panels', 'Here are all the active stats panels on this server')
      .setTimestamp();

    // Add panels to embed
    for (const panel of panels) {
      const channelTypeText = panel.channelType === 'vc' ? 'Voice Channels' : 'Text Channels';
      const createdDate = new Date(panel.createdAt).toLocaleDateString();

      embed.addFields([{
        name: `📊 ${panel.panelName}`,
        value: `Type: ${channelTypeText}\nCreated: ${createdDate}`,
        inline: false
      }]);
    }

    // Create select menu for deletion
    if (panels.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('delete_panel')
        .setPlaceholder('Select a panel to delete...')
        .addOptions(panels.map(panel => ({
          label: panel.panelName,
          value: panel.panelName,
          description: `${panel.channelType === 'vc' ? 'Voice' : 'Text'} channels panel`,
        })));

      const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

      const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

      try {
        const selection = await response.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          time: 60000,
          filter: (i) => i.user.id === interaction.user.id
        });

        const selectedPanelName = selection.values[0];
        const selectedPanel = panels.find(p => p.panelName === selectedPanelName);

        if (!selectedPanel) {
          await selection.update({ content: 'Panel not found.', components: [], embeds: [] });
          return;
        }

        // Delete channels and category
        try {
          const guild = interaction.guild;

          // Delete channels
          const channels = [
            selectedPanel.totalChannelId,
            selectedPanel.usersChannelId,
            selectedPanel.botsChannelId
          ];

          for (const channelId of channels) {
            try {
              const channel = await guild.channels.fetch(channelId);
              if (channel) await channel.delete();
            } catch (error) {
              console.error(`Error deleting channel ${channelId}:`, error);
            }
          }

          // Delete category
          try {
            const category = await guild.channels.fetch(selectedPanel.categoryId);
            if (category) await category.delete();
          } catch (error) {
            console.error(`Error deleting category ${selectedPanel.categoryId}:`, error);
          }

          // Remove from database
          await db.deletePanel(interaction.guild.id, selectedPanelName);

          const successEmbed = createSuccessEmbed('Panel Deleted')
            .setTitle(`${CustomEmojis.TICK} Panel Deleted`)
            .setDescription(`Successfully deleted the "${selectedPanelName}" panel and all its channels.`)
            .setTimestamp();

          await selection.update({ embeds: [successEmbed], components: [] });

        } catch (error) {
          console.error('Error deleting panel:', error);
          const errorEmbed = createErrorEmbed('An error occurred while deleting the panel.');
          await selection.update({
            components: [],
            embeds: [errorEmbed]
          });
        }

      } catch (error) {
        const errorEmbed = createErrorEmbed('No panel selected. Operation cancelled.');
        await interaction.editReply({
          components: [],
          embeds: [errorEmbed]
        });
      }
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'panel',
  aliases: ['panels'],
  description: 'View and manage server stats panels',
  usage: 'panel',
  permissions: [PermissionFlagsBits.ManageChannels],
  example: 'panel',

  async execute(message: Message, args: string[]): Promise<void> {
    if (!message.guild) {
      const errorEmbed = createErrorEmbed('This command can only be used in a server.');
      await message.reply({ embeds: [errorEmbed] });
      return;
    }

    const member = message.member;
    if (!member || !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const errorEmbed = createErrorEmbed('You need Manage Channels permissions to use this command.');
      await message.reply({ embeds: [errorEmbed] });
      return;
    }

    const db = DatabaseManager.getInstance();
    const panels = await db.getPanels(message.guild.id);

    if (panels.length === 0) {
      const errorEmbed = createErrorEmbed('No server stats panels found. Use `setup` to create one.');
      await message.reply({ embeds: [errorEmbed] });
      return;
    }

    const embed = createInfoEmbed('Server Stats Panels', 'Here are all the active stats panels on this server')
      .setTimestamp();

    // Add panels to embed
    for (const panel of panels) {
      const channelTypeText = panel.channelType === 'vc' ? 'Voice Channels' : 'Text Channels';
      const createdDate = new Date(panel.createdAt).toLocaleDateString();

      embed.addFields([{
        name: `📊 ${panel.panelName}`,
        value: `Type: ${channelTypeText}\nCreated: ${createdDate}`,
        inline: false
      }]);
    }

    await message.reply({ embeds: [embed] });
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
