import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotClient } from '../../core/client';
import { EmbedController } from '../../core/embedController';
import { SetupWizardHandler } from '../../modules/ticket/setupWizard';
import { PanelData } from '../../core/db/postgresDB';

export const category = 'tickets';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Manage ticket panels')
  .addSubcommandGroup(group =>
    group
      .setName('panel')
      .setDescription('Panel management')
      .addSubcommand(sub =>
        sub.setName('setup').setDescription('Create a new ticket panel')
      )
      .addSubcommand(sub =>
        sub.setName('edit').setDescription('Edit an existing ticket panel')
      )
      .addSubcommand(sub =>
        sub.setName('delete').setDescription('Delete a ticket panel')
      )
      .addSubcommand(sub =>
        sub.setName('list').setDescription('List all configured panels')
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('close')
      .setDescription('Close the current ticket')
  )
  .addSubcommand(sub =>
    sub
      .setName('reopen')
      .setDescription('Reopen the current ticket')
  )
  .addSubcommand(sub =>
    sub
      .setName('rename')
      .setDescription('Rename the current ticket channel')
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('New channel name')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('Add a user to the current ticket')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to add to the ticket')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('claim')
      .setDescription('Claim the current ticket')
  )
  .addSubcommand(sub =>
    sub
      .setName('unclaim')
      .setDescription('Unclaim the current ticket')
  )
  .addSubcommand(sub =>
    sub
      .setName('delete')
      .setDescription('Delete the current ticket permanently')
  )
  .addSubcommand(sub =>
    sub
      .setName('clear-ticket')
      .setDescription('Clear a user\'s ticket data so they can create a new ticket')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user whose ticket to clear')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('panel')
          .setDescription('The panel ID (optional, clears all panels if not specified)')
          .setRequired(false)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: any
): Promise<void> {
  const client = interaction.client as BotClient;
  const db = services.ticketDB;
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === 'panel') {
    switch (subcommand) {
      case 'setup':
        await handleSetup(interaction, client, db);
        break;
      case 'edit':
        await handleEdit(interaction, client, db);
        break;
      case 'delete':
        await handleDelete(interaction, client, db);
        break;
      case 'list':
        await handleList(interaction, client, db);
        break;
    }
  } else {
    switch (subcommand) {
      case 'close':
        await handleClose(interaction, client, db);
        break;
      case 'reopen':
        await handleReopen(interaction, client, db);
        break;
      case 'rename':
        await handleRename(interaction, client, db);
        break;
      case 'add':
        await handleAddUser(interaction, client, db);
        break;
      case 'claim':
        await handleClaim(interaction, client, db);
        break;
      case 'unclaim':
        await handleUnclaim(interaction, client, db);
        break;
      case 'delete':
        await handleDeleteTicket(interaction, client, db);
        break;
      case 'clear-ticket':
        await handleClearTicket(interaction, client, db);
        break;
    }
  }
}

async function handleSetup(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const wizardHandler = new SetupWizardHandler();
  await wizardHandler.showMainMenu(interaction, client, interaction.user.id);
}

async function handleEdit(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const panels = await db.getAllPanels(interaction.guildId || undefined);

  if (panels.length === 0) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> No panels configured. Use `/ticket panel setup` to create one!',
    });
    return;
  }

  const options = panels.map((panel: PanelData) => ({
    label: panel.name || 'Unnamed Panel',
    description: panel.channel ? `Channel: #${panel.channel}` : 'No channel set',
    value: panel.id,
    emoji: panel.emoji || '<:module:1437997093753983038>',
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:edit-select')
    .setPlaceholder('Select a panel to edit')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.editReply({
    content: '<:module:1437997093753983038> Select a panel to edit:',
    components: [row],
  });
}

async function handleDelete(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const panels = await db.getAllPanels(interaction.guildId || undefined);

  if (panels.length === 0) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> No panels configured.',
    });
    return;
  }

  const options = panels.map((panel: PanelData) => ({
    label: panel.name || 'Unnamed Panel',
    description: panel.channel ? `Channel: #${panel.channel}` : 'No channel set',
    value: panel.id,
    emoji: panel.emoji || '<:module:1437997093753983038>',
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket:delete-select')
    .setPlaceholder('Select a panel to delete')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.editReply({
    content: '🗑️ Select a panel to delete:',
    components: [row],
  });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const panels = await db.getAllPanels(interaction.guildId || undefined);
  const embed = EmbedController.createPanelListEmbed(panels);

  await interaction.editReply({ embeds: [embed] });
}

async function handleClearTicket(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const user = interaction.options.getUser('user', true);

  // Get all panels to check guild association
  const allPanels = await db.getAllPanels() as PanelData[];
  const panelMap = new Map(allPanels.map(p => [p.id, p]));

  // Get all tickets for this user in this guild
  const allTickets = await db.getAllTickets();
  const userTickets = allTickets.filter((t: any) => {
    if (t.owner !== user.id) return false;
    const panel = panelMap.get(t.panelId);
    return panel && panel.guildId === interaction.guildId;
  });

  if (userTickets.length === 0) {
    await interaction.editReply({
      content: `<:tcet_cross:1437995480754946178> No tickets found for ${user.tag} in this server.`,
    });
    return;
  }

  // Create options for each ticket with panel info
  const options = await Promise.all(userTickets.map(async (ticket: any) => {
    const panel = panelMap.get(ticket.panelId);
    const panelName = panel?.name || 'Unknown Panel';
    const state = ticket.state === 'open' ? '🟢 Open' : '🔴 Closed';

    // Try to get channel name
    let channelName = 'Unknown';
    try {
      const channel = await client.channels.fetch(ticket.channelId);
      if (channel && 'name' in channel) {
        channelName = `#${channel.name}`;
      }
    } catch (error) {
      channelName = '(deleted)';
    }

    return {
      label: `${channelName} - ${panelName}`,
      description: `${state} • Created: ${new Date(ticket.createdAt).toLocaleDateString()}`,
      value: ticket.id,
      emoji: state === '🟢 Open' ? '🟢' : '🔴'
    };
  }));

  // Create embed showing user's tickets
  const embed = new EmbedBuilder()
    .setTitle(`🗑️ Clear Tickets for ${user.tag}`)
    .setDescription(
      `Found **${userTickets.length}** ticket(s) for this user.\n\n` +
      `**Select tickets to delete:**\n` +
      `• Use the dropdown below to select individual tickets\n` +
      `• Or click "Delete All" to clear all tickets at once\n\n` +
      `⚠️ **Warning:** This action cannot be undone!`
    )
    .setColor(0xED4245)
    .setFooter({ text: `User ID: ${user.id}` })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket:clear-select:${user.id}`)
    .setPlaceholder('Select tickets to delete')
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 25))
    .addOptions(options.slice(0, 25)); // Discord limit

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:clear-all:${user.id}`)
      .setLabel(`Delete All (${userTickets.length})`)
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️'),
    new ButtonBuilder()
      .setCustomId('ticket:clear-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✖️')
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row1, row2],
  });
}

async function handleDeleteTicket(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This command can only be used in a ticket channel.',
    });
    return;
  }

  // Find ticket by channel ID
  const tickets = await db.getAllTickets();
  const ticket = tickets.find((t: any) => t.channelId === channel.id);

  if (!ticket) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This is not a ticket channel.',
    });
    return;
  }

  // Check if user is staff or has manage channels permission
  const panel = await db.get(ticket.panelId) as PanelData;
  const member = interaction.member as any;
  const isStaff = member?.roles?.cache?.has(panel?.staffRole || '') || interaction.memberPermissions?.has('ManageChannels');

  if (!isStaff) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> **Only staff members can delete tickets.**',
    });
    return;
  }

  try {
    // Import TextChannel type
    const { TextChannel } = await import('discord.js');

    // Generate transcript before deleting if ticket is closed
    if (ticket.state === 'closed' && channel instanceof TextChannel) {
      const { generateProfessionalTranscript, createTranscriptEmbed } = await import('../../modules/ticket/transcriptGenerator');
      const ticketNumber = parseInt(ticket.id.split(':')[1]);
      const owner = await client.users.fetch(ticket.owner);

      let staffName: string | undefined;
      let staffId: string | undefined;
      if (ticket.claimedBy) {
        try {
          const staff = await client.users.fetch(ticket.claimedBy);
          staffName = staff.username;
          staffId = staff.id;
        } catch (error) {
        }
      }

      const transcriptOptions = {
        ticketId: ticket.id,
        ticketNumber,
        username: owner.username,
        userId: owner.id,
        staffName,
        staffId,
        panelName: panel?.name || 'Unknown Panel',
        createdAt: new Date(ticket.createdAt),
        closedAt: ticket.closedAt ? new Date(ticket.closedAt) : undefined
      };

      const attachment = await generateProfessionalTranscript(channel, transcriptOptions);
      const transcriptEmbed = createTranscriptEmbed(transcriptOptions);

      // Send transcript to transcript channel if configured
      if (panel?.transcriptChannel) {
        try {
          const transcriptChannel = await client.channels.fetch(panel.transcriptChannel);
          if (transcriptChannel?.isTextBased() && 'send' in transcriptChannel) {
            await transcriptChannel.send({
              content: '🗑️ **Ticket Deleted - Transcript Saved**',
              embeds: [transcriptEmbed],
              files: [attachment]
            });
          }
        } catch (error) {
        }
      }

      // Try to DM transcript to owner
      try {
        await owner.send({
          content: `🗑️ **Your ticket has been deleted.** Here is the transcript:`,
          embeds: [transcriptEmbed],
          files: [attachment],
        });
      } catch (error) {
      }
    }

    // Log to logs channel before deleting
    if (panel?.logsChannel && 'name' in channel) {
      try {
        const logChannel = await client.channels.fetch(panel.logsChannel);
        if (logChannel?.isTextBased() && 'send' in logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🗑️ Ticket Deleted')
            .setColor(0xED4245)
            .addFields(
              { name: 'Ticket', value: `\`#${channel.name}\``, inline: true },
              { name: 'Deleted By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Owner', value: `<@${ticket.owner}>`, inline: true },
              { name: 'Ticket ID', value: `\`${ticket.id}\``, inline: true },
              { name: 'State', value: ticket.state, inline: true },
              { name: 'Panel', value: panel.name || 'Unknown', inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (error) {
      }
    }

    // Send confirmation before deletion
    await interaction.editReply({
      content: '<:tcet_tick:1437995479567962184> **Ticket will be deleted in 3 seconds...**\n\n*Transcript has been saved and sent.*',
    });

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete ticket data
    db.delete(ticket.id);

    // Delete channel
    await channel.delete();
  } catch (error) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Failed to delete ticket. Please try again or delete the channel manually.',
    }).catch(() => { });
  }
}

async function handleClose(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This command can only be used in a ticket channel.',
    });
    return;
  }

  // Find ticket by channel ID
  const tickets = await db.getAllTickets();
  const ticket = tickets.find((t: any) => t.channelId === channel.id);

  if (!ticket) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This is not a ticket channel.',
    });
    return;
  }

  if (ticket.state === 'closed') {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This ticket is already closed.',
    });
    return;
  }

  // Get panel to check allowOwnerClose
  const panel = await db.get(ticket.panelId) as PanelData | null;

  // Check if user is the owner
  const isOwner = ticket.owner === interaction.user.id;
  const isStaff = interaction.memberPermissions?.has('ManageChannels');

  // Check permission based on allowOwnerClose setting
  if (isOwner && panel?.allowOwnerClose === false && !isStaff) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> **Only staff members can close this ticket.**\n\nIf you need assistance, please wait for a staff member.',
    });
    return;
  }

  // Import TicketHandler dynamically
  const { TicketHandler } = await import('../../modules/ticket/ticketHandler');
  const handler = new TicketHandler();
  await handler.closeTicket(interaction, client, ticket.id);
}

async function handleReopen(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This command can only be used in a ticket channel.',
    });
    return;
  }

  // Find ticket by channel ID
  const tickets = await db.getAllTickets();
  const ticket = tickets.find((t: any) => t.channelId === channel.id);

  if (!ticket) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This is not a ticket channel.',
    });
    return;
  }

  if (ticket.state === 'open') {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This ticket is already open.',
    });
    return;
  }

  // Import TicketHandler dynamically
  const { TicketHandler } = await import('../../modules/ticket/ticketHandler');
  const handler = new TicketHandler();
  await handler.reopenTicket(interaction, client, ticket.id);
}

async function handleRename(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This command can only be used in a ticket channel.',
    });
    return;
  }

  // Find ticket by channel ID
  const tickets = await db.getAllTickets();
  const ticket = tickets.find((t: any) => t.channelId === channel.id);

  if (!ticket) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This is not a ticket channel.',
    });
    return;
  }

  const newName = interaction.options.getString('name', true);
  const sanitizedName = newName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    if ('setName' in channel) {
      await channel.setName(sanitizedName);

      // Get panel for logging
      const panel = await db.get(ticket.panelId) as PanelData;

      // Log to logs channel
      if (panel?.logsChannel) {
        try {
          const logChannel = await client.channels.fetch(panel.logsChannel);
          if (logChannel?.isTextBased() && 'send' in logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('<:settings:1437996913180934144> Ticket Renamed')
              .setColor(0x5865F2)
              .addFields(
                { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
                { name: 'Renamed By', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Owner', value: `<@${ticket.owner}>`, inline: true },
                { name: 'New Name', value: `\`${sanitizedName}\``, inline: true },
                { name: 'Ticket ID', value: `\`${ticket.id}\``, inline: true },
                { name: 'Panel', value: panel.name || 'Unknown', inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (error) {
        }
      }

      await interaction.editReply({
        content: `<:tcet_tick:1437995479567962184> Ticket channel renamed to **${sanitizedName}**`,
      });
    } else {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Unable to rename this channel.',
      });
    }
  } catch (error) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Failed to rename the channel. Please check permissions.',
    });
  }
}

async function handleAddUser(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This command can only be used in a ticket channel.',
    });
    return;
  }

  // Find ticket by channel ID
  const tickets = await db.getAllTickets();
  const ticket = tickets.find((t: any) => t.channelId === channel.id);

  if (!ticket) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This is not a ticket channel.',
    });
    return;
  }

  // Get panel to check staff role
  const panel = await db.get(ticket.panelId) as PanelData;
  const member = interaction.member as any;
  const isStaff = member?.roles?.cache?.has(panel?.staffRole || '') || interaction.memberPermissions?.has('ManageChannels');

  // Only staff can add users
  if (!isStaff) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> **Only staff members can add users to tickets.**\n\nYou must have the staff role or Manage Channels permission.',
    });
    return;
  }

  const user = interaction.options.getUser('user', true);

  // Get panel to use configured permissions
  const userPermissions = panel?.userPermissions || [];

  try {
    if ('permissionOverwrites' in channel) {
      // Build permission object based on panel configuration
      const permissions: any = {};

      if (userPermissions.length > 0) {
        // Use configured permissions
        for (const perm of userPermissions) {
          permissions[perm] = true;
        }
      } else {
        // Default permissions if none configured
        permissions.ViewChannel = true;
        permissions.SendMessages = true;
        permissions.ReadMessageHistory = true;
      }

      await channel.permissionOverwrites.edit(user.id, permissions);

      await interaction.editReply({
        content: `<:tcet_tick:1437995479567962184> Added <@${user.id}> to the ticket.`,
      });

      await channel.send({
        content: `<@${user.id}> has been added to the ticket by <@${interaction.user.id}>`,
      });
    } else {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Unable to modify permissions in this channel.',
      });
    }
  } catch (error) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Failed to add user. Please check permissions.',
    });
  }
}

async function handleClaim(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This command can only be used in a ticket channel.',
    });
    return;
  }

  // Find ticket by channel ID
  const tickets = await db.getAllTickets();
  const ticket = tickets.find((t: any) => t.channelId === channel.id);

  if (!ticket) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This is not a ticket channel.',
    });
    return;
  }

  // Get panel to check staff role
  const panel = await db.get(ticket.panelId) as PanelData | null;
  const member = interaction.member as any;
  const isStaff = member?.roles?.cache?.has(panel?.staffRole || '') || interaction.memberPermissions?.has('ManageChannels');

  if (!isStaff) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> **Only staff members can claim tickets.**',
    });
    return;
  }

  if (ticket.claimedBy) {
    await interaction.editReply({
      content: `<:tcet_cross:1437995480754946178> **This ticket has already been claimed by <@${ticket.claimedBy}>**\n\nPlease ask them to unclaim it first if you need to claim it.`,
    });
    return;
  }

  // Update ticket
  ticket.claimedBy = interaction.user.id;
  db.save(ticket);

  // Rename channel
  try {
    if ('setName' in channel) {
      const newName = `claimed-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      await channel.setName(newName);
    }
  } catch (error) {
  }

  // Send success embed (ephemeral to claimer)
  await interaction.editReply({
    content: '<:tcet_tick:1437995479567962184> **You have claimed this ticket.**\n\nYou are now responsible for helping the user.',
  });

  // Send public message
  const { EmbedBuilder } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('<:tcet_tick:1437995479567962184> Ticket Claimed')
    .setDescription(`This ticket has been claimed by <@${interaction.user.id}>`)
    .setColor(0x57F287)
    .setTimestamp();

  if ('send' in channel) {
    await channel.send({ embeds: [embed] });
  }
}

async function handleUnclaim(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply({ flags: 1 << 6 }); // MessageFlags.Ephemeral

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This command can only be used in a ticket channel.',
    });
    return;
  }

  // Find ticket by channel ID
  const tickets = await db.getAllTickets();
  const ticket = tickets.find((t: any) => t.channelId === channel.id);

  if (!ticket) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This is not a ticket channel.',
    });
    return;
  }

  if (!ticket.claimedBy) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> This ticket is not claimed.',
    });
    return;
  }

  if (ticket.claimedBy !== interaction.user.id && !interaction.memberPermissions?.has('ManageChannels')) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> You can only unclaim tickets that you claimed.',
    });
    return;
  }

  // Get original owner username for channel name
  try {
    const owner = await client.users.fetch(ticket.owner);
    const claimedBy = ticket.claimedBy;

    // Update ticket
    ticket.claimedBy = undefined;
    db.save(ticket);

    // Rename channel back to original
    if ('setName' in channel) {
      const newName = `ticket-${owner.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      await channel.setName(newName);
    }

    // Send success embed (ephemeral to unclaimer)
    await interaction.editReply({
      content: '<:tcet_tick:1437995479567962184> **You have unclaimed this ticket.**\n\nOther staff members can now claim it.',
    });

    // Send public message
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('<:tcet_tick:1437995479567962184> Ticket Unclaimed')
      .setDescription(`This ticket has been unclaimed by <@${claimedBy}>\n\nStaff members can now claim this ticket.`)
      .setColor(0xFEE75C)
      .setTimestamp();

    if ('send' in channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Failed to unclaim ticket. Please try again.',
    });
  }
}
