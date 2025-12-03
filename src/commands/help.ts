/**
 * Help Command - Universal help system with category dropdown
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  Collection,
  PermissionFlagsBits,
  StringSelectMenuInteraction,
  MessageFlags
} from 'discord.js';
import { EmbedColors, SlashCommand } from '../types';
import { CustomEmojis } from '../utils/emoji';
import { GuildConfigService } from '../services/GuildConfigService';
import { createInfoEmbed, createUsageEmbed } from '../utils/embedHelpers';
import { OWNER_ID } from './owner/evalHelper';
import { GuildMember } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('View bot commands and features')
  .addStringOption(option =>
    option.setName('command')
      .setDescription('Get help for a specific command')
      .setRequired(false)
  );

export const slashCommand: SlashCommand = {
  data: data,
  category: 'General',
  syntax: '/help [command]',
  permission: 'None',
  example: '/help ban',
  execute: async (interaction: ChatInputCommandInteraction, services: any) => {
    await execute(interaction, services);
  }
};

// Comprehensive Category Configuration
const categoryConfig: Record<string, { name: string; emoji: string; description: string }> = {
  antinuke: {
    name: 'Anti-Nuke',
    emoji: '<:antinuke:1437996074559078492>',
    description: 'Anti-Nuke Protection System'
  },
  moderation: {
    name: 'Moderation',
    emoji: CustomEmojis.STAFF,
    description: 'Moderation Tools'
  },
  automod: {
    name: 'AutoMod',
    emoji: CustomEmojis.SETTING,
    description: 'AutoMod System'
  },
  logging: {
    name: 'Logging',
    emoji: CustomEmojis.LOGGING,
    description: 'Logging System'
  },
  autoresponder: {
    name: 'Auto Responder',
    emoji: CustomEmojis.FILES,
    description: 'Auto Responder System'
  },
  invites_welcome: {
    name: 'Invites',
    emoji: '📨',
    description: 'Invites System'
  },
  welcome: {
    name: 'Welcome',
    emoji: '👋',
    description: 'Welcome System'
  },
  serverstats: {
    name: 'Server Stats',
    emoji: '<:serveur:904792335517380618>',
    description: 'Server Statistics'
  },
  quarantine: {
    name: 'Quarantine',
    emoji: CustomEmojis.USER,
    description: 'Quarantine System'
  },
  channels: {
    name: 'Channels',
    emoji: CustomEmojis.CHANNEL,
    description: 'Channel Management'
  },
  tickets: {
    name: 'Tickets',
    emoji: '<a:ticketss:1443830901275496480>',
    description: 'Ticket System'
  },
  utility: {
    name: 'Utility',
    emoji: '🛠️',
    description: 'Utility Commands'
  },
  games: {
    name: 'Games',
    emoji: '<a:games:1445635453326983319>',
    description: 'Fun & Games'
  },
  name_prevention: {
    name: 'Name Prevention',
    emoji: '<:user_icon:1437995661378191493>',
    description: 'Name Prevention System'
  },
  recording: {
    name: 'Recording',
    emoji: '🎙️',
    description: 'Voice Recording'
  },
  general: {
    name: 'General',
    emoji: 'ℹ️',
    description: 'General Commands'
  }
};

function canRunCommand(command: any, member: GuildMember): boolean {
  const commandData = command.slashCommand || command;

  // 1. Owner Check
  if ((commandData.category || '').toLowerCase() === 'owner') {
    return member.id === OWNER_ID;
  }

  // 2. Permission Check
  if (commandData.data?.default_member_permissions) {
    const requiredPerms = BigInt(commandData.data.default_member_permissions);
    if (!member.permissions.has(requiredPerms)) {
      return false;
    }
  }

  return true;
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { guildConfigService: GuildConfigService; commands: Collection<string, any> }
) {
  const prefix = await services.guildConfigService.getPrefix(interaction.guild!.id);
  const commands = services.commands;
  const specificCommand = interaction.options.getString('command');

  // 1. Handle Specific Command Help
  if (specificCommand) {
    const cmd = commands.get(specificCommand.toLowerCase()) ||
      commands.find((c: any) => c.prefixCommand?.aliases?.includes(specificCommand.toLowerCase()));

    if (cmd) {
      // Check if user can run this command
      if (!canRunCommand(cmd, interaction.member as GuildMember)) {
        await interaction.reply({
          embeds: [createInfoEmbed('Permission Denied', 'You do not have permission to view or use this command.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const commandData = cmd.slashCommand || cmd;
      // Hide owner commands from specific help if user is not owner (optional, but good practice)
      // For now, we just proceed as requested for the main menu.

      const help = {
        name: commandData.data?.name || cmd.name,
        description: commandData.data?.description || cmd.description,
        permission: cmd.permission || 'None',
        syntax: cmd.syntax || `/${commandData.data?.name || cmd.name}`,
        examples: cmd.example ? [cmd.example] : (cmd.examples || [])
      };

      const embed = createUsageEmbed(help);
      await interaction.reply({ embeds: [embed] });
      return;
    } else {
      // Command not found logic...
      const suggestions: string[] = [];
      const input = specificCommand.toLowerCase();

      commands.forEach((cmd: any) => {
        // Filter suggestions by permission
        if (!canRunCommand(cmd, interaction.member as GuildMember)) return;

        const cmdName = (cmd.data?.name || cmd.name).toLowerCase();
        const aliases = cmd.prefixCommand?.aliases || [];

        if (cmdName.includes(input) || input.includes(cmdName)) {
          suggestions.push(cmdName);
        }

        aliases.forEach((alias: string) => {
          if (alias.toLowerCase().includes(input) || input.includes(alias.toLowerCase())) {
            suggestions.push(cmdName);
          }
        });
      });

      const uniqueSuggestions = [...new Set(suggestions)].slice(0, 5);
      let errorDescription = `${CustomEmojis.CROSS} Command \`${specificCommand}\` not found.`;

      if (uniqueSuggestions.length > 0) {
        errorDescription += `\n\n**Did you mean:**\n${uniqueSuggestions.map(s => `• \`${prefix}${s}\``).join('\n')}`;
      }

      const errorEmbed = new EmbedBuilder()
        .setColor(EmbedColors.ERROR)
        .setDescription(errorDescription);

      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
  }

  // 2. Group Commands by Category
  const categories: Record<string, any[]> = {};

  commands.forEach((cmd: any) => {
    // Filter by permission
    if (!canRunCommand(cmd, interaction.member as GuildMember)) return;

    const commandData = cmd.slashCommand || cmd;
    let category = (commandData.category || 'general').toLowerCase().replace(/\s+/g, '_');

    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(commandData);
  });

  const sortedCategories = Object.keys(categories).sort();

  // Helper to flatten commands into display strings
  const getCommandDisplayNames = (cmd: any): string[] => {
    const commandData = cmd.slashCommand || cmd;
    const data = commandData.data?.toJSON ? commandData.data.toJSON() : commandData.data;
    const name = data?.name || commandData.name;

    if (!name) return [];

    if (!data?.options || data.options.length === 0) {
      return [`/${name}`];
    }

    const subcommands: string[] = [];

    const extract = (parentName: string, options: any[]) => {
      let hasSub = false;
      for (const opt of options) {
        // Type 1 is SUB_COMMAND, Type 2 is SUB_COMMAND_GROUP
        if (opt.type === 1 || opt.type === 2) {
          hasSub = true;
          if (opt.options) {
            extract(`${parentName} ${opt.name}`, opt.options);
          } else {
            subcommands.push(`/${parentName} ${opt.name}`);
          }
        }
      }
      if (!hasSub) {
        subcommands.push(`/${parentName}`);
      }
    };

    extract(name, data.options);
    return subcommands.length > 0 ? subcommands : [`/${name}`];
  };

  // Calculate total commands (including subcommands)
  let totalCommandsCount = 0;
  commands.forEach((cmd: any) => {
    if (!canRunCommand(cmd, interaction.member as GuildMember)) return;
    totalCommandsCount += getCommandDisplayNames(cmd).length;
  });

  // 3. Build Main Menu Embed
  const moduleList = sortedCategories.map(key => {
    const config = categoryConfig[key] || {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      emoji: '📁',
      description: 'Commands'
    };
    return `${config.emoji} **${config.name}**`;
  }).join('\n');

  const mainEmbed = createInfoEmbed(
    `${CustomEmojis.SETTING} Bot Help & Commands`,
    `Welcome to the help menu! Select a category below to view commands.\n\n` +
    `**Current Prefix:** \`${prefix}\`\n` +
    `**Total Commands:** ${totalCommandsCount}\n\n` +
    `**Modules**\n${moduleList}\n\n` +
    `Use slash commands (\`/\`) or prefix commands (\`${prefix}\`)`
  )
    .setFooter({ text: 'Select a category from the dropdown below' })
    .setTimestamp();

  // 4. Build Dropdown
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`help_category_${interaction.user.id}`)
    .setPlaceholder('🔍 Select a category to view commands')
    .addOptions(
      {
        label: 'Back to Home',
        value: 'home',
        description: 'Return to the main help menu',
        emoji: '🏠',
      },
      ...sortedCategories.map(key => {
        const config = categoryConfig[key] || {
          name: key.charAt(0).toUpperCase() + key.slice(1),
          emoji: '📁',
          description: 'Commands'
        };
        return {
          label: config.name,
          value: key,
          description: config.description.substring(0, 100),
          emoji: config.emoji,
        };
      })
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const response = await interaction.reply({
    embeds: [mainEmbed],
    components: [row],
  });

  // 5. Interaction Collector
  const collector = response.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId === `help_category_${interaction.user.id}`,
    time: 300000, // 5 minutes
    componentType: ComponentType.StringSelect,
  });

  collector.on('collect', async (i: StringSelectMenuInteraction) => {
    try {
      // Defer update immediately to prevent "Unknown interaction" if processing takes time
      try {
        if (!i.deferred && !i.replied) {
          await i.deferUpdate();
        }
      } catch (error) {
        // Ignore if already acknowledged or unknown interaction
        return;
      }

      const selectedCategory = i.values[0];

      if (selectedCategory === 'home') {
        await i.editReply({ embeds: [mainEmbed], components: [row] });
        return;
      }

      const config = categoryConfig[selectedCategory] || {
        name: selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1),
        emoji: '📁',
        description: 'Commands'
      };
      const categoryCommands = categories[selectedCategory];

      if (!categoryCommands) {
        await i.editReply({ content: 'Category not found or empty.', components: [] });
        return;
      }

      const embeds: EmbedBuilder[] = [];
      const chunkSize = 25;

      // Flatten all commands in this category
      let allCommandStrings: string[] = [];
      for (const cmd of categoryCommands) {
        allCommandStrings.push(...getCommandDisplayNames(cmd));
      }

      // Sort alphabetically
      allCommandStrings.sort();

      for (let j = 0; j < allCommandStrings.length; j += chunkSize) {
        const chunk = allCommandStrings.slice(j, j + chunkSize);

        const commandList = chunk.map(str => `• \`${str}\``).join('\n');

        const description = j === 0
          ? `${config.description}\n\n**Commands**\n${commandList}`
          : `**Commands (Cont.)**\n${commandList}`;

        const embed = createInfoEmbed(
          `${config.emoji} ${config.name}${j > 0 ? ` (Page ${Math.floor(j / chunkSize) + 1})` : ''}`,
          description
        );

        if (j === 0) {
          embed.setFooter({ text: `Type ${prefix}help <command> for details` });
          embed.setTimestamp();
        }

        embeds.push(embed);
      }

      if (embeds.length > 10) {
        embeds.length = 10;
        const lastEmbed = embeds[9];
        lastEmbed.setFooter({ text: '⚠️ Too many commands to display. Some are hidden.' });
      }

      await i.editReply({ embeds: embeds, components: [row] });
    } catch (error) {
      console.error('Error in help interaction collector:', error);
      // If we deferred but failed to edit, or failed to defer
      try {
        if (!i.replied && !i.deferred) {
          await i.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
        } else {
          await i.editReply({ content: 'An error occurred while navigating.' });
        }
      } catch (e) {
        // Interaction dead
      }
    }
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => { });
  });
}
