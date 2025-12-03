import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotClient } from '../../core/client';
import { PanelData } from '../../core/db/postgresDB';
import { randomBytes } from 'crypto';

interface PanelTemplate {
  id: string;
  name: string;
  label: string;
  emoji: string;
  color: 'Primary' | 'Secondary' | 'Success' | 'Danger';
  description: string;
  openMessage: string;
  questions: string[];
  customQuestions?: Array<{ text: string; type: 'primary' | 'optional' }>;
  claimable: boolean;
  allowOwnerClose: boolean;
  userPermissions: string[];
  staffPermissions: string[];
  createdAt: string;
  originalGuild: string;
}

export const category = 'tickets';

export const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Panel template management (owner only)')
  .addSubcommand(sub =>
    sub
      .setName('export')
      .setDescription('Save a panel as a template for importing to other servers')
      .addStringOption(option =>
        option
          .setName('panel-name')
          .setDescription('Name of the panel to save')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('import')
      .setDescription('Import a panel template from another server')
      .addStringOption(option =>
        option
          .setName('template-id')
          .setDescription('The template ID you received')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('templates')
      .setDescription('View all your saved templates (sent via DM)')
  )
  .addSubcommand(sub =>
    sub
      .setName('delete-template')
      .setDescription('Delete your saved templates')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: any
): Promise<void> {
  const client = interaction.client as BotClient;
  const db = services.ticketDB;
  const subcommand = interaction.options.getSubcommand();

  // Owner-only check
  if (interaction.user.id !== interaction.guild?.ownerId) {
    await interaction.reply({
      content: '<:tcet_cross:1437995480754946178> This command can only be used by the **server owner**.',
      flags: 1 << 6 // MessageFlags.Ephemeral
    });
    return;
  }

  if (subcommand === 'export') {
    await handleSave(interaction, client, db);
  } else if (subcommand === 'import') {
    await handleImport(interaction, client, db);
  } else if (subcommand === 'templates') {
    await handleTemplates(interaction, client, db);
  } else if (subcommand === 'delete-template') {
    await handleDeleteTemplate(interaction, client, db);
  }
}

async function handleSave(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply();

  const panelName = interaction.options.getString('panel-name', true);

  // Find panel by name in current guild
  const panels = await db.getAllPanels(interaction.guildId || undefined);
  const panel = panels.find((p: PanelData) => p.name?.toLowerCase() === panelName.toLowerCase());

  if (!panel) {
    await interaction.editReply({
      content: `<:tcet_cross:1437995480754946178> Panel "${panelName}" not found. Use \`/ticket panel list\` to see all panels.`,
    });
    return;
  }

  // Generate unique template ID
  const templateId = `TPL-${randomBytes(4).toString('hex').toUpperCase()}`;

  // Create template (exclude server-specific data)
  const template: PanelTemplate = {
    id: templateId,
    name: panel.name || 'Unnamed Panel',
    label: panel.label,
    emoji: panel.emoji,
    color: panel.color as 'Primary' | 'Secondary' | 'Success' | 'Danger',
    description: panel.description,
    openMessage: panel.openMessage,
    questions: panel.questions || [],
    customQuestions: panel.customQuestions,
    claimable: panel.claimable,
    allowOwnerClose: panel.allowOwnerClose ?? true,
    userPermissions: panel.userPermissions || [],
    staffPermissions: panel.staffPermissions || [],
    createdAt: new Date().toISOString(),
    originalGuild: interaction.guildId || 'unknown',
  };

  // Save template to database
  await db.savePanelTemplate(templateId, template);

  // Create embed for DM
  const embed = new EmbedBuilder()
    .setTitle('<:module:1437997093753983038> Panel Template Saved')
    .setDescription(`Your panel **${panel.name}** has been saved as a template!`)
    .setColor(0x00ff00)
    .addFields(
      { name: 'Template ID', value: `\`${templateId}\``, inline: false },
      { name: 'Panel Name', value: panel.name || 'Unnamed', inline: true },
      { name: 'Button Label', value: panel.label, inline: true },
      { name: 'Color', value: panel.color, inline: true },
      { name: 'Claimable', value: panel.claimable ? 'Yes' : 'No', inline: true },
      { name: 'Owner Close', value: panel.allowOwnerClose !== false ? 'Yes' : 'No', inline: true },
      { name: 'Questions', value: `${panel.questions?.length || 0} question(s)`, inline: true },
      {
        name: '📝 How to Import',
        value: `Use \`/panel import template-id:${templateId}\` in any server to import this panel.\n\n**Note:** You'll need to configure channels and roles after importing.`,
        inline: false
      }
    )
    .setFooter({ text: `Save this Template ID - Powered by ${client.user?.username || 'Ticket Bot'}` })
    .setTimestamp();

  // Try to send DM
  try {
    await interaction.user.send({ embeds: [embed] });
    await interaction.editReply({
      content: '<:tcet_tick:1437995479567962184> Panel template saved! Check your DMs for the Template ID.',
    });
  } catch (error) {
    // If DM fails, send in channel
    await interaction.editReply({
      embeds: [embed],
      content: '<:tcet_tick:1437995479567962184> Panel template saved! (Unable to DM, showing here instead)',
    });
  }
}

async function handleImport(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply();

  const templateId = interaction.options.getString('template-id', true).trim().toUpperCase();

  // Validate template ID format
  if (!templateId.startsWith('TPL-') || templateId.length !== 12) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Invalid template ID format. It should look like: `TPL-XXXXX`',
    });
    return;
  }

  // Get template from database
  const template = await db.getPanelTemplate(templateId);

  if (!template) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Template not found. Please check the Template ID and try again.',
    });
    return;
  }

  // Generate new panel ID for this server
  const newPanelId = await db.generatePanelId();

  // Create new panel from template (without channels/roles)
  const newPanel: PanelData = {
    id: newPanelId,
    type: 'panel',
    guildId: interaction.guildId || undefined, // Set guild ID for new panel
    name: template.name,
    // Channels and roles not set - user must configure
    channel: undefined,
    openCategory: undefined,
    closeCategory: undefined,
    staffRole: undefined,
    logsChannel: undefined,
    transcriptChannel: undefined,
    // Copy template data
    label: template.label,
    emoji: template.emoji,
    color: template.color,
    description: template.description,
    openMessage: template.openMessage,
    questions: template.questions,
    customQuestions: template.customQuestions,
    claimable: template.claimable,
    allowOwnerClose: template.allowOwnerClose,
    userPermissions: template.userPermissions,
    staffPermissions: template.staffPermissions,
    enabled: false, // Disabled by default until configured
    ticketsCreated: 0,
  };

  // Save to database
  await db.save(newPanel);

  const embed = new EmbedBuilder()
    .setTitle('<:tcet_tick:1437995479567962184> Panel Template Imported')
    .setDescription(`Panel **${template.name}** has been imported successfully!`)
    .setColor(0x00ff00)
    .addFields(
      { name: 'Panel Name', value: template.name, inline: true },
      { name: 'Button Label', value: template.label, inline: true },
      { name: 'Color', value: template.color, inline: true },
      { name: 'Claimable', value: template.claimable ? 'Yes' : 'No', inline: true },
      { name: 'Questions', value: `${template.questions?.length || 0} question(s)`, inline: true },
      { name: 'Status', value: '⚠️ **Disabled** (needs configuration)', inline: true },
      {
        name: '⚙️ Next Steps',
        value: [
          '1. Use `/ticket panel edit` to configure:',
          '   • Panel channel (where the ticket button will be posted)',
          '   • Open category (where new tickets will be created)',
          '   • Close category (where closed tickets will be moved)',
          '   • Staff role (who can manage tickets)',
          '   • Logs channel (optional)',
          '   • Transcript channel (optional)',
          '',
          '2. The panel will be enabled once all required fields are set!',
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleTemplates(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply();

  // Get all templates created by this user's guild
  const allTemplates = await db.getAllTemplates();
  const userTemplates = allTemplates.filter((t: any) => t.originalGuild === interaction.guildId);

  if (userTemplates.length === 0) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> You haven\'t created any templates yet. Use `/panel save` to create one!',
    });
    return;
  }

  // Create embeds for each template (max 10 embeds per message)
  const embeds = userTemplates.slice(0, 10).map((template: any) => {
    const templateId = template.id.replace('template:', '');
    return new EmbedBuilder()
      .setTitle(` ${template.name || 'Unnamed Template'}`)
      .setColor(template.color === 'Primary' ? 0x5865F2 :
        template.color === 'Success' ? 0x57F287 :
          template.color === 'Danger' ? 0xED4245 : 0x99AAB5)
      .addFields(
        { name: 'Template ID', value: `\`${templateId}\``, inline: false },
        { name: 'Button Label', value: template.label, inline: true },
        { name: 'Color', value: template.color, inline: true },
        { name: 'Emoji', value: template.emoji || 'None', inline: true },
        { name: 'Claimable', value: template.claimable ? 'Yes' : 'No', inline: true },
        { name: 'Owner Close', value: template.allowOwnerClose ? 'Yes' : 'No', inline: true },
        { name: 'Questions', value: `${template.questions?.length || 0}`, inline: true },
        { name: 'Description', value: template.description || 'No description', inline: false },
        {
          name: '📝 Import Command',
          value: `\`/panel import template-id:${templateId}\``,
          inline: false
        }
      )
      .setFooter({ text: `Created: ${new Date(template.createdAt).toLocaleDateString()}` })
      .setTimestamp();
  });

  // Create summary embed
  const summaryEmbed = new EmbedBuilder()
    .setTitle('<:module:1437997093753983038> Your Panel Templates')
    .setDescription(
      `You have **${userTemplates.length}** saved template(s).\n\n` +
      `These templates can be imported into any server using the \`/panel import\` command.\n\n` +
      `⚠️ **Note:** Templates include panel settings but not server-specific data like channels and roles.`
    )
    .setColor(0x5865F2)
    .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
    .setTimestamp();

  // Try to send DM
  try {
    await interaction.user.send({ embeds: [summaryEmbed, ...embeds] });
    await interaction.editReply({
      content: '<:tcet_tick:1437995479567962184> Check your DMs! I\'ve sent you a list of all your templates.',
    });
  } catch (error) {
    // If DM fails, send in channel
    await interaction.editReply({
      embeds: [summaryEmbed, ...embeds],
      content: '<:tcet_cross:1437995480754946178> I couldn\'t DM you, so here are your templates:',
    });
  }
}

async function handleDeleteTemplate(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  db: any
): Promise<void> {
  await interaction.deferReply();

  // Get all templates created by this user's guild
  const allTemplates = await client.db.getAllTemplates();
  const userTemplates = allTemplates.filter((t: any) => t.originalGuild === interaction.guildId);

  if (userTemplates.length === 0) {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> You don\'t have any templates to delete.',
    });
    return;
  }

  // Create options for the dropdown
  const options = userTemplates.map((template: any) => {
    const templateId = template.id.replace('template:', '');
    return {
      label: template.name || 'Unnamed Template',
      description: `ID: ${templateId} • ${template.questions?.length || 0} question(s)`,
      value: template.id,
      emoji: '🗑️'
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`panel:delete-template-select:${interaction.user.id}`)
    .setPlaceholder('Select templates to delete')
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 25))
    .addOptions(options.slice(0, 25)); // Discord limit

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`panel:delete-template-all:${interaction.user.id}`)
      .setLabel(`Delete All (${userTemplates.length})`)
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️'),
    new ButtonBuilder()
      .setCustomId('panel:delete-template-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✖️')
  );

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Delete Templates')
    .setDescription(
      `You have **${userTemplates.length}** template(s).\n\n` +
      `**Select templates to delete:**\n` +
      `• Use the dropdown to select specific templates\n` +
      `• Or click "Delete All" to remove all templates\n\n` +
      `⚠️ **Warning:** This action cannot be undone!`
    )
    .setColor(0xED4245)
    .setFooter({ text: 'Templates can be re-created using /panel save' })
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: [row1, row2],
  });
}
