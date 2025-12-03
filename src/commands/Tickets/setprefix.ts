import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotClient } from '../../core/client';

export const data = new SlashCommandBuilder()
  .setName('setprefix')
  .setDescription('Set the bot prefix for this server')
  .addStringOption(option =>
    option
      .setName('prefix')
      .setDescription('The new prefix (e.g., !, $, ?, etc.)')
      .setRequired(true)
      .setMaxLength(5)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction, client: BotClient) {
  try {
    if (!interaction.guild) {
      await interaction.reply({
        content: '<:tcet_cross:1437995480754946178> This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const newPrefix = interaction.options.getString('prefix', true);

    // Validate prefix
    if (newPrefix.length > 5) {
      await interaction.reply({
        content: '<:tcet_cross:1437995480754946178> Prefix must be 5 characters or less.',
        ephemeral: true,
      });
      return;
    }

    // Save the new prefix
    await client.db.saveGuildConfig(interaction.guild.id, newPrefix);

    const embed = new EmbedBuilder()
      .setTitle('<:tcet_tick:1437995479567962184> Prefix Updated')
      .setDescription(`The bot prefix has been changed to: \`${newPrefix}\``)
      .setColor(0x00ff00)
      .addFields(
        { name: 'Example Usage', value: `\`${newPrefix}ticket panel setup\`\n\`${newPrefix}ping\`\n\`${newPrefix}help\`` }
      )
      .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: false });
  } catch (error) {
    await interaction.reply({
      content: '<:tcet_cross:1437995480754946178> An error occurred while setting the prefix.',
      ephemeral: true,
    });
  }
}
