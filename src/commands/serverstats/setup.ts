import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  ChannelType,
  CategoryChannel
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup a server stats panel')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Channel type for the stats')
        .setRequired(true)
        .addChoices(
          { name: 'Voice Channels', value: 'vc' },
          { name: 'Text Channels', value: 'text' }
        )
    )
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name for this stats panel')
        .setRequired(true)
        .setMaxLength(50)
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

    const channelType = interaction.options.getString('type') as 'vc' | 'text';
    const panelName = interaction.options.getString('name')!;

    await interaction.deferReply({ ephemeral: true });

    try {
      const db = DatabaseManager.getInstance();

      // Check if panel already exists
      const existingPanel = await db.getPanel(interaction.guild.id, panelName);
      if (existingPanel) {
        await interaction.editReply(`A panel named "${panelName}" already exists!`);
        return;
      }

      // Create category
      const category = await interaction.guild.channels.create({
        name: `📊 ${panelName}`,
        type: ChannelType.GuildCategory,
        position: 0 // Put at the top
      });

      // Get server stats
      const guild = interaction.guild;
      await guild.members.fetch(); // Fetch all members
      await guild.members.fetch({ withPresences: true }); // Fetch presences

      const totalMembers = guild.memberCount;
      const users = guild.members.cache.filter(member => !member.user.bot).size;
      const bots = guild.members.cache.filter(member => member.user.bot).size;

      // Status counts
      const online = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'online').size;
      const idle = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'idle').size;
      const dnd = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'dnd').size;

      // Create channels based on type
      let totalChannel, usersChannel, botsChannel;
      let onlineChannel, idleChannel, dndChannel;

      if (channelType === 'vc') {
        const createVc = async (name: string) => {
          if (!interaction.guild) throw new Error('Guild not found');
          return await interaction.guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: category,
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone,
                deny: [PermissionFlagsBits.Connect]
              }
            ]
          });
        };

        usersChannel = await createVc(`Members : ${users}`);
        botsChannel = await createVc(`Bots : ${bots}`);
        onlineChannel = await createVc(`🟢 ${online} | 🌙 ${idle} | ⛔ ${dnd}`);
        totalChannel = await createVc(`All : ${totalMembers}`);

      } else {
        const createText = async (name: string) => {
          if (!interaction.guild) throw new Error('Guild not found');
          return await interaction.guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone,
                deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
              }
            ]
          });
        };

        usersChannel = await createText(`members-${users}`);
        botsChannel = await createText(`bots-${bots}`);
        onlineChannel = await createText(`status-${online}-${idle}-${dnd}`);
        totalChannel = await createText(`all-${totalMembers}`);
      }

      // Save to database
      await db.createPanel({
        guildId: interaction.guild.id,
        panelName: panelName,
        channelType: channelType,
        categoryId: category.id,
        totalChannelId: totalChannel.id,
        usersChannelId: usersChannel.id,
        botsChannelId: botsChannel.id,
        onlineChannelId: onlineChannel.id, // Used for Status channel
        idleChannelId: undefined,
        dndChannelId: undefined
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('Server Stats Panel Created')
        .setDescription(`Successfully created "${panelName}" stats panel`)
        .addFields([
          { name: 'Panel Name', value: panelName, inline: false },
          { name: 'Channel Type', value: channelType === 'vc' ? 'Voice Channels' : 'Text Channels', inline: false },
          { name: 'Total Members', value: totalMembers.toString(), inline: true },
          { name: 'Users', value: users.toString(), inline: true },
          { name: 'Bots', value: bots.toString(), inline: true },
          { name: 'Status', value: `🟢 ${online} | 🌙 ${idle} | ⛔ ${dnd}`, inline: false }
        ])
        .setTimestamp()
        .setFooter({ text: 'Server Stats will auto-update every 10 minutes' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error setting up stats panel:', error);
      await interaction.editReply('An error occurred while setting up the stats panel.');
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'setup',
  description: 'Setup a server stats panel',
  usage: 'setup <vc|text> <panel_name>',
  permissions: [PermissionFlagsBits.Administrator],
  example: 'setup vc "Main Stats"',

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

    if (args.length < 2) {
      await message.reply('Usage: `setup <vc|text> <panel_name>`\nExample: `setup vc "Main Stats"`');
      return;
    }

    const channelType = args[0].toLowerCase();
    if (channelType !== 'vc' && channelType !== 'text') {
      await message.reply('Channel type must be either "vc" (voice) or "text".');
      return;
    }

    const panelName = args.slice(1).join(' ').replace(/['"]/g, '');
    if (!panelName) {
      await message.reply('Please provide a panel name.');
      return;
    }

    const statusMessage = await message.reply('Setting up server stats panel...');

    try {
      const db = DatabaseManager.getInstance();

      // Check if panel already exists
      const existingPanel = await db.getPanel(message.guild.id, panelName);
      if (existingPanel) {
        await statusMessage.edit(`A panel named "${panelName}" already exists!`);
        return;
      }

      // Create category
      const category = await message.guild.channels.create({
        name: `📊 ${panelName}`,
        type: ChannelType.GuildCategory,
        position: 0 // Put at the top
      });

      // Get server stats
      const guild = message.guild;
      await guild.members.fetch(); // Fetch all members
      await guild.members.fetch({ withPresences: true }); // Fetch presences

      const totalMembers = guild.memberCount;
      const users = guild.members.cache.filter(member => !member.user.bot).size;
      const bots = guild.members.cache.filter(member => member.user.bot).size;

      // Status counts
      const online = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'online').size;
      const idle = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'idle').size;
      const dnd = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'dnd').size;

      // Create channels based on type
      let totalChannel, usersChannel, botsChannel;
      let onlineChannel, idleChannel, dndChannel;

      if (channelType === 'vc') {
        const createVc = async (name: string) => {
          if (!message.guild) throw new Error('Guild not found');
          return await message.guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: category,
            permissionOverwrites: [
              {
                id: message.guild.roles.everyone,
                deny: [PermissionFlagsBits.Connect]
              }
            ]
          });
        };

        usersChannel = await createVc(`Members : ${users}`);
        botsChannel = await createVc(`Bots : ${bots}`);
        onlineChannel = await createVc(`🟢 ${online} | 🌙 ${idle} | ⛔ ${dnd}`);
        totalChannel = await createVc(`All : ${totalMembers}`);

      } else {
        const createText = async (name: string) => {
          if (!message.guild) throw new Error('Guild not found');
          return await message.guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
              {
                id: message.guild.roles.everyone,
                deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
              }
            ]
          });
        };

        usersChannel = await createText(`members-${users}`);
        botsChannel = await createText(`bots-${bots}`);
        onlineChannel = await createText(`status-${online}-${idle}-${dnd}`);
        totalChannel = await createText(`all-${totalMembers}`);
      }

      // Save to database
      await db.createPanel({
        guildId: message.guild.id,
        panelName: panelName,
        channelType: channelType as 'vc' | 'text',
        categoryId: category.id,
        totalChannelId: totalChannel.id,
        usersChannelId: usersChannel.id,
        botsChannelId: botsChannel.id,
        onlineChannelId: onlineChannel.id, // Used for Status channel
        idleChannelId: undefined,
        dndChannelId: undefined
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('Server Stats Panel Created')
        .setDescription(`Successfully created "${panelName}" stats panel`)
        .addFields([
          { name: 'Panel Name', value: panelName, inline: false },
          { name: 'Channel Type', value: channelType === 'vc' ? 'Voice Channels' : 'Text Channels', inline: false },
          { name: 'Total Members', value: totalMembers.toString(), inline: true },
          { name: 'Users', value: users.toString(), inline: true },
          { name: 'Bots', value: bots.toString(), inline: true },
          { name: 'Status', value: `🟢 ${online} | 🌙 ${idle} | ⛔ ${dnd}`, inline: false }
        ])
        .setTimestamp()
        .setFooter({ text: 'Server Stats will auto-update every 10 minutes' });

      await statusMessage.edit({ content: '', embeds: [embed] });

    } catch (error) {
      console.error('Error setting up stats panel:', error);
      await statusMessage.edit('An error occurred while setting up the stats panel.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
