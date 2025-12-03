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
    .setName('delete-invites')
    .setDescription('Remove invites from a user (Admin only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to remove invites from')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('invites')
        .setDescription('Number of invites to remove')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of invites to remove')
        .setRequired(false)
        .addChoices(
          { name: 'Bonus Invites', value: 'bonus' },
          { name: 'Both (Normal first)', value: 'both' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  category: 'invites_welcome',
  syntax: '/delete-invites <user> <invites> [type]',
  permission: 'Administrator',
  example: '/delete-invites @Tai 3 normal',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user', true);
    const invitesToRemove = interaction.options.getInteger('invites', true);
    const inviteType = interaction.options.getString('type') || 'normal';
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    try {
      const db = DatabaseManager.getInstance();

      const currentNormalInvites = await db.getUserInviteCount(guild.id, targetUser.id);
      const currentBonusInvites = await db.getUserBonusInvites(guild.id, targetUser.id);
      const totalInvites = currentNormalInvites + currentBonusInvites;

      if (totalInvites < invitesToRemove && inviteType === 'both') {
        await interaction.reply({
          content: `❌ Cannot remove ${invitesToRemove} invites. User only has ${totalInvites} total invites (${currentNormalInvites} normal, ${currentBonusInvites} bonus).`,
          ephemeral: true
        });
        return;
      }

      let normalRemoved = 0;
      let bonusRemoved = 0;
      let errorMessage = '';

      if (inviteType === 'normal') {
        if (currentNormalInvites < invitesToRemove) {
          await interaction.reply({
            content: `❌ Cannot remove ${invitesToRemove} normal invites. User only has ${currentNormalInvites} normal invites.`,
            ephemeral: true
          });
          return;
        }
        normalRemoved = await db.removeNormalInvites(guild.id, targetUser.id, invitesToRemove);
      } else if (inviteType === 'bonus') {
        if (currentBonusInvites < invitesToRemove) {
          await interaction.reply({
            content: `❌ Cannot remove ${invitesToRemove} bonus invites. User only has ${currentBonusInvites} bonus invites.`,
            ephemeral: true
          });
          return;
        }
        await db.removeBonusInvites(guild.id, targetUser.id, invitesToRemove);
        bonusRemoved = invitesToRemove;
      } else if (inviteType === 'both') {
        let remaining = invitesToRemove;

        // Remove normal invites first
        if (currentNormalInvites > 0) {
          const normalToRemove = Math.min(remaining, currentNormalInvites);
          normalRemoved = await db.removeNormalInvites(guild.id, targetUser.id, normalToRemove);
          remaining -= normalRemoved;
        }

        // Remove bonus invites if needed
        if (remaining > 0 && currentBonusInvites > 0) {
          const bonusToRemove = Math.min(remaining, currentBonusInvites);
          await db.removeBonusInvites(guild.id, targetUser.id, bonusToRemove);
          bonusRemoved = bonusToRemove;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('🗑️ Invites Removed Successfully')
        .setDescription(
          `Removed invites from ${targetUser.toString()}\n\n` +
          `**User:** ${targetUser.username}\n` +
          `**Normal Invites Removed:** ${normalRemoved}\n` +
          `**Bonus Invites Removed:** ${bonusRemoved}\n` +
          `**Total Removed:** ${normalRemoved + bonusRemoved}\n` +
          `**Remaining Normal Invites:** ${currentNormalInvites - normalRemoved}\n` +
          `**Remaining Bonus Invites:** ${currentBonusInvites - bonusRemoved}\n` +
          `**Removed By:** ${interaction.user.username}`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'Invite Management' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error removing invites:', error);
      await interaction.reply({
        content: 'An error occurred while removing invites.',
        ephemeral: true
      });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'delete-invites',
  aliases: ['deleteinvites', 'removeinvites', 'delinv'],
  description: 'Remove invites from a user (Admin only)',
  usage: 'delete-invites <user> <amount> [type]',
  example: 'delete-invites @Tai 3 normal',
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

    if (args.length < 2) {
      await message.reply('Please provide a user and amount! Usage: `delete-invites <user> <amount> [type]`\nType options: normal, bonus, both (default: normal)');
      return;
    }

    const userMention = args[0];
    const userId = userMention.replace(/[<@!>]/g, '');
    const invitesToRemove = parseInt(args[1]);
    const inviteType = args[2]?.toLowerCase() || 'normal';

    if (isNaN(invitesToRemove) || invitesToRemove < 1) {
      await message.reply('Please provide a valid number of invites (minimum 1)!');
      return;
    }

    if (!['normal', 'bonus', 'both'].includes(inviteType)) {
      await message.reply('Invalid type! Use: normal, bonus, or both');
      return;
    }

    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        await message.reply('User not found in this server!');
        return;
      }

      const db = DatabaseManager.getInstance();

      const currentNormalInvites = await db.getUserInviteCount(guild.id, member.id);
      const currentBonusInvites = await db.getUserBonusInvites(guild.id, member.id);
      const totalInvites = currentNormalInvites + currentBonusInvites;

      if (totalInvites < invitesToRemove && inviteType === 'both') {
        await message.reply(`❌ Cannot remove ${invitesToRemove} invites. User only has ${totalInvites} total invites (${currentNormalInvites} normal, ${currentBonusInvites} bonus).`);
        return;
      }

      let normalRemoved = 0;
      let bonusRemoved = 0;

      if (inviteType === 'normal') {
        if (currentNormalInvites < invitesToRemove) {
          await message.reply(`❌ Cannot remove ${invitesToRemove} normal invites. User only has ${currentNormalInvites} normal invites.`);
          return;
        }
        normalRemoved = await db.removeNormalInvites(guild.id, member.id, invitesToRemove);
      } else if (inviteType === 'bonus') {
        if (currentBonusInvites < invitesToRemove) {
          await message.reply(`❌ Cannot remove ${invitesToRemove} bonus invites. User only has ${currentBonusInvites} bonus invites.`);
          return;
        }
        await db.removeBonusInvites(guild.id, member.id, invitesToRemove);
        bonusRemoved = invitesToRemove;
      } else if (inviteType === 'both') {
        let remaining = invitesToRemove;

        // Remove normal invites first
        if (currentNormalInvites > 0) {
          const normalToRemove = Math.min(remaining, currentNormalInvites);
          normalRemoved = await db.removeNormalInvites(guild.id, member.id, normalToRemove);
          remaining -= normalRemoved;
        }

        // Remove bonus invites if needed
        if (remaining > 0 && currentBonusInvites > 0) {
          const bonusToRemove = Math.min(remaining, currentBonusInvites);
          await db.removeBonusInvites(guild.id, member.id, bonusToRemove);
          bonusRemoved = bonusToRemove;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('🗑️ Invites Removed Successfully')
        .setDescription(
          `Removed invites from ${member.toString()}\n\n` +
          `**User:** ${member.user.username}\n` +
          `**Normal Invites Removed:** ${normalRemoved}\n` +
          `**Bonus Invites Removed:** ${bonusRemoved}\n` +
          `**Total Removed:** ${normalRemoved + bonusRemoved}\n` +
          `**Remaining Normal Invites:** ${currentNormalInvites - normalRemoved}\n` +
          `**Remaining Bonus Invites:** ${currentBonusInvites - bonusRemoved}\n` +
          `**Removed By:** ${message.author.username}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'Invite Management' });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error removing invites:', error);
      await message.reply('An error occurred while removing invites.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
