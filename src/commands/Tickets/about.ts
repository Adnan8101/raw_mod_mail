import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotClient } from '../../core/client';

export const data = new SlashCommandBuilder()
  .setName('about')
  .setDescription('Information about the bot');

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: BotClient
): Promise<void> {
  await interaction.deferReply();

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('About Me')
    .setDescription('Advanced Discord Ticket System')
    .addFields(
      {
        name: 'Bot Name',
        value: client.user?.username || 'Ticket Bot',
        inline: false
      },
      {
        name: 'Version',
        value: '2.0.0',
        inline: false
      },
      {
        name: 'Author',
        value: 'Extreme Official ',
        inline: false
      },
      {
        name: 'Description',
        value: 'Advanced Discord Ticket System with Universal Interaction Architecture',
        inline: false
      },
      {
        name: 'Features',
        value: 'Ticket Management\nPanel Configuration\nTranscript Generation\nAutomatic Logging',
        inline: false
      },
      {
        name: 'Support',
        value: 'For support and updates, contact the bot administrator',
        inline: false
      }
    )
    .setThumbnail(client.user?.displayAvatarURL() || null)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  // hmm
}
