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
    .setName('add-invites')
    .setDescription('Add bonus invites to a user (Admin only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to add invites to')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('invites')
        .setDescription('Number of invites to add')
        .setRequired(true)
        .setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  category: 'invites_welcome',
  syntax: '/add-invites <user> <invites>',
  permission: 'Administrator',
  example: '/add-invites @Tai 5',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user', true);
    const invitesToAdd = interaction.options.getInteger('invites', true);
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    try {
      const db = DatabaseManager.getInstance();
      db.addBonusInvites(guild.id, targetUser.id, invitesToAdd);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('<:tcet_tick:1437995479567962184> Invites Added Successfully')
        .setDescription(
          `Added **${invitesToAdd}** bonus invites to ${targetUser.toString()}\n\n` +
          `**User:** ${targetUser.username}\n` +
          `**Invites Added:** ${invitesToAdd}\n` +
          `**Added By:** ${interaction.user.username}`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'Invite Management' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error adding invites:', error);
      await interaction.reply({
        content: 'An error occurred while adding invites.',
        ephemeral: true
      });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'add-invites',
  aliases: ['addinvites', 'addinv'],
  description: 'Add bonus invites to a user (Admin only)',
  usage: 'add-invites <user> <amount>',
  example: 'add-invites @Tai 5',
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
      await message.reply('Please provide a user and amount! Usage: `add-invites <user> <amount>`');
      return;
    }

    const userMention = args[0];
    const userId = userMention.replace(/[<@!>]/g, '');
    const invitesToAdd = parseInt(args[1]);

    if (isNaN(invitesToAdd) || invitesToAdd < 1) {
      await message.reply('Please provide a valid number of invites (minimum 1)!');
      return;
    }

    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        await message.reply('User not found in this server!');
        return;
      }

      const db = DatabaseManager.getInstance();
      db.addBonusInvites(guild.id, member.id, invitesToAdd);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('<:tcet_tick:1437995479567962184> Invites Added Successfully')
        .setDescription(
          `Added **${invitesToAdd}** bonus invites to ${member.toString()}\n\n` +
          `**User:** ${member.user.username}\n` +
          `**Invites Added:** ${invitesToAdd}\n` +
          `**Added By:** ${message.author.username}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'Invite Management' });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error adding invites:', error);
      await message.reply('An error occurred while adding invites.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
