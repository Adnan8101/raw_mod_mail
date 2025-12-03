import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('reset-invites')
    .setDescription('Reset all invites for a user to zero (Admin only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to reset invites for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  category: 'invites_welcome',
  syntax: '/reset-invites <user>',
  permission: 'Administrator',
  example: '/reset-invites @Tai',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user', true);
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    try {
      const db = DatabaseManager.getInstance();

      // Get current invite counts before resetting
      const currentNormalInvites = await db.getUserInviteCount(guild.id, targetUser.id);
      const currentBonusInvites = await db.getUserBonusInvites(guild.id, targetUser.id);
      const currentLeftInvites = await db.getUserLeftCount(guild.id, targetUser.id);
      const currentFakeInvites = await db.getUserFakeCount(guild.id, targetUser.id);

      // Reset all invites
      const resetResult = await db.resetUserInvites(guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔄 Invites Reset Successfully')
        .setDescription(
          `All invites have been reset for ${targetUser.toString()}\n\n` +
          `**User:** ${targetUser.username}\n` +
          `**Previous Normal Invites:** ${currentNormalInvites}\n` +
          `**Previous Bonus Invites:** ${currentBonusInvites}\n` +
          `**Previous Left Invites:** ${currentLeftInvites}\n` +
          `**Previous Fake Invites:** ${currentFakeInvites}\n` +
          `**Total Reset:** ${resetResult.normalRemoved + resetResult.bonusRemoved}\n\n` +
          `**Current Invites:** 0 (0 normal, 0 left, 0 fake, 0 bonus)\n` +
          `**Reset By:** ${interaction.user.username}`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'Invite Management' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error resetting invites:', error);
      await interaction.reply({
        content: 'An error occurred while resetting invites.',
        ephemeral: true
      });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'reset-invites',
  aliases: ['resetinvites', 'resetinv', 'clearinvites'],
  description: 'Reset all invites for a user to zero (Admin only)',
  usage: 'reset-invites <user>',
  example: 'reset-invites @Tai',
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
      await message.reply('Please provide a user! Usage: `reset-invites <user>`');
      return;
    }

    const userMention = args[0];
    const userId = userMention.replace(/[<@!>]/g, '');

    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        await message.reply('User not found in this server!');
        return;
      }

      const db = DatabaseManager.getInstance();

      // Get current invite counts before resetting
      const currentNormalInvites = await db.getUserInviteCount(guild.id, member.id);
      const currentBonusInvites = await db.getUserBonusInvites(guild.id, member.id);
      const currentLeftInvites = await db.getUserLeftCount(guild.id, member.id);
      const currentFakeInvites = await db.getUserFakeCount(guild.id, member.id);

      // Reset all invites
      const resetResult = await db.resetUserInvites(guild.id, member.id);

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔄 Invites Reset Successfully')
        .setDescription(
          `All invites have been reset for ${member.toString()}\n\n` +
          `**User:** ${member.user.username}\n` +
          `**Previous Normal Invites:** ${currentNormalInvites}\n` +
          `**Previous Bonus Invites:** ${currentBonusInvites}\n` +
          `**Previous Left Invites:** ${currentLeftInvites}\n` +
          `**Previous Fake Invites:** ${currentFakeInvites}\n` +
          `**Total Reset:** ${resetResult.normalRemoved + resetResult.bonusRemoved}\n\n` +
          `**Current Invites:** 0 (0 normal, 0 left, 0 fake, 0 bonus)\n` +
          `**Reset By:** ${message.author.username}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'Invite Management' });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error resetting invites:', error);
      await message.reply('An error occurred while resetting invites.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
