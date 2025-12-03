import { TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import * as discordTranscripts from 'discord-html-transcripts';

export interface TranscriptOptions {
  ticketId: string;
  ticketNumber: number;
  username: string;
  userId: string;
  staffName?: string;
  staffId?: string;
  panelName: string;
  createdAt: Date;
  closedAt?: Date;
}

/**
 * Generates a world-class professional HTML transcript for a ticket
 * This uses discord-html-transcripts for a 100% accurate Discord clone
 * Captures ALL messages, images, attachments, embeds, and formatting
 */
export async function generateProfessionalTranscript(
  channel: TextChannel,
  options: TranscriptOptions
): Promise<AttachmentBuilder> {
  const {
    ticketNumber,
    panelName,
  } = options;


  // Generate the transcript with ALL messages - 100% Discord clone
  // This captures:
  // - All messages from first to last
  // - All images and attachments
  // - All embeds with full formatting
  // - User avatars and roles
  // - Timestamps and message metadata
  // - Reactions and replies
  const attachment = await discordTranscripts.createTranscript(channel, {
    limit: -1, // -1 means fetch ALL messages (no limit)
    filename: `ticket-${ticketNumber}-transcript.html`,
    saveImages: true, // Save all images in the transcript
    poweredBy: false, // Remove "powered by" footer
    footerText: `Ticket #${ticketNumber} | ${panelName}`,
  }) as AttachmentBuilder;


  return attachment;
}

/**
 * Creates a professional embed for the transcript
 */
export function createTranscriptEmbed(options: TranscriptOptions): EmbedBuilder {
  const {
    ticketId,
    ticketNumber,
    username,
    userId,
    staffName,
    staffId,
    panelName,
    createdAt,
    closedAt
  } = options;

  const duration = closedAt 
    ? Math.floor((closedAt.getTime() - createdAt.getTime()) / 1000) 
    : 0;

  const durationText = duration > 0 
    ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m ${duration % 60}s`
    : 'N/A';

  const embed = new EmbedBuilder()
    .setTitle(`<:module:1437997093753983038> Ticket Transcript #${ticketNumber}`)
    .setColor(0x5865F2)
    .addFields(
      {
        name: '<:user_icon:1437995661378191493> User Information',
        value: [
          `**Name:** ${username}`,
          `**User ID:** \`${userId}\``,
          `**Mention:** <@${userId}>`
        ].join('\n'),
        inline: true
      },
      {
        name: '<:xieron_staffs:1437995300164730931> Staff Information',
        value: staffName && staffId
          ? [
              `**Name:** ${staffName}`,
              `**User ID:** \`${staffId}\``,
              `**Mention:** <@${staffId}>`
            ].join('\n')
          : 'No staff assigned',
        inline: true
      },
      {
        name: '<:k9logging:1437996243803705354> Ticket Statistics',
        value: [
          `**Ticket ID:** \`${ticketId}\``,
          `**Ticket Number:** \`#${ticketNumber}\``,
          `**Panel:** ${panelName}`,
          `**Duration:** ${durationText}`
        ].join('\n'),
        inline: false
      },
      {
        name: '<:caution:1437997212008185866> Timeline',
        value: [
          `**Created:** <t:${Math.floor(createdAt.getTime() / 1000)}:F>`,
          closedAt ? `**Closed:** <t:${Math.floor(closedAt.getTime() / 1000)}:F>` : '**Status:** Still Open'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ 
      text: `Ticket System | ${panelName}`
    })
    .setTimestamp();

  return embed;
}

/**
 * Generates a 4-digit random ticket number
 */
export function generateTicketNumber(): number {
  return Math.floor(1000 + Math.random() * 9000);
}
