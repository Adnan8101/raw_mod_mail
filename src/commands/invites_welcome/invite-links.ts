import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  User
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('invite-links')
    .setDescription('View all your invite links')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check invite links for (optional)')
        .setRequired(false)),
  category: 'invites_welcome',
  syntax: '/invite-links [user]',
  permission: 'None',
  example: '/invite-links @Tai',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    try {
      const db = DatabaseManager.getInstance();
      const inviteTrackers = await db.getInviteTrackers(guild.id, targetUser.id);

      if (inviteTrackers.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF6B6B)
          .setAuthor({
            name: targetUser.username,
            iconURL: targetUser.displayAvatarURL()
          })
          .setDescription('**No invite links found.**')
          .setTimestamp()
          .setFooter({ text: 'Invite Links' });

        await interaction.reply({ embeds: [embed] });
        return;
      }

      const fields = inviteTrackers.map((tracker, index) => {
        const expiresText = tracker.expiresAt
          ? `<t:${Math.floor(new Date(tracker.expiresAt).getTime() / 1000)}:R>`
          : 'Never';

        const maxUsesText = tracker.maxUses ? tracker.maxUses.toString() : '∞';

        return {
          name: `📎 Invite Link ${index + 1}`,
          value: `**Code:** \`${tracker.inviteCode}\`\n` +
            `**Uses:** ${tracker.uses}/${maxUsesText}\n` +
            `**Expires:** ${expiresText}\n` +
            `**Created:** <t:${Math.floor(new Date(tracker.createdAt).getTime() / 1000)}:R>`,
          inline: false
        };
      });

      // Split into multiple embeds if too many fields
      const embedsToSend: EmbedBuilder[] = [];
      const fieldsPerEmbed = 6;

      for (let i = 0; i < fields.length; i += fieldsPerEmbed) {
        const currentFields = fields.slice(i, i + fieldsPerEmbed);

        const embed = new EmbedBuilder()
          .setColor(0x00AE86)
          .setAuthor({
            name: `${targetUser.username}'s Invite Links`,
            iconURL: targetUser.displayAvatarURL()
          })
          .addFields(currentFields)
          .setTimestamp()
          .setFooter({ text: `Invite Links • Page ${Math.floor(i / fieldsPerEmbed) + 1}` });

        if (i === 0) {
          embed.setDescription(`**Total invite links:** ${inviteTrackers.length}`);
        }

        embedsToSend.push(embed);
      }

      await interaction.reply({ embeds: embedsToSend });
    } catch (error) {
      console.error('Error fetching invite links:', error);
      await interaction.reply({
        content: 'An error occurred while fetching invite links.',
        ephemeral: true
      });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'invite-links',
  aliases: ['invitelinks', 'invlinks', 'myinvites'],
  description: 'View all your invite links',
  usage: 'invite-links [user]',
  example: 'invite-links @Tai',

  async execute(message: Message, args: string[]): Promise<void> {
    const guild = message.guild;
    if (!guild) {
      await message.reply('This command can only be used in a server!');
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
          await message.reply('User not found in this server!');
          return;
        }
      } catch (error) {
        await message.reply('Invalid user mentioned!');
        return;
      }
    }

    try {
      const db = DatabaseManager.getInstance();
      const inviteTrackers = await db.getInviteTrackers(guild.id, targetUser.id);

      if (inviteTrackers.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF6B6B)
          .setAuthor({
            name: targetUser.username,
            iconURL: targetUser.displayAvatarURL()
          })
          .setDescription('**No invite links found.**')
          .setTimestamp()
          .setFooter({ text: 'Invite Links' });

        await message.reply({ embeds: [embed] });
        return;
      }

      const fields = inviteTrackers.map((tracker, index) => {
        const expiresText = tracker.expiresAt
          ? `<t:${Math.floor(new Date(tracker.expiresAt).getTime() / 1000)}:R>`
          : 'Never';

        const maxUsesText = tracker.maxUses ? tracker.maxUses.toString() : '∞';

        return {
          name: `📎 Invite Link ${index + 1}`,
          value: `**Code:** \`${tracker.inviteCode}\`\n` +
            `**Uses:** ${tracker.uses}/${maxUsesText}\n` +
            `**Expires:** ${expiresText}\n` +
            `**Created:** <t:${Math.floor(new Date(tracker.createdAt).getTime() / 1000)}:R>`,
          inline: false
        };
      });

      // Split into multiple embeds if too many fields
      const embedsToSend: EmbedBuilder[] = [];
      const fieldsPerEmbed = 6;

      for (let i = 0; i < fields.length; i += fieldsPerEmbed) {
        const currentFields = fields.slice(i, i + fieldsPerEmbed);

        const embed = new EmbedBuilder()
          .setColor(0x00AE86)
          .setAuthor({
            name: `${targetUser.username}'s Invite Links`,
            iconURL: targetUser.displayAvatarURL()
          })
          .addFields(currentFields)
          .setTimestamp()
          .setFooter({ text: `Invite Links • Page ${Math.floor(i / fieldsPerEmbed) + 1}` });

        if (i === 0) {
          embed.setDescription(`**Total invite links:** ${inviteTrackers.length}`);
        }

        embedsToSend.push(embed);
      }

      await message.reply({ embeds: embedsToSend });
    } catch (error) {
      console.error('Error fetching invite links:', error);
      await message.reply('An error occurred while fetching invite links.');
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
