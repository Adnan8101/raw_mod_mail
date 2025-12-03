import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  User
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { CustomEmojis } from '../../utils/emoji';

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Check your invite statistics')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check invites for (optional)')
        .setRequired(false)),
  category: 'invites_welcome',
  syntax: '/invites [user]',
  permission: 'None',
  example: '/invites @Tai',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guild = interaction.guild;

    if (!guild) {
      const errorEmbed = createErrorEmbed('This command can only be used in a server!');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    try {
      const db = DatabaseManager.getInstance();

      const regularInvites = await db.getUserInviteCount(guild.id, targetUser.id);
      const leftInvites = await db.getUserLeftCount(guild.id, targetUser.id);
      const fakeInvites = await db.getUserFakeCount(guild.id, targetUser.id);
      const bonusInvites = await db.getUserBonusInvites(guild.id, targetUser.id);
      const totalInvites = regularInvites + bonusInvites - leftInvites - fakeInvites;

      const embed = createInfoEmbed('Invite Statistics', '')
        .setAuthor({
          name: targetUser.username,
          iconURL: targetUser.displayAvatarURL()
        })
        .setDescription(
          `${CustomEmojis.TICK} You currently have **${totalInvites}** invites.\n` +
          `(${regularInvites} regular, ${leftInvites} left, ${fakeInvites} fake, ${bonusInvites} bonus)`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching invite data:', error);
      const errorEmbed = createErrorEmbed('An error occurred while fetching invite statistics.');
      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true
      });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'invites',
  aliases: ['inv', 'invitecount'],
  description: 'Check your invite statistics',
  usage: 'invites [user]',
  example: 'invites @Tai',

  async execute(message: Message, args: string[]): Promise<void> {
    const guild = message.guild;
    if (!guild) {
      const errorEmbed = createErrorEmbed('This command can only be used in a server!');
      await message.reply({ embeds: [errorEmbed] });
      return;
    }

    let targetUser = message.author;

    if (args.length > 0) {
      const userMention = args[0];
      const userId = userMention.replace(/[<@!>]/g, '');

      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          targetUser = member.user;
        } else {
          const errorEmbed = createErrorEmbed('User not found in this server!');
          await message.reply({ embeds: [errorEmbed] });
          return;
        }
      } catch (error) {
        const errorEmbed = createErrorEmbed('Invalid user mentioned!');
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
    }

    try {
      const db = DatabaseManager.getInstance();

      const regularInvites = await db.getUserInviteCount(guild.id, targetUser.id);
      const leftInvites = await db.getUserLeftCount(guild.id, targetUser.id);
      const fakeInvites = await db.getUserFakeCount(guild.id, targetUser.id);
      const bonusInvites = await db.getUserBonusInvites(guild.id, targetUser.id);
      const totalInvites = regularInvites + bonusInvites - leftInvites - fakeInvites;

      const embed = createInfoEmbed('Invite Statistics', '')
        .setAuthor({
          name: targetUser.username,
          iconURL: targetUser.displayAvatarURL()
        })
        .setDescription(
          `${CustomEmojis.TICK} You currently have **${totalInvites}** invites.\n` +
          `(${regularInvites} regular, ${leftInvites} left, ${fakeInvites} fake, ${bonusInvites} bonus)`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching invite data:', error);
      const errorEmbed = createErrorEmbed('An error occurred while fetching invite statistics.');
      await message.reply({ embeds: [errorEmbed] });
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
