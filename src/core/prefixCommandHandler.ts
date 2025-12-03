import { Message, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotClient } from './client';

export class PrefixCommandHandler {
  /**
   * Handle prefix commands from messages
   */
  async handleMessage(message: Message, client: BotClient): Promise<void> {
    // Ignore bots
    if (message.author.bot) return;

    // Ignore DMs
    if (!message.guild) return;

    // Get guild-specific prefix (now cached)
    const prefix = await client.db.getPrefix(message.guild.id);

    // Check if message starts with prefix
    if (!message.content.startsWith(prefix)) return;

    // Parse command and args
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    // Get member for permission checks
    const member = message.member;
    if (!member) return;

    // Add immediate reaction for instant feedback
    const reactionPromise = message.react('⏳').catch(() => { });

    try {
      switch (commandName) {
        case 'ticket':
          await this.handleTicketCommand(message, args, client);
          break;
        case 'setprefix':
          // Admin only
          if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return; // Silently ignore non-admin
          }
          await this.handleSetPrefix(message, args, client);
          break;
        case 'ping':
          // Admin only
          if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return; // Silently ignore non-admin
          }
          await this.handlePing(message, client);
          break;
        case 'about':
          // Admin only
          if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return; // Silently ignore non-admin
          }
          await this.handleAbout(message, client);
          break;
        case 'status':
          // Admin only
          if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return; // Silently ignore non-admin
          }
          await this.handleStatus(message, client);
          break;
        case 'help':
          // Admin only
          if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return; // Silently ignore non-admin
          }
          await this.handleHelp(message, client, prefix);
          break;
        default:
          // Unknown command, ignore
          break;
      }

      // Remove hourglass reaction after processing
      await reactionPromise.then(() => message.reactions.cache.get('⏳')?.users.remove(client.user?.id).catch(() => { }));
    } catch (error) {
      await message.reply({
        content: '<:tcet_cross:1437995480754946178> An error occurred while executing the command.',
      }).catch(() => { });
    }
  }

  /**
   * Handle ticket command
   */
  private async handleTicketCommand(message: Message, args: string[], client: BotClient): Promise<void> {
    const subcommand = args[0]?.toLowerCase();
    const subcommand2 = args[1]?.toLowerCase();

    // Check permissions for most commands
    const member = message.member;
    if (!member) return;

    const hasPerms = member.permissions.has(PermissionFlagsBits.ManageChannels);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    // Check if it's a panel command (ticket panel setup/edit/delete/list)
    if (subcommand === 'panel') {
      // Panel commands require admin
      if (!isAdmin) {
        // Silently ignore non-admin messages for panel commands
        return;
      }

      switch (subcommand2) {
        case 'setup':
          await message.reply('<:module:1437997093753983038> Please use the slash command `/ticket panel setup` for setup wizard.');
          break;
        case 'edit':
          await message.reply('<:module:1437997093753983038> Please use the slash command `/ticket panel edit` for editing panels.');
          break;
        case 'delete':
          await message.reply('<:module:1437997093753983038> Please use the slash command `/ticket panel delete` for deleting panels.');
          break;
        case 'list':
          await message.reply('<:module:1437997093753983038> Please use the slash command `/ticket panel list` to view all panels.');
          break;
        default:
          await message.reply('<:tcet_cross:1437995480754946178> Invalid panel subcommand. Use: setup, edit, delete, or list');
          break;
      }
      return;
    }

    switch (subcommand) {
      case 'close':
        await this.handleTicketClose(message, client);
        break;
      case 'reopen':
        await this.handleTicketReopen(message, client);
        break;
      case 'claim':
        await this.handleTicketClaim(message, client);
        break;
      case 'unclaim':
        await this.handleTicketUnclaim(message, client);
        break;
      case 'rename':
        if (!hasPerms) {
          await message.reply('<:tcet_cross:1437995480754946178> You need **Manage Channels** permission to use this command.');
          return;
        }
        await this.handleTicketRename(message, args.slice(1), client);
        break;
      case 'delete':
        if (!hasPerms) {
          await message.reply('<:tcet_cross:1437995480754946178> You need **Manage Channels** permission to use this command.');
          return;
        }
        await this.handleTicketDelete(message, client);
        break;
      case 'add':
        if (!hasPerms) {
          await message.reply('<:tcet_cross:1437995480754946178> You need **Manage Channels** permission to use this command.');
          return;
        }
        // Check if in ticket channel
        const tickets = await client.db.getAllTickets();
        const isTicketChannel = tickets.some(t => t.channelId === message.channel.id);
        if (!isTicketChannel) {
          await message.reply('<:tcet_cross:1437995480754946178> This command can only be used in ticket channels.');
          return;
        }
        await this.handleTicketAdd(message, args.slice(1), client);
        break;
      default:
        await message.reply(`<:module:1437997093753983038> **Ticket Commands:**\n\`\`\`\nticket close - Close the current ticket\nticket reopen - Reopen a closed ticket\nticket claim - Claim the ticket\nticket unclaim - Unclaim the ticket\nticket rename <name> - Rename the ticket channel\nticket delete - Delete the ticket permanently\nticket add @Tai - Add a user to the ticket\n\`\`\``);
        break;
    }
  }

  /**
   * Handle ticket close
   */
  private async handleTicketClose(message: Message, client: BotClient): Promise<void> {
    const channel = message.channel;
    if (!channel.isTextBased()) return;

    // Find ticket
    const tickets = await client.db.getAllTickets();
    const ticket = tickets.find(t => t.channelId === channel.id);

    if (!ticket) {
      await message.reply('<:tcet_cross:1437995480754946178> This is not a ticket channel.');
      return;
    }

    if (ticket.state === 'closed') {
      await message.reply('<:tcet_cross:1437995480754946178> This ticket is already closed.');
      return;
    }

    // Import and use TicketHandler
    const { TicketHandler } = await import('../modules/ticket/ticketHandler');
    const handler = new TicketHandler();

    // Create a pseudo-interaction object
    const pseudoInteraction = {
      user: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      replied: false,
      deferred: false,
      followUp: async (options: any) => {
        await message.reply(options.content || 'Done!');
      },
      memberPermissions: message.member?.permissions
    };

    await handler.closeTicket(pseudoInteraction, client, ticket.id);
  }

  /**
   * Handle ticket reopen
   */
  private async handleTicketReopen(message: Message, client: BotClient): Promise<void> {
    const channel = message.channel;
    if (!channel.isTextBased()) return;

    const tickets = await client.db.getAllTickets();
    const ticket = tickets.find(t => t.channelId === channel.id);

    if (!ticket) {
      await message.reply('<:tcet_cross:1437995480754946178> This is not a ticket channel.');
      return;
    }

    if (ticket.state === 'open') {
      await message.reply('<:tcet_cross:1437995480754946178> This ticket is already open.');
      return;
    }

    const { TicketHandler } = await import('../modules/ticket/ticketHandler');
    const handler = new TicketHandler();

    const pseudoInteraction = {
      user: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      replied: false,
      deferred: false,
      followUp: async (options: any) => {
        await message.reply(options.content || 'Done!');
      },
      memberPermissions: message.member?.permissions
    };

    await handler.reopenTicket(pseudoInteraction, client, ticket.id);
  }

  /**
   * Handle ticket claim
   */
  private async handleTicketClaim(message: Message, client: BotClient): Promise<void> {
    const channel = message.channel;
    if (!channel.isTextBased()) return;

    const tickets = await client.db.getAllTickets();
    const ticket = tickets.find(t => t.channelId === channel.id);

    if (!ticket) {
      await message.reply('<:tcet_cross:1437995480754946178> This is not a ticket channel.');
      return;
    }

    const { TicketHandler } = await import('../modules/ticket/ticketHandler');
    const handler = new TicketHandler();

    const pseudoInteraction = {
      user: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      replied: false,
      deferred: false,
      followUp: async (options: any) => {
        await message.reply(options.content || 'Done!');
      },
      memberPermissions: message.member?.permissions
    };

    await handler.claimTicket(pseudoInteraction, client, ticket.id);
  }

  /**
   * Handle ticket unclaim
   */
  private async handleTicketUnclaim(message: Message, client: BotClient): Promise<void> {
    const channel = message.channel;
    if (!channel.isTextBased()) return;

    const tickets = await client.db.getAllTickets();
    const ticket = tickets.find(t => t.channelId === channel.id);

    if (!ticket) {
      await message.reply('<:tcet_cross:1437995480754946178> This is not a ticket channel.');
      return;
    }

    const { TicketHandler } = await import('../modules/ticket/ticketHandler');
    const handler = new TicketHandler();

    const pseudoInteraction = {
      user: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      replied: false,
      deferred: false,
      followUp: async (options: any) => {
        await message.reply(options.content || 'Done!');
      },
      memberPermissions: message.member?.permissions
    };

    await handler.unclaimTicket(pseudoInteraction, client, ticket.id);
  }

  /**
   * Handle ticket rename
   */
  private async handleTicketRename(message: Message, args: string[], client: BotClient): Promise<void> {
    if (args.length === 0) {
      await message.reply('<:tcet_cross:1437995480754946178> Please provide a new name for the ticket.');
      return;
    }

    const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const channel = message.channel;

    if ('setName' in channel) {
      try {
        await channel.setName(newName);
        await message.reply(`<:tcet_tick:1437995479567962184> Ticket channel renamed to **${newName}**`);
      } catch (error) {
        await message.reply('<:tcet_cross:1437995480754946178> Failed to rename channel. Please check permissions.');
      }
    }
  }

  /**
   * Handle ticket delete
   */
  private async handleTicketDelete(message: Message, client: BotClient): Promise<void> {
    const channel = message.channel;
    const tickets = await client.db.getAllTickets();
    const ticket = tickets.find(t => t.channelId === channel.id);

    if (!ticket) {
      await message.reply('<:tcet_cross:1437995480754946178> This is not a ticket channel.');
      return;
    }

    await message.reply('<:tcet_tick:1437995479567962184> Deleting ticket in 3 seconds...');

    setTimeout(async () => {
      await client.db.delete(ticket.id);
      if ('delete' in channel) {
        await channel.delete();
      }
    }, 3000);
  }

  /**
   * Handle ticket add user
   */
  private async handleTicketAdd(message: Message, args: string[], client: BotClient): Promise<void> {
    if (args.length === 0 || !message.mentions.users.first()) {
      await message.reply('<:tcet_cross:1437995480754946178> Please mention a user to add to the ticket.');
      return;
    }

    const user = message.mentions.users.first()!;
    const channel = message.channel;

    if ('permissionOverwrites' in channel) {
      try {
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });

        await message.reply(`<:tcet_tick:1437995479567962184> Added <@${user.id}> to the ticket.`);
        if ('send' in message.channel) {
          await message.channel.send(`<@${user.id}> has been added to the ticket by <@${message.author.id}>`);
        }
      } catch (error) {
        await message.reply('<:tcet_cross:1437995480754946178> Failed to add user. Please check permissions.');
      }
    }
  }

  /**
   * Handle setprefix command
   */
  private async handleSetPrefix(message: Message, args: string[], client: BotClient): Promise<void> {
    const member = message.member;
    if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply('<:tcet_cross:1437995480754946178> You need **Manage Server** permission to change the prefix.');
      return;
    }

    if (args.length === 0) {
      const currentPrefix = await client.db.getPrefix(message.guild!.id);
      await message.reply(`<:module:1437997093753983038> Current prefix: \`${currentPrefix}\`\n\nTo change it, use: \`${currentPrefix}setprefix <new_prefix>\``);
      return;
    }

    const newPrefix = args[0];
    if (newPrefix.length > 5) {
      await message.reply('<:tcet_cross:1437995480754946178> Prefix must be 5 characters or less.');
      return;
    }

    await client.db.saveGuildConfig(message.guild!.id, newPrefix);
    await message.reply(`<:tcet_tick:1437995479567962184> Prefix changed to \`${newPrefix}\`\n\nExample: \`${newPrefix}ticket close\``);
  }

  /**
   * Handle ping command
   */
  private async handlePing(message: Message, client: BotClient): Promise<void> {
    const sent = await message.reply('🏓 Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);
    await sent.edit(`🏓 Pong!\n- Latency: ${latency}ms\n- API Ping: ${apiPing}ms`);
  }

  /**
   * Handle about command
   */
  private async handleAbout(message: Message, client: BotClient): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(`<:module:1437997093753983038> ${client.user?.username || 'Ticket Bot'} 2.0`)
      .setDescription('Advanced Discord Ticket System with Universal Interaction Architecture')
      .setColor(0x5865F2)
      .addFields(
        { name: 'Version', value: '2.0.0', inline: true },
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Uptime', value: `<t:${Math.floor((Date.now() - (client.uptime || 0)) / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  /**
   * Handle status command
   */
  private async handleStatus(message: Message, client: BotClient): Promise<void> {
    // Filter by current guild
    const guildId = message.guildId || undefined;
    const panels = await client.db.getAllPanels(guildId);
    const tickets = await client.db.getAllTickets();

    // Filter tickets by guild (match panels from this guild)
    const guildPanelIds = new Set(panels.map(p => p.id));
    const guildTickets = tickets.filter(t => guildPanelIds.has(t.panelId));
    const openTickets = guildTickets.filter(t => t.state === 'open').length;
    const closedTickets = guildTickets.filter(t => t.state === 'closed').length;

    const embed = new EmbedBuilder()
      .setTitle('<:k9logging:1437996243803705354> System Status')
      .setColor(0x57F287)
      .addFields(
        { name: 'Configured Panels', value: `${panels.length}`, inline: true },
        { name: 'Open Tickets', value: `${openTickets}`, inline: true },
        { name: 'Closed Tickets', value: `${closedTickets}`, inline: true },
        { name: 'Total Tickets', value: `${guildTickets.length}`, inline: true },
        { name: 'Database', value: client.db.isConnectionActive() ? '✅ Connected' : '❌ Disconnected', inline: true },
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true }
      )
      .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  /**
   * Handle purge command
   */
  private async handleHelp(message: Message, client: BotClient, prefix: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('<:module:1437997093753983038> Command Help')
      .setDescription(`Current prefix: \`${prefix}\``)
      .setColor(0x5865F2)
      .addFields(
        {
          name: '🎫 Ticket Commands',
          value: [
            `\`${prefix}ticket close\` - Close the current ticket`,
            `\`${prefix}ticket reopen\` - Reopen a closed ticket`,
            `\`${prefix}ticket claim\` - Claim the ticket`,
            `\`${prefix}ticket unclaim\` - Unclaim the ticket`,
            `\`${prefix}ticket rename <name>\` - Rename the ticket channel`,
            `\`${prefix}ticket delete\` - Delete the ticket permanently`,
            `\`${prefix}ticket add @Tai\` - Add a user to the ticket (in ticket only)`,
          ].join('\n'),
          inline: false
        },
        {
          name: '⚙️ Admin Commands (Admin Only)',
          value: [
            `\`${prefix}setprefix <prefix>\` - Change the server prefix`,
            `\`${prefix}ping\` - Check bot latency`,
            `\`${prefix}about\` - About the bot`,
            `\`${prefix}status\` - System status`,
            `\`${prefix}help\` - Show this help message`,
          ].join('\n'),
          inline: false
        },
        {
          name: '💡 Slash Commands',
          value: 'You can also use slash commands like `/ticket panel setup`',
          inline: false
        }
      )
      .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
}

export const prefixHandler = new PrefixCommandHandler();
