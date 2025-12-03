import {
  StringSelectMenuInteraction,
  ButtonInteraction,
} from 'discord.js';
import { BotClient } from '../../core/client';
import { InteractionHandler } from '../../core/interactionRouter';
import { ErrorHandler } from '../../core/errorHandler';

export class PanelHandler implements InteractionHandler {
  async execute(interaction: any, client: BotClient, parts: string[]): Promise<void> {
    const action = parts[1];

    try {
      switch (action) {
        case 'delete-template-select':
          await this.handleDeleteTemplateSelect(interaction, client);
          break;
        case 'delete-template-all':
          await this.handleDeleteTemplateAll(interaction, client);
          break;
        case 'delete-template-cancel':
          await this.handleDeleteTemplateCancel(interaction);
          break;
      }
    } catch (error) {
      ErrorHandler.handle(error as Error, 'PanelHandler');
      await ErrorHandler.sendError(interaction);
    }
  }

  /**
   * Handle delete template selection
   */
  async handleDeleteTemplateSelect(interaction: StringSelectMenuInteraction, client: BotClient): Promise<void> {
    const userId = interaction.customId.split(':')[2];
    
    // Verify user is the one who initiated
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: '<:tcet_cross:1437995480754946178> You cannot use this menu.',
        flags: 1 << 6
      });
      return;
    }

    const templateIds = interaction.values;

    // Check if already deferred by router
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    let deletedCount = 0;

    for (const templateId of templateIds) {
      try {
        await client.db.delete(templateId);
        deletedCount++;
      } catch (error) {
      }
    }

    await interaction.editReply({
      content: `<:tcet_tick:1437995479567962184> **Deleted ${deletedCount} template(s) successfully!**`,
      embeds: [],
      components: [],
    });
  }

  /**
   * Handle delete all templates for user
   */
  async handleDeleteTemplateAll(interaction: ButtonInteraction, client: BotClient): Promise<void> {
    const userId = interaction.customId.split(':')[2];
    
    // Verify user is the one who initiated
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: '<:tcet_cross:1437995480754946178> You cannot use this button.',
        flags: 1 << 6
      });
      return;
    }

    // Check if already deferred by router
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    // Get all templates created by this user's guild
    const allTemplates = await client.db.getAllTemplates();
    const userTemplates = allTemplates.filter((t: any) => t.originalGuild === interaction.guildId);

    let deletedCount = 0;

    for (const template of userTemplates) {
      try {
        await client.db.delete(template.id);
        deletedCount++;
      } catch (error) {
      }
    }

    await interaction.editReply({
      content: `<:tcet_tick:1437995479567962184> **Deleted all ${deletedCount} template(s) successfully!**`,
      embeds: [],
      components: [],
    });
  }

  /**
   * Handle cancel delete operation
   */
  async handleDeleteTemplateCancel(interaction: ButtonInteraction): Promise<void> {
    // Check if already deferred by router, use editReply instead of update
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Operation cancelled.',
        embeds: [],
        components: [],
      });
    } else {
      await interaction.update({
        content: '<:tcet_cross:1437995480754946178> Operation cancelled.',
        embeds: [],
        components: [],
      });
    }
  }
}
