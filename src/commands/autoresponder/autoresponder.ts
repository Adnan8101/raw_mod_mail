/**
 * Auto-Responder Command - /autoresponder add, list, edit, delete, toggle
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { AutoResponderService } from '../../services/AutoResponderService';
import { handleAdd } from './add';
import { handleList } from './list';
import { handleEdit } from './edit';
import { handleDelete } from './delete';
import { handleToggle } from './toggle';

export const data = new SlashCommandBuilder()
  .setName('autoresponder')
  .setDescription('Manage auto-responders')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a new auto-responder')
      .addStringOption(option =>
        option
          .setName('trigger')
          .setDescription('The trigger keyword/phrase')
          .setRequired(true)
          .setMaxLength(200)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all auto-responders')
      .addIntegerOption(option =>
        option
          .setName('page')
          .setDescription('Page number')
          .setRequired(false)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing auto-responder')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete an auto-responder')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable an auto-responder')
  );

export const category = 'autoresponder';
export const syntax = '/autoresponder <add|list|edit|delete|toggle>';
export const example = '/autoresponder add trigger:hello';
export const permission = 'Manage Guild';

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    autoResponderService: AutoResponderService;
  }
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'add':
      await handleAdd(interaction, services);
      break;
    case 'list':
      await handleList(interaction, services);
      break;
    case 'edit':
      await handleEdit(interaction, services);
      break;
    case 'delete':
      await handleDelete(interaction, services);
      break;
    case 'toggle':
      await handleToggle(interaction, services);
      break;
  }
}
