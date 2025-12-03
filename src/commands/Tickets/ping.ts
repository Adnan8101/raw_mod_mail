import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotClient } from '../../core/client';
export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency');

export async function execute(interaction: ChatInputCommandInteraction) {
  // Measure actual round-trip latency
  const replyStart = Date.now();
  await interaction.deferReply();
  const replyLatency = Date.now() - replyStart;

  // WebSocket ping is the actual API latency
  const wsLatency = Math.round(interaction.client.ws.ping);

  await interaction.editReply(`🏓 **Bot: ${replyLatency}ms** | **API: ${wsLatency}ms**`);
}