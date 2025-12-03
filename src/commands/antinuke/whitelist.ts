
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  MessageComponentInteraction,
} from 'discord.js';
import { WhitelistService } from '../../services/WhitelistService';
import { WhitelistCategory, EmbedColors, SlashCommand } from '../../types';
import { CustomEmojis } from '../../utils/emoji';

export const data = new SlashCommandBuilder()
  .setName('whitelist')
  .setDescription('Manage anti-nuke whitelist')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add_role')
      .setDescription('Add a role to the whitelist')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role to whitelist')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add_user')
      .setDescription('Add a user to the whitelist')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to whitelist')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove_role')
      .setDescription('Remove a role from the whitelist')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role to remove')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove_user')
      .setDescription('Remove a user from the whitelist')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to remove')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all whitelist entries')
      .addStringOption(option =>
        option
          .setName('filter')
          .setDescription('Filter by type')
          .setRequired(false)
          .addChoices(
            { name: 'Roles only', value: 'role' },
            { name: 'Users only', value: 'user' },
            { name: 'All', value: 'all' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reset')
      .setDescription('⚠️ Remove all whitelist entries')
      .addBooleanOption(option =>
        option
          .setName('confirm')
          .setDescription('Confirm reset (required)')
          .setRequired(true)
      )
  );

export const slashCommand: SlashCommand = {
  data: data,
  execute: execute,
  category: 'antinuke',
  syntax: '/whitelist <add_role|add_user|remove_role|remove_user|view|list|reset>',
  permission: 'Administrator',
  example: '/whitelist add_user user:@Rexx'
};

import { checkCommandPermission } from '../../utils/permissionHelpers';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { whitelistService: WhitelistService }
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  // Permission Check: Role > Bot
  if (!await checkCommandPermission(interaction, { ownerOnly: false })) return;

  switch (subcommand) {
    case 'add_role':
      await handleAddRole(interaction, services, guildId);
      break;
    case 'add_user':
      await handleAddUser(interaction, services, guildId);
      break;
    case 'remove_role':
      await handleRemoveRole(interaction, services, guildId);
      break;
    case 'remove_user':
      await handleRemoveUser(interaction, services, guildId);
      break;
    case 'list':
      await handleList(interaction, services, guildId);
      break;
    case 'reset':
      await handleReset(interaction, services, guildId);
      break;
  }
}

async function handleAddRole(
  interaction: ChatInputCommandInteraction,
  services: { whitelistService: WhitelistService },
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const role = interaction.options.getRole('role', true);
  const guild = interaction.guild!;
  const botMember = guild.members.me!;

  // Safety checks
  if (role.id === guild.roles.everyone.id) {
    const errorEmbed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setDescription(`${CustomEmojis.CROSS} Cannot whitelist @everyone role.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Warn if role is higher than bot's role
  if (role.position >= botMember.roles.highest.position) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Role Hierarchy Warning')
      .setDescription(
        `The role ${role} is equal to or higher than my highest role. ` +
        `I may not be able to take actions against users with this role if needed.`
      )
      .setColor(EmbedColors.WARNING);

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  }

  // Warn if role has Administrator permission and whitelisting for ALL
  // This warning will be shown after category selection if ALL is chosen
  if (typeof role.permissions !== 'string' && role.permissions.has(PermissionFlagsBits.Administrator)) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Security Warning')
      .setDescription(
        `${role} has **Administrator** permission. Whitelisting this role for 'ALL' categories ` +
        `will mean users with this role bypass all anti-nuke protections.`
      )
      .setColor(EmbedColors.WARNING);

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  }

  await handleManageInteractive(interaction, services, guildId, role.id, role.name, true);
}

async function handleAddUser(
  interaction: ChatInputCommandInteraction,
  services: { whitelistService: WhitelistService },
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const guild = interaction.guild!;

  // Safety checks
  if (user.bot && user.id === interaction.client.user.id) {
    const errorEmbed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setDescription(`${CustomEmojis.CROSS} Cannot whitelist the bot itself.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  if (user.id === guild.ownerId) {
    const errorEmbed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setDescription(`${CustomEmojis.CROSS} Guild owner is already implicitly whitelisted.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  await handleManageInteractive(interaction, services, guildId, user.id, user.tag, false);
}

async function handleRemoveRole(
  interaction: ChatInputCommandInteraction,
  services: { whitelistService: WhitelistService },
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const role = interaction.options.getRole('role', true);
  await handleManageInteractive(interaction, services, guildId, role.id, role.name, true);
}

async function handleRemoveUser(
  interaction: ChatInputCommandInteraction,
  services: { whitelistService: WhitelistService },
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  await handleManageInteractive(interaction, services, guildId, user.id, user.tag, false);
}



async function handleList(
  interaction: ChatInputCommandInteraction,
  services: { whitelistService: WhitelistService },
  guildId: string
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: 64 }); // MessageFlags.Ephemeral
  }

  const filterOption = interaction.options.getString('filter');
  const filter = (filterOption === 'role' || filterOption === 'user') ? filterOption : undefined;
  const entries = await services.whitelistService.listAll(guildId, filter);

  if (entries.length === 0) {
    const infoEmbed = new EmbedBuilder()
      .setColor(EmbedColors.INFO)
      .setDescription(`ℹ️ No whitelist entries found.`);
    await interaction.editReply({ embeds: [infoEmbed] });
    return;
  }

  // Group by target
  const grouped = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!grouped.has(entry.targetId)) {
      grouped.set(entry.targetId, []);
    }
    grouped.get(entry.targetId)!.push(entry);
  }

  // Fetch actual names for roles and users
  const lines: string[] = [];
  let index = 1;

  for (const [targetId, targetEntries] of grouped) {
    const isRole = targetEntries[0].isRole;
    const categoriesList = targetEntries.map(e => formatCategoryName(e.category as WhitelistCategory));

    // Check for ALL category
    const hasAll = categoriesList.includes('ALL') || categoriesList.includes('ALL (bypass everything)');
    const displayCategories = hasAll ? 'All Categories' : categoriesList.join(', ');

    const mention = isRole ? `<@&${targetId}>` : `<@${targetId}>`;
    lines.push(`${index}. ${mention}\n> ${displayCategories}`);
    index++;
  }

  // Split into pages if too long
  const pageSize = 10;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    pages.push(lines.slice(i, i + pageSize));
  }

  const embed = new EmbedBuilder()
    .setTitle('📋 Whitelist Entries')
    .setDescription(pages[0].join('\n\n'))
    .setColor(EmbedColors.INFO)
    .setFooter({
      text: `Page 1/${pages.length} • ${entries.length} total entries`,
    })
    .setTimestamp();

  // Add management buttons
  const removeButton = new ButtonBuilder()
    .setCustomId(`whitelist_list_remove_${interaction.user.id}`)
    .setLabel('Remove Entry')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🗑️');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(removeButton);

  const response = await interaction.editReply({
    embeds: [embed],
    components: [row]
  });

  // Create collector
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: i => i.user.id === interaction.user.id && i.customId === `whitelist_list_remove_${interaction.user.id}`,
    time: 60000
  });

  collector.on('collect', async i => {
    await handleRemoveSelection(i, services, guildId, interaction, grouped);
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => { });
  });
}

async function handleRemoveSelection(
  interaction: MessageComponentInteraction,
  services: { whitelistService: WhitelistService },
  guildId: string,
  originalInteraction: ChatInputCommandInteraction,
  grouped: Map<string, any[]>
): Promise<void> {
  await interaction.deferUpdate();

  const guild = originalInteraction.guild!;
  const options: { label: string; description: string; value: string }[] = [];

  for (const [targetId, targetEntries] of grouped) {
    const isRole = targetEntries[0].isRole;
    let name = targetId;

    try {
      if (isRole) {
        const role = await guild.roles.fetch(targetId);
        name = role ? role.name : `Unknown Role (${targetId})`;
      } else {
        const member = await guild.members.fetch(targetId).catch(() => null);
        name = member ? member.user.tag : `Unknown User (${targetId})`;
      }
    } catch {
      name = isRole ? `Role (${targetId})` : `User (${targetId})`;
    }

    options.push({
      label: name.substring(0, 100),
      description: isRole ? 'Role' : 'User',
      value: `${targetId}:${isRole ? 'true' : 'false'}`
    });
  }

  // Truncate to 25 options (Discord limit)
  if (options.length > 25) {
    options.length = 25;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`whitelist_list_select_${originalInteraction.id}`)
    .setPlaceholder('Select a target to manage')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setTitle('Select Target')
    .setDescription('Choose a user or role to manage their whitelist entries.')
    .setColor(EmbedColors.INFO);

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });

  const collector = interaction.message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: i => i.user.id === originalInteraction.user.id && i.customId === `whitelist_list_select_${originalInteraction.id}`,
    time: 60000
  });

  collector.on('collect', async i => {
    const [targetId, isRoleStr] = i.values[0].split(':');
    const isRole = isRoleStr === 'true';

    // Get target name for display
    let targetName = targetId;
    try {
      if (isRole) {
        const role = await guild.roles.fetch(targetId);
        targetName = role ? role.name : targetId;
      } else {
        const member = await guild.members.fetch(targetId).catch(() => null);
        targetName = member ? member.user.tag : targetId;
      }
    } catch { }

    // We need to pass a ChatInputCommandInteraction to handleManageInteractive, 
    // but we have a StringSelectMenuInteraction. 
    // However, handleManageInteractive uses it for editReply/followUp/user.id.
    // We can cast it or adapt it. 
    // Since handleManageInteractive expects ChatInputCommandInteraction mainly for initial reply editing,
    // and we are already in a component flow, we might need to adjust handleManageInteractive or call it carefully.

    // Actually, handleManageInteractive calls editReply on the interaction passed to it.
    // If we pass 'i' (the select menu interaction), it has editReply.
    // But typescript might complain. Let's cast it for now as they share the needed methods for this flow.
    // Or better, update handleManageInteractive signature to accept RepliableInteraction.

    await i.deferUpdate();
    await handleManageInteractive(originalInteraction, services, guildId, targetId, targetName, isRole);
  });
}

async function handleManageInteractive(
  interaction: ChatInputCommandInteraction,
  services: { whitelistService: WhitelistService },
  guildId: string,
  targetId: string,
  targetName: string,
  isRole: boolean
): Promise<void> {
  // Fetch current entries
  const entries = await services.whitelistService.getEntriesForTarget(guildId, targetId);
  const currentCategories = new Set(entries.map(e => e.category as WhitelistCategory));
  const allCategories = Object.values(WhitelistCategory);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`whitelist_manage_select_${interaction.id}`)
    .setPlaceholder('Select categories to whitelist')
    .setMinValues(0)
    .setMaxValues(allCategories.length)
    .addOptions(
      allCategories.map(cat => ({
        label: formatCategoryName(cat),
        value: cat,
        description: cat === WhitelistCategory.ALL ? 'Bypass ALL protections' : `Allow ${formatCategoryName(cat)}`,
        default: currentCategories.has(cat)
      }))
    );

  const saveButton = new ButtonBuilder()
    .setCustomId(`whitelist_save_${interaction.id}`)
    .setLabel('Save Whitelist')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`whitelist_cancel_${interaction.id}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(saveButton, cancelButton);

  const embed = new EmbedBuilder()
    .setTitle(`Manage Whitelist - ${targetName}`)
    .setDescription(
      `Select the categories you want to whitelist for **${targetName}**.\n` +
      `• Checked items are currently whitelisted.\n` +
      `• Uncheck items to remove them.\n` +
      `• Check items to add them.`
    )
    .setColor(EmbedColors.INFO);

  const response = await interaction.editReply({
    embeds: [embed],
    components: [row1, row2]
  });

  // Create collector
  const collector = response.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId.includes(interaction.id),
    time: 60000
  });

  let selectedCategories = new Set(currentCategories);

  collector.on('collect', async i => {
    if (i.customId === `whitelist_manage_select_${interaction.id}`) {
      if (i.isStringSelectMenu()) {
        selectedCategories = new Set(i.values as WhitelistCategory[]);
        await i.deferUpdate();
      }
    } else if (i.customId === `whitelist_cancel_${interaction.id}`) {
      await i.deferUpdate();
      await interaction.deleteReply();
      collector.stop();
    } else if (i.customId === `whitelist_save_${interaction.id}`) {
      await i.deferUpdate();

      // Calculate changes
      const toAdd = [...selectedCategories].filter(c => !currentCategories.has(c));
      const toRemove = [...currentCategories].filter(c => !selectedCategories.has(c));

      if (toAdd.length === 0 && toRemove.length === 0) {
        await i.followUp({ content: '⚠️ No changes made.', ephemeral: true });
        return;
      }

      // Apply changes
      if (toAdd.length > 0) {
        if (isRole) {
          await services.whitelistService.addRole(guildId, targetId, toAdd, interaction.user.id);
        } else {
          await services.whitelistService.addUser(guildId, targetId, toAdd, interaction.user.id);
        }
      }

      if (toRemove.length > 0) {
        if (isRole) {
          await services.whitelistService.removeRole(guildId, targetId, toRemove);
        } else {
          await services.whitelistService.removeUser(guildId, targetId, toRemove);
        }
      }

      // Success embed
      const successEmbed = new EmbedBuilder()
        .setColor(EmbedColors.SUCCESS)
        .setTitle('<:tcet_tick:1437995479567962184> Whitelist Updated')
        .setDescription(`Successfully updated whitelist for **${targetName}**.`)
        .setFooter({
          text: `Updated by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      if (toAdd.length > 0) {
        successEmbed.addFields({
          name: '➕ Added',
          value: toAdd.map(c => `> ${formatCategoryName(c)}`).join('\n'),
          inline: true
        });
      }

      if (toRemove.length > 0) {
        successEmbed.addFields({
          name: '➖ Removed',
          value: toRemove.map(c => `> ${formatCategoryName(c)}`).join('\n'),
          inline: true
        });
      }

      if (selectedCategories.has(WhitelistCategory.ALL)) {
        successEmbed.addFields({
          name: '⚠️ Disclaimer',
          value: 'This target will bypass **ALL** Anti-Nuke protections. Ensure you trust them completely.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [successEmbed], components: [] });
      collector.stop();
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      interaction.editReply({ components: [] }).catch(() => { });
    }
  });
}



async function handleReset(
  interaction: ChatInputCommandInteraction,
  services: { whitelistService: WhitelistService },
  guildId: string
): Promise<void> {
  await interaction.deferReply();

  const confirm = interaction.options.getBoolean('confirm', true);

  if (!confirm) {
    const errorEmbed = new EmbedBuilder()
      .setColor(EmbedColors.ERROR)
      .setDescription(`${CustomEmojis.CROSS} You must confirm the reset by setting \`confirm\` to \`True\`.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Count entries before reset
  const entries = await services.whitelistService.listAll(guildId);
  const count = entries.length;

  if (count === 0) {
    const infoEmbed = new EmbedBuilder()
      .setColor(EmbedColors.INFO)
      .setDescription(`ℹ️ Whitelist is already empty.`);
    await interaction.editReply({ embeds: [infoEmbed] });
    return;
  }

  // Reset
  await services.whitelistService.reset(guildId);

  const embed = new EmbedBuilder()
    .setTitle('⚠️ Whitelist Reset')
    .setDescription(`All ${count} whitelist entries have been removed.`)
    .setColor(EmbedColors.WARNING)
    .setFooter({
      text: `Reset by ${interaction.user.tag} (${interaction.user.id})`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

function formatCategoryName(category: WhitelistCategory): string {
  const names: Record<WhitelistCategory, string> = {
    [WhitelistCategory.BAN_MEMBERS]: 'Banning Members',
    [WhitelistCategory.KICK_MEMBERS]: 'Kicking Members',
    [WhitelistCategory.DELETE_ROLES]: 'Deleting Roles',
    [WhitelistCategory.CREATE_ROLES]: 'Creating Roles',
    [WhitelistCategory.DELETE_CHANNELS]: 'Deleting Channels',
    [WhitelistCategory.CREATE_CHANNELS]: 'Creating Channels',
    [WhitelistCategory.ADD_BOTS]: 'Adding Bots',
    [WhitelistCategory.DANGEROUS_PERMS]: 'Dangerous Permissions',
    [WhitelistCategory.GIVE_ADMIN_ROLE]: 'Giving Admin Roles',
    [WhitelistCategory.PRUNE_MEMBERS]: 'Pruning Members',
    [WhitelistCategory.ALL]: 'ALL (Full Bypass)',
  };
  return names[category] || category;
}
