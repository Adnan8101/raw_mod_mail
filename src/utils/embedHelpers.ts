import { EmbedBuilder, User } from 'discord.js';
import { EmbedColors } from '../types';
import { CustomEmojis } from './emoji';

export interface CommandHelp {
  name: string;
  description: string;
  permission: string;
  syntax: string;
  examples: string[];
}

export function createHelpEmbed(help: CommandHelp): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle(`${CustomEmojis.SETTING} Command Help: ${help.name}`)
    .addFields(
      { name: 'Description', value: help.description, inline: false },
      { name: `${CustomEmojis.ADMIN} Permission Required`, value: help.permission, inline: false },
      { name: 'Syntax', value: `\`\`\`${help.syntax}\`\`\``, inline: false },
      {
        name: 'Examples',
        value: help.examples.map(ex => `\`${ex}\``).join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: 'Use @ to mention users/roles' });
}

export function createSuccessEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setDescription(`${CustomEmojis.TICK} ${description}`);
}

export function createErrorEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.ERROR)
    .setDescription(`${CustomEmojis.CROSS} ${description}`);
}

export function createWarningEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.WARNING)
    .setDescription(`${CustomEmojis.CAUTION} ${description}`);
}

export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle(title)
    .setDescription(description);
}

export function createModerationEmbed(
  action: string,
  target: User,
  moderator: User,
  reason: string,
  fields?: { name: string; value: string; inline?: boolean }[]
): EmbedBuilder {
  const description = `${CustomEmojis.TICK} ${action} ${target}`;

  return new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setDescription(description);
}

export function createUsageEmbed(help: CommandHelp): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .addFields(
      { name: 'Name', value: help.name, inline: true },
      { name: 'Description', value: help.description, inline: true },
      { name: 'Permission Required', value: help.permission, inline: false },
      { name: 'Syntax', value: `\`${help.syntax}\``, inline: false },
      { name: 'Example', value: help.examples.map(ex => `\`${ex}\``).join('\n'), inline: false }
    );
}
