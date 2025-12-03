import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  VoiceChannel,
  TextChannel,
  Client,
  Guild
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';

async function updateServerStats(guild: Guild): Promise<{ updated: number; errors: string[] }> {
  const db = DatabaseManager.getInstance();
  const panels = await db.getPanels(guild.id);

  let updated = 0;
  const errors: string[] = [];

  for (const panel of panels) {
    try {
      await guild.members.fetch();
      await guild.members.fetch({ withPresences: true });

      const totalMembers = guild.memberCount;
      const users = guild.members.cache.filter((member: GuildMember) => !member.user.bot).size;
      const bots = guild.members.cache.filter((member: GuildMember) => member.user.bot).size;

      // Status counts
      const online = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'online').size;
      const idle = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'idle').size;
      const dnd = guild.members.cache.filter(m => !m.user.bot && m.presence?.status === 'dnd').size;

      // Update channels
      const updateChannel = async (id: string, name: string) => {
        if (!id) return;
        try {
          const channel = await guild.channels.fetch(id);
          if (channel) {
            if (panel.channelType === 'vc') {
              await (channel as VoiceChannel).setName(name);
            } else {
              await (channel as TextChannel).setName(name);
            }
          }
        } catch (e) {
          // Ignore missing channels
        }
      };

      await updateChannel(panel.usersChannelId, panel.channelType === 'vc' ? `Members : ${users}` : `members-${users}`);
      await updateChannel(panel.botsChannelId, panel.channelType === 'vc' ? `Bots : ${bots}` : `bots-${bots}`);

      // Status channel (stored in onlineChannelId)
      if (panel.onlineChannelId) {
        await updateChannel(panel.onlineChannelId, panel.channelType === 'vc' ? `🟢 ${online} | 🌙 ${idle} | ⛔ ${dnd}` : `status-${online}-${idle}-${dnd}`);
      }

      await updateChannel(panel.totalChannelId, panel.channelType === 'vc' ? `All : ${totalMembers}` : `all-${totalMembers}`);

      // Legacy support (if idle/dnd still exist in DB)
      if (panel.idleChannelId) await updateChannel(panel.idleChannelId, panel.channelType === 'vc' ? `🌙 Idle: ${idle}` : `idle-${idle}`);
      if (panel.dndChannelId) await updateChannel(panel.dndChannelId, panel.channelType === 'vc' ? `⛔ DND: ${dnd}` : `dnd-${dnd}`);

      updated++;

    } catch (error) {
      errors.push(`Error updating panel "${panel.panelName}": ${error}`);
    }
  }

  return { updated, errors };
}

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Manually refresh all server stats panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: 'You need Manage Channels permissions to use this command.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { updated, errors } = await updateServerStats(interaction.guild);

      if (updated === 0 && errors.length === 0) {
        await interaction.editReply('No server stats panels found to refresh.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(updated > 0 ? 0x00ff00 : 0xff6b6b)
        .setTitle('Server Stats Refresh')
        .setDescription(`Refreshed ${updated} panel(s)`)
        .setTimestamp()
        .setFooter({ text: 'Manual Refresh' });

      if (errors.length > 0) {
        embed.addFields([{
          name: 'Errors',
          value: errors.slice(0, 5).join('\n'),
          inline: false
        }]);
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error refreshing stats:', error);
      await interaction.editReply('An error occurred while refreshing server stats.');
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'refresh',
  aliases: ['update'],
  description: 'Manually refresh all server stats panels',
  usage: 'refresh',
  permissions: [PermissionFlagsBits.ManageChannels],
  example: 'refresh',

  async execute(message: Message, args: string[]): Promise<void> {
    if (!message.guild) {
      await message.reply('This command can only be used in a server.');
      return;
    }

    const member = message.member;
    if (!member || !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('You need Manage Channels permissions to use this command.');
      return;
    }

    const statusMessage = await message.reply('Refreshing server stats...');

    try {
      const { updated, errors } = await updateServerStats(message.guild);

      if (updated === 0 && errors.length === 0) {
        await statusMessage.edit('No server stats panels found to refresh.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(updated > 0 ? 0x00ff00 : 0xff6b6b)
        .setTitle('Server Stats Refresh')
        .setDescription(`Refreshed ${updated} panel(s)`)
        .setTimestamp()
        .setFooter({ text: 'Manual Refresh' });

      if (errors.length > 0) {
        embed.addFields([{
          name: 'Errors',
          value: errors.slice(0, 5).join('\n'),
          inline: false
        }]);
      }

      await statusMessage.edit({ content: '', embeds: [embed] });

    } catch (error) {
      console.error('Error refreshing stats:', error);
      await statusMessage.edit('An error occurred while refreshing server stats.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand, updateServerStats };
