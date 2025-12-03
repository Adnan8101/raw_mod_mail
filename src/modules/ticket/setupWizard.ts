import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ChannelType,
  EmbedBuilder,
  Message,
  TextChannel,
  Collection,
  ColorResolvable,
} from 'discord.js';
import { BotClient } from '../../core/client';
import { EmbedController } from '../../core/embedController';
import { PanelData, AutosaveData } from '../../core/db/postgresDB';
import { InteractionHandler } from '../../core/interactionRouter';
import { ErrorHandler } from '../../core/errorHandler';

export class SetupWizardHandler implements InteractionHandler {
  /**
   * Helper function to safely set emoji on a button
   * Returns the button for chaining
   */
  private safeSetEmoji(button: ButtonBuilder, emoji: string | undefined): ButtonBuilder {
    if (!emoji) {
      return button;
    }

    try {
      // Try to parse custom emoji format: <:name:id> or <a:name:id>
      const customEmojiMatch = emoji.match(/^<a?:(\w+):(\d+)>$/);

      if (customEmojiMatch) {
        // Custom emoji - extract ID
        const emojiId = customEmojiMatch[2];
        const emojiName = customEmojiMatch[1];
        const isAnimated = emoji.startsWith('<a:');

        // Set custom emoji with ID
        button.setEmoji({
          id: emojiId,
          name: emojiName,
          animated: isAnimated
        });
      } else {
        // Unicode emoji or invalid format - just set it directly
        // Discord.js will handle unicode emojis
        button.setEmoji(emoji);
      }
    } catch (error) {
      // If setting emoji fails, just continue without it
    }

    return button;
  }

  async execute(interaction: any, client: BotClient, parts: string[]): Promise<void> {
    const action = parts[1];
    const userId = interaction.user.id;

    try {
      switch (action) {
        case 'main':
          await this.showMainMenu(interaction, client, userId);
          break;
        case 'channel':
          await this.showChannelMenu(interaction, client, userId);
          break;
        case 'button':
          await this.showButtonMenu(interaction, client, userId);
          break;
        case 'extra':
          await this.showExtraMenu(interaction, client, userId);
          break;
        case 'permissions':
          await this.showPermissionsMenu(interaction, client, userId);
          break;
        case 'permissions-user':
          await this.showUserPermissions(interaction, client, userId);
          break;
        case 'permissions-staff':
          await this.showStaffPermissions(interaction, client, userId);
          break;
        case 'permissions-suggestions':
          await this.showPermissionSuggestions(interaction, client, userId);
          break;
        case 'apply-user-suggestions':
          await this.applyUserSuggestions(interaction, client, userId);
          break;
        case 'apply-staff-suggestions':
          await this.applyStaffSuggestions(interaction, client, userId);
          break;
        case 'apply-all-suggestions':
          await this.applyAllSuggestions(interaction, client, userId);
          break;
        case 'select-user-permissions':
          await this.handleUserPermissionsSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'select-staff-permissions':
          await this.handleStaffPermissionsSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'finish':
          await this.finishSetup(interaction, client, userId);
          break;
        case 'cancel':
          await this.cancelSetup(interaction, client, userId);
          break;
        case 'send-new-message':
          await this.handleSendNewMessage(interaction, client, userId);
          break;
        case 'cancel-new-message':
          await this.handleCancelNewMessage(interaction, client, userId);
          break;
        case 'edit-select':
          await this.handleEditSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'set-name':
          await this.showNameModal(interaction, client, userId);
          break;
        case 'show-channel':
          await this.showChannelDropdown(interaction, client, userId);
          break;
        case 'show-opencategory':
          await this.showOpenCategoryDropdown(interaction, client, userId);
          break;

        case 'show-staffrole':
          await this.showStaffRoleDropdown(interaction, client, userId);
          break;
        case 'show-logs':
          await this.showLogsChannelDropdown(interaction, client, userId);
          break;
        case 'show-transcript':
          await this.showTranscriptChannelDropdown(interaction, client, userId);
          break;
        case 'set-label':
          await this.showLabelModal(interaction, client, userId);
          break;
        case 'set-emoji':
          await this.showEmojiModal(interaction, client, userId);
          break;
        case 'steal-emoji':
          await this.handleStealEmoji(interaction, client, userId, parts);
          break;
        case 'cancel-emoji':
          await this.handleCancelEmoji(interaction, client, userId);
          break;
        case 'set-description':
          await this.showDescriptionModal(interaction, client, userId);
          break;
        case 'set-openmessage':
          await this.showOpenMessageModal(interaction, client, userId);
          break;
        case 'add-question':
          await this.showAddQuestionModal(interaction, client, userId);
          break;
        case 'confirm-question-primary':
          await this.handleQuestionTypePrimary(interaction, client, userId);
          break;
        case 'confirm-question-optional':
          await this.handleQuestionTypeOptional(interaction, client, userId);
          break;
        case 'confirm-question-back':
          await this.handleQuestionBack(interaction, client, userId);
          break;
        case 'select-channel':
          await this.handleChannelSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'select-opencategory':
          await this.handleOpenCategorySelect(interaction as StringSelectMenuInteraction, client, userId);
          break;

        case 'select-staffrole':
          await this.handleStaffRoleSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'select-logs':
          await this.handleLogsChannelSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'select-transcript':
          await this.handleTranscriptChannelSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'select-claimable':
          await this.handleClaimableSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'select-ownerclose':
          await this.handleOwnerCloseSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'set-color':
          // Legacy support or if user clicks old button
          await this.showEmbedColorModal(interaction, client, userId);
          break;
        case 'set-embed-color':
          await this.showEmbedColorModal(interaction, client, userId);
          break;
        case 'modal-color':
          // Legacy support
          await this.handleEmbedColorModal(interaction as ModalSubmitInteraction, client, userId);
          break;
        case 'modal-embed-color':
          await this.handleEmbedColorModal(interaction as ModalSubmitInteraction, client, userId);
          break;
        case 'select-button-style':
          await this.showButtonStyleMenu(interaction, client, userId);
          break;
        case 'select-button-style-confirm':
          await this.handleButtonStyleSelect(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'delete-question':
          await this.handleDeleteQuestion(interaction as StringSelectMenuInteraction, client, userId);
          break;
        case 'modal-name':
          await this.handleNameModal(interaction as ModalSubmitInteraction, client, userId);
          break;
        case 'modal-label':
          await this.handleLabelModal(interaction as ModalSubmitInteraction, client, userId);
          break;
        case 'modal-description':
          await this.handleDescriptionModal(interaction as ModalSubmitInteraction, client, userId);
          break;
        case 'modal-openmessage':
          await this.handleOpenMessageModal(interaction as ModalSubmitInteraction, client, userId);
          break;
        case 'modal-question':
          await this.handleQuestionModal(interaction as ModalSubmitInteraction, client, userId);
          break;
      }
    } catch (error) {
      ErrorHandler.handle(error as Error, 'SetupWizardHandler');
      await ErrorHandler.sendError(interaction);
    }
  }

  private async getOrCreateAutosave(client: BotClient, userId: string): Promise<Partial<PanelData>> {
    const autosave = await client.db.getAutosave(userId);
    if (autosave) {
      return autosave.data;
    }

    // Create default autosave
    const defaultData: Partial<PanelData> = {
      label: 'Open Ticket',
      emoji: '<:module:1437997093753983038>',
      color: 'Primary',
      description: 'Click below to open a ticket.',
      openMessage: 'Thank you for contacting support. Please describe your issue in detail.',
      questions: [],
      claimable: false,
      enabled: true,
      userPermissions: [],
      staffPermissions: [],
    };

    return defaultData;
  }

  private saveAutosave(client: BotClient, userId: string, data: Partial<PanelData>, change?: string): void {
    const autosave: AutosaveData = {
      id: `autosave:${userId}`,
      type: 'autosave',
      userId,
      data,
      startedAt: new Date().toISOString(),
      editChanges: change ? [...(data.editChanges || []), change] : (data.editChanges || []),
    };
    client.db.save(autosave);
  }

  private addEditChange(data: Partial<PanelData>, field: string, oldValue: any, newValue: any): void {
    if (!data.editChanges) data.editChanges = [];

    // Format git-style change message
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const change = `[${timestamp}] Modified ${field}: "${oldValue || 'empty'}" → "${newValue}"`;
    data.editChanges.push(change);
  }

  async showMainMenu(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const isEdit = !!data.id && data.id.startsWith('panel:');
    const embed = EmbedController.createSetupWizardEmbed(data, isEdit);

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:channel:setup')
        .setLabel('Setup Channel')
        .setEmoji('<:zicons_newschannel:1437846918318526536>')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wizard:button:setup')
        .setLabel('Button Setup')
        .setEmoji('🔘')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wizard:permissions:setup')
        .setLabel('Permissions')
        .setEmoji('<:settings:1437996913180934144>')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wizard:extra:setup')
        .setLabel('Extra')
        .setEmoji('<:pb_utils:1437999137919340546>')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:finish:setup')
        .setLabel('Finish Setup')
        .setEmoji('<:tcet_tick:1437995479567962184>')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wizard:cancel:setup')
        .setLabel('Cancel')
        .setEmoji('<:tcet_cross:1437995480754946178>')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
  }

  async showChannelMenu(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const embed = EmbedController.createChannelSetupEmbed(data);

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:set-name:setup')
        .setLabel('Panel Name')
        .setEmoji('<:module:1437997093753983038>')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:show-channel:setup')
        .setLabel('Channel')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:show-opencategory:setup')
        .setLabel('Open Category')
        .setEmoji('📂')
        .setStyle(ButtonStyle.Secondary)
    );



    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:show-staffrole:setup')
        .setLabel('Staff Role')
        .setEmoji('<:xieron_staffs:1437995300164730931>')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:show-logs:setup')
        .setLabel('Logs Channel')
        .setEmoji('🗒️')
        .setStyle(ButtonStyle.Secondary)
    );

    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:show-transcript:setup')
        .setLabel('Transcript Channel')
        .setEmoji('<:module:1437997093753983038>')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:main:back')
        .setLabel('Back to Main')
        .setEmoji('<:caution:1437997212008185866>')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row3, row4] });
  }

  async showExtraMenu(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const embed = EmbedController.createExtraConfigEmbed(data);

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:set-description:setup')
        .setLabel('Description')
        .setEmoji('<:module:1437997093753983038>')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:set-openmessage:setup')
        .setLabel('Open Message')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:add-question:setup')
        .setLabel('Add Question')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-claimable:setup')
        .setPlaceholder('Claimable?')
        .addOptions([
          { label: 'Yes', value: 'true', emoji: '<:tcet_tick:1437995479567962184>' },
          { label: 'No', value: 'false', emoji: '<:tcet_cross:1437995480754946178>' },
        ])
    );

    const row3 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-ownerclose:setup')
        .setPlaceholder('Allow Owner to Close Ticket?')
        .addOptions([
          { label: 'Yes - Owner can close', value: 'true', emoji: '<:tcet_tick:1437995479567962184>' },
          { label: 'No - Only staff can close', value: 'false', emoji: '<:tcet_cross:1437995480754946178>' },
        ])
    );

    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:main:back')
        .setLabel('Back to Main')
        .setEmoji('<:caution:1437997212008185866>')
        .setStyle(ButtonStyle.Secondary)
    );

    const components: any[] = [row1, row2, row3];

    // Add delete question dropdown if there are questions
    if (data.customQuestions && data.customQuestions.length > 0) {
      const deleteRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('wizard:delete-question:setup')
          .setPlaceholder('Delete a question')
          .addOptions(
            data.customQuestions.map((q, i) => {
              const typeLabel = q.type === 'primary' ? '[Primary]' : '[Optional]';
              return {
                label: `${typeLabel} Question ${i + 1}`,
                description: q.text.substring(0, 100),
                value: i.toString(),
              };
            })
          )
      );
      components.push(deleteRow);
    }

    // Always add back button as last component (limit is 5 total)
    if (components.length < 5) {
      components.push(row4);
    }

    await interaction.editReply({ embeds: [embed], components });
  }

  async showNameModal(interaction: ButtonInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    const modal = new ModalBuilder()
      .setCustomId('wizard:modal-name:setup')
      .setTitle('Set Panel Name');

    const nameInput = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('Panel Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Support Panel')
      .setRequired(true)
      .setMaxLength(100);

    // Auto-load current value if editing
    if (data.name) {
      nameInput.setValue(data.name);
    }

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));

    await interaction.showModal(modal);
  }

  async showDescriptionModal(interaction: ButtonInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    const modal = new ModalBuilder()
      .setCustomId('wizard:modal-description:setup')
      .setTitle('Set Panel Description');

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Click below to open a ticket.')
      .setRequired(true)
      .setMaxLength(500);

    // Auto-load current value if editing
    if (data.description) {
      descInput.setValue(data.description);
    }

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(descInput));

    await interaction.showModal(modal);
  }

  async showOpenMessageModal(interaction: ButtonInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    const modal = new ModalBuilder()
      .setCustomId('wizard:modal-openmessage:setup')
      .setTitle('Set Open Message');

    const msgInput = new TextInputBuilder()
      .setCustomId('openmessage')
      .setLabel('Open Message')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Thank you for contacting support...')
      .setRequired(true)
      .setMaxLength(1000);

    // Auto-load current value if editing
    if (data.openMessage) {
      msgInput.setValue(data.openMessage);
    }

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(msgInput));

    await interaction.showModal(modal);
  }

  async showAddQuestionModal(interaction: ButtonInteraction, client: BotClient, userId: string): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('wizard:modal-question:setup')
      .setTitle('Add Custom Question');

    const questionInput = new TextInputBuilder()
      .setCustomId('question')
      .setLabel('Question Text')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('e.g., What is your issue?')
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(questionInput)
    );

    await interaction.showModal(modal);
  }

  async handleChannelSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.channel = interaction.values[0];
    this.saveAutosave(client, userId, data);
    await this.showChannelMenu(interaction, client, userId);
  }

  async handleOpenCategorySelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.openCategory = interaction.values[0];
    this.saveAutosave(client, userId, data);
    await this.showChannelMenu(interaction, client, userId);
  }



  async handleStaffRoleSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.staffRole = interaction.values[0];
    this.saveAutosave(client, userId, data);
    await this.showChannelMenu(interaction, client, userId);
  }

  async handleLogsChannelSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.logsChannel = interaction.values[0];
    this.saveAutosave(client, userId, data);
    await this.showChannelMenu(interaction, client, userId);
  }

  async handleTranscriptChannelSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.transcriptChannel = interaction.values[0];
    this.saveAutosave(client, userId, data);
    await this.showChannelMenu(interaction, client, userId);
  }

  async handleClaimableSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.claimable = interaction.values[0] === 'true';
    this.saveAutosave(client, userId, data);
    await this.showExtraMenu(interaction, client, userId);
  }

  async handleOwnerCloseSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.allowOwnerClose = interaction.values[0] === 'true';
    this.saveAutosave(client, userId, data);
    await this.showExtraMenu(interaction, client, userId);
  }

  async showEmbedColorModal(interaction: ButtonInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    const modal = new ModalBuilder()
      .setCustomId('wizard:modal-embed-color:setup')
      .setTitle('Set Embed Color');

    const colorInput = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Hex Color Code')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('#FF0000 or FF0000')
      .setRequired(true)
      .setMaxLength(7);

    // Auto-load current value if editing
    if (data.embedColor) {
      colorInput.setValue(data.embedColor);
    }

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput));

    await interaction.showModal(modal);
  }

  async handleEmbedColorModal(interaction: ModalSubmitInteraction, client: BotClient, userId: string): Promise<void> {
    let color = interaction.fields.getTextInputValue('color');

    // Validate hex code
    if (!color.startsWith('#')) {
      color = `#${color}`;
    }

    const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
    if (!hexRegex.test(color)) {
      await interaction.reply({
        content: '<:tcet_cross:1437995480754946178> Invalid hex color code. Please use format like #FF0000.',
        flags: 1 << 6 // MessageFlags.Ephemeral
      });
      return;
    }

    const data = await this.getOrCreateAutosave(client, userId);
    const oldValue = data.embedColor;
    data.embedColor = color;
    if (oldValue) this.addEditChange(data, 'Embed Color', oldValue, color);
    this.saveAutosave(client, userId, data);

    await interaction.deferUpdate();
    await this.showButtonMenu(interaction, client, userId);
  }

  async showButtonStyleMenu(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    const embed = new EmbedBuilder()
      .setTitle('🎨 Select Button Style')
      .setDescription('Choose the style (color) for your ticket button.')
      .setColor(null)
      .addFields(
        { name: 'Current Style', value: data.color || 'Primary', inline: true }
      )
      .setFooter({ text: 'Select from the dropdown below' })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('wizard:select-button-style-confirm:setup')
      .setPlaceholder('Select Button Style')
      .addOptions([
        { label: 'Primary (Blurple)', value: 'Primary', description: 'Standard Discord blurple button', emoji: '🔵' },
        { label: 'Secondary (Grey)', value: 'Secondary', description: 'Grey button', emoji: '⚪' },
        { label: 'Success (Green)', value: 'Success', description: 'Green button', emoji: '🟢' },
        { label: 'Danger (Red)', value: 'Danger', description: 'Red button', emoji: '🔴' },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:button:setup')
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row, backButton] });
  }

  async handleButtonStyleSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const style = interaction.values[0];
    const data = await this.getOrCreateAutosave(client, userId);

    const oldValue = data.color;
    data.color = style;
    if (oldValue) this.addEditChange(data, 'Button Style', oldValue, style);

    this.saveAutosave(client, userId, data);

    await this.showButtonMenu(interaction, client, userId);
  }

  async handleDeleteQuestion(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const index = parseInt(interaction.values[0]);

    // Delete from both arrays
    if (data.questions && data.questions[index] !== undefined) {
      data.questions.splice(index, 1);
    }
    if (data.customQuestions && data.customQuestions[index] !== undefined) {
      data.customQuestions.splice(index, 1);
    }

    this.saveAutosave(client, userId, data);
    await this.showExtraMenu(interaction, client, userId);
  }

  async handleEditSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const panelId = interaction.values[0];
    const panel = await client.db.get(panelId) as PanelData;

    if (!panel) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Panel not found.',
        components: [],
      });
      return;
    }

    // Load panel data into autosave for editing
    const autosaveData: Partial<PanelData> = {
      id: panel.id, // Keep the panel ID for updating
      name: panel.name,
      channel: panel.channel,
      openCategory: panel.openCategory,
      closeCategory: panel.closeCategory,
      staffRole: panel.staffRole,
      logsChannel: panel.logsChannel,
      transcriptChannel: panel.transcriptChannel,
      label: panel.label,
      emoji: panel.emoji,
      color: panel.color,
      description: panel.description,
      openMessage: panel.openMessage,
      questions: panel.questions,
      customQuestions: panel.customQuestions, // Include custom questions for editing
      claimable: panel.claimable,
      enabled: panel.enabled,
      userPermissions: panel.userPermissions || [],
      staffPermissions: panel.staffPermissions || [],
    };

    this.saveAutosave(client, userId, autosaveData);

    // Show the main setup wizard with loaded data
    await this.showMainMenu(interaction, client, userId);
  }

  async handleNameModal(interaction: ModalSubmitInteraction, client: BotClient, userId: string): Promise<void> {
    const name = interaction.fields.getTextInputValue('name');
    const data = await this.getOrCreateAutosave(client, userId);
    const oldValue = data.name;
    data.name = name;
    if (oldValue) this.addEditChange(data, 'Panel Name', oldValue, name);
    this.saveAutosave(client, userId, data);
    await interaction.deferUpdate();
    await this.showChannelMenu(interaction, client, userId);
  }

  async handleDescriptionModal(interaction: ModalSubmitInteraction, client: BotClient, userId: string): Promise<void> {
    const description = interaction.fields.getTextInputValue('description');
    const data = await this.getOrCreateAutosave(client, userId);
    const oldValue = data.description;
    data.description = description;
    if (oldValue) this.addEditChange(data, 'Description', oldValue.substring(0, 30), description.substring(0, 30));
    this.saveAutosave(client, userId, data);
    await interaction.deferUpdate();
    await this.showExtraMenu(interaction, client, userId);
  }

  async handleOpenMessageModal(interaction: ModalSubmitInteraction, client: BotClient, userId: string): Promise<void> {
    const message = interaction.fields.getTextInputValue('openmessage');
    const data = await this.getOrCreateAutosave(client, userId);
    data.openMessage = message;
    this.saveAutosave(client, userId, data);
    await interaction.deferUpdate();
    await this.showExtraMenu(interaction, client, userId);
  }

  async handleQuestionModal(interaction: ModalSubmitInteraction, client: BotClient, userId: string): Promise<void> {
    const question = interaction.fields.getTextInputValue('question');

    const data = await this.getOrCreateAutosave(client, userId);

    // Store the pending question in autosave temporarily
    data.pendingQuestion = question;
    this.saveAutosave(client, userId, data);

    await interaction.deferUpdate();
    await this.showQuestionConfirmation(interaction, client, userId, question);
  }

  async showQuestionConfirmation(interaction: any, client: BotClient, userId: string, question: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    // Create an embed showing the captured question
    const embed = new EmbedBuilder()
      .setTitle('<:tcet_tick:1437995479567962184> Question Captured')
      .setDescription('**Your question:**\n' + question + '\n\nPlease select the question type:')
      .setColor(0x00FF00)
      .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:confirm-question-primary:setup')
        .setLabel('Add Primary')
        .setEmoji('🔵')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wizard:confirm-question-optional:setup')
        .setLabel('Add Optional')
        .setEmoji('⚪')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:confirm-question-back:setup')
        .setLabel('Back')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }

  async handleQuestionTypePrimary(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const question = data.pendingQuestion;

    if (!question) {
      await this.showExtraMenu(interaction, client, userId);
      return;
    }

    // Initialize customQuestions if not exists
    if (!data.customQuestions) data.customQuestions = [];

    // Also keep legacy questions array for backward compatibility
    if (!data.questions) data.questions = [];

    // Add to customQuestions array as primary
    data.customQuestions.push({ text: question, type: 'primary' });

    // Add to legacy questions array (text only)
    data.questions.push(question);

    // Clear pending question
    delete data.pendingQuestion;

    this.saveAutosave(client, userId, data);
    await this.showExtraMenu(interaction, client, userId);
  }

  async handleQuestionTypeOptional(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const question = data.pendingQuestion;

    if (!question) {
      await this.showExtraMenu(interaction, client, userId);
      return;
    }

    // Initialize customQuestions if not exists
    if (!data.customQuestions) data.customQuestions = [];

    // Also keep legacy questions array for backward compatibility
    if (!data.questions) data.questions = [];

    // Add to customQuestions array as optional
    data.customQuestions.push({ text: question, type: 'optional' });

    // Add to legacy questions array (text only)
    data.questions.push(question);

    // Clear pending question
    delete data.pendingQuestion;

    this.saveAutosave(client, userId, data);
    await this.showExtraMenu(interaction, client, userId);
  }

  async handleQuestionBack(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    // Clear pending question without saving it
    delete data.pendingQuestion;
    this.saveAutosave(client, userId, data);

    await this.showExtraMenu(interaction, client, userId);
  }

  async handleLabelModal(interaction: ModalSubmitInteraction, client: BotClient, userId: string): Promise<void> {
    const label = interaction.fields.getTextInputValue('label');
    const data = await this.getOrCreateAutosave(client, userId);
    const oldValue = data.label;
    data.label = label;
    if (oldValue) this.addEditChange(data, 'Button Label', oldValue, label);
    this.saveAutosave(client, userId, data);
    await interaction.deferUpdate();
    await this.showButtonMenu(interaction, client, userId);
  }

  async finishSetup(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    // Validate required fields
    if (!data.name || !data.channel || !data.openCategory || !data.staffRole) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Please fill in all required fields: Panel Name, Channel, Open Category, and Staff Role.',
        embeds: [],
        components: [],
      });
      return;
    }

    // Check if this is an edit (has existing panel ID) or new panel
    const isEdit = !!data.id && data.id.startsWith('panel:');
    let panelId = isEdit ? data.id : await client.db.generatePanelId();

    // Create complete panel data
    const panel: PanelData = {
      id: panelId!,
      type: 'panel',
      guildId: interaction.guildId || undefined, // Store guild ID
      name: data.name,
      channel: data.channel,
      openCategory: data.openCategory,
      closeCategory: data.closeCategory,
      staffRole: data.staffRole,
      logsChannel: data.logsChannel,
      transcriptChannel: data.transcriptChannel,
      label: data.label || 'Open Ticket',
      emoji: data.emoji || '<:module:1437997093753983038>',
      color: data.color || 'Primary',
      embedColor: data.embedColor,
      description: data.description || 'Click below to open a ticket.',
      openMessage: data.openMessage || 'Thank you for contacting support.',
      questions: data.questions || [],
      customQuestions: data.customQuestions || [],
      claimable: data.claimable || false,
      allowOwnerClose: data.allowOwnerClose !== false,
      enabled: data.enabled !== undefined ? data.enabled : true,
      ticketsCreated: isEdit ? (await client.db.get(panelId!) as PanelData | null)?.ticketsCreated || 0 : 0,
      messageId: isEdit ? (await client.db.get(panelId!) as PanelData | null)?.messageId : undefined,
      userPermissions: data.userPermissions || [],
      staffPermissions: data.staffPermissions || [],
    };

    // Save panel
    await client.db.save(panel);

    // Delete autosave
    await client.db.deleteAutosave(userId);

    // Deploy or update panel message
    try {
      if (!panel.channel) {
        throw new Error('Panel channel is not defined');
      }

      const channel = await client.channels.fetch(panel.channel);
      if (channel?.isTextBased() && 'send' in channel) {
        // Create simple embed with panel description
        const embed = new EmbedBuilder()
          .setTitle(`${panel.emoji} ${panel.name}`)
          .setDescription(panel.description)
          .setColor(panel.embedColor as ColorResolvable || null)
          .setFooter({ text: 'Click the button below to open a ticket' })
          .setTimestamp();

        // Map color string to ButtonStyle
        const colorMap: Record<string, ButtonStyle> = {
          'Primary': ButtonStyle.Primary,
          'Secondary': ButtonStyle.Secondary,
          'Success': ButtonStyle.Success,
          'Danger': ButtonStyle.Danger,
        };
        const buttonStyle = colorMap[panel.color] || ButtonStyle.Primary;

        const ticketButton = new ButtonBuilder()
          .setCustomId(`ticket:open:${panelId}`)
          .setLabel(panel.label)
          .setStyle(buttonStyle);

        // Safely set emoji using the helper function
        this.safeSetEmoji(ticketButton, panel.emoji);

        const button = new ActionRowBuilder<ButtonBuilder>().addComponents(ticketButton);

        // If editing and message exists, try to edit it, otherwise send new message
        if (isEdit && panel.messageId) {
          try {
            const message = await channel.messages.fetch(panel.messageId);
            await message.edit({ embeds: [embed], components: [button] });
          } catch {
            // Message not found, ask user if they want to send a new one
            await this.askToSendNewMessage(interaction, client, userId, panel);
            return;
          }
        } else {
          // New panel, send message
          const message = await channel.send({ embeds: [embed], components: [button] });
          panel.messageId = message.id;
          await client.db.save(panel);
        }
      }
    } catch (error) {
      ErrorHandler.handle(error as Error, 'Deploy panel message');
    }

    const actionText = isEdit ? 'updated' : 'created';
    await interaction.editReply({
      content: `<:tcet_tick:1437995479567962184> **Panel "${panel.name}" ${actionText} successfully!**\n\nYou can now use it in <#${panel.channel}>`,
      embeds: [],
      components: [],
    });
  }

  async cancelSetup(interaction: any, client: BotClient, userId: string): Promise<void> {
    await client.db.deleteAutosave(userId);
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Setup cancelled. All progress has been discarded.',
      embeds: [],
      components: [],
    });
  }

  async showButtonMenu(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    const embed = new EmbedBuilder()
      .setTitle('🔘 Button & Embed Setup')
      .setDescription('Configure the button appearance and embed color.')
      .setColor(null)
      .addFields(
        { name: 'Label', value: data.label || 'Open Ticket', inline: true },
        { name: 'Emoji', value: data.emoji || '<:module:1437997093753983038>', inline: true },
        { name: 'Button Style', value: data.color || 'Primary', inline: true },
        { name: 'Embed Color', value: data.embedColor || 'Default', inline: true }
      )
      .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:set-label:setup')
        .setLabel('Button Label')
        .setEmoji('<:module:1437997093753983038>')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:set-emoji:setup')
        .setLabel('Button Emoji')
        .setEmoji('😀')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:select-button-style:setup')
        .setLabel('Button Style')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:set-embed-color:setup')
        .setLabel('Embed Color')
        .setEmoji('#️⃣')
        .setStyle(ButtonStyle.Secondary)
    );


    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:main:back')
        .setLabel('Back to Main')
        .setEmoji('<:caution:1437997212008185866>')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
  }

  async showChannelDropdown(interaction: any, client: BotClient, userId: string): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    const textChannels = guild.channels.cache.filter(
      (c: any) => c.type === ChannelType.GuildText
    );
    const channelOptions = Array.from(textChannels.values()).slice(0, 25).map((channel: any) => ({
      label: channel.name,
      value: channel.id,
    }));

    if (channelOptions.length === 0) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> No text channels found.',
        embeds: [],
        components: [],
      });
      return;
    }

    const data = await this.getOrCreateAutosave(client, userId);
    const embed = EmbedController.createChannelSetupEmbed(data);

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-channel:setup')
        .setPlaceholder('Select Panel Channel')
        .addOptions(channelOptions)
    );

    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:channel:setup')
        .setLabel('Back')
        .setEmoji('<:caution:1437997212008185866>')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [selectMenu, backButton] });
  }

  async showOpenCategoryDropdown(interaction: any, client: BotClient, userId: string): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    const categories = guild.channels.cache.filter(
      (c: any) => c.type === ChannelType.GuildCategory
    );
    const categoryOptions = Array.from(categories.values()).slice(0, 25).map((category: any) => ({
      label: category.name,
      value: category.id,
    }));

    if (categoryOptions.length === 0) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> No categories found.',
        embeds: [],
        components: [],
      });
      return;
    }

    const data = await this.getOrCreateAutosave(client, userId);
    const embed = EmbedController.createChannelSetupEmbed(data);

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-opencategory:setup')
        .setPlaceholder('Select Open Category')
        .addOptions(categoryOptions)
    );

    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:channel:setup')
        .setLabel('Back')
        .setEmoji('<:caution:1437997212008185866>')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [selectMenu, backButton] });
  }



  async showStaffRoleDropdown(interaction: any, client: BotClient, userId: string): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    const roles = guild.roles.cache.filter((r: any) => !r.managed && r.name !== '@everyone');
    const roleOptions = Array.from(roles.values()).slice(0, 25).map((role: any) => ({
      label: role.name,
      value: role.id,
    }));

    if (roleOptions.length === 0) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> No roles found.',
        embeds: [],
        components: [],
      });
      return;
    }

    const data = await this.getOrCreateAutosave(client, userId);
    const embed = EmbedController.createChannelSetupEmbed(data);

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-staffrole:setup')
        .setPlaceholder('Select Staff Role')
        .addOptions(roleOptions)
    );

    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:channel:setup')
        .setLabel('Back')
        .setEmoji('<:caution:1437997212008185866>')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [selectMenu, backButton] });
  }

  async showLogsChannelDropdown(interaction: any, client: BotClient, userId: string): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    const textChannels = guild.channels.cache.filter(
      (c: any) => c.type === ChannelType.GuildText
    );
    const channelOptions = Array.from(textChannels.values()).slice(0, 25).map((channel: any) => ({
      label: channel.name,
      value: channel.id,
    }));

    if (channelOptions.length === 0) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> No text channels found.',
        embeds: [],
        components: [],
      });
      return;
    }

    const data = await this.getOrCreateAutosave(client, userId);
    const embed = EmbedController.createChannelSetupEmbed(data);

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-logs:setup')
        .setPlaceholder('Select Logs Channel')
        .addOptions(channelOptions)
    );

    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:channel:setup')
        .setLabel('Back')
        .setEmoji('<:caution:1437997212008185866>')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [selectMenu, backButton] });
  }

  async showTranscriptChannelDropdown(interaction: any, client: BotClient, userId: string): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    const textChannels = guild.channels.cache.filter(
      (c: any) => c.type === ChannelType.GuildText
    );
    const channelOptions = Array.from(textChannels.values()).slice(0, 25).map((channel: any) => ({
      label: channel.name,
      value: channel.id,
    }));

    if (channelOptions.length === 0) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> No text channels found.',
        embeds: [],
        components: [],
      });
      return;
    }

    const data = await this.getOrCreateAutosave(client, userId);
    const embed = EmbedController.createChannelSetupEmbed(data);

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-transcript:setup')
        .setPlaceholder('Select Transcript Channel')
        .addOptions(channelOptions)
    );

    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:channel:setup')
        .setLabel('Back')
        .setEmoji('<:caution:1437997212008185866>')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [selectMenu, backButton] });
  }

  async showLabelModal(interaction: ButtonInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    const modal = new ModalBuilder()
      .setCustomId('wizard:modal-label:setup')
      .setTitle('Set Button Label');

    const labelInput = new TextInputBuilder()
      .setCustomId('label')
      .setLabel('Button Label')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Open Ticket')
      .setRequired(true)
      .setMaxLength(80);

    // Auto-load current value if editing
    if (data.label) {
      labelInput.setValue(data.label);
    }

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(labelInput));

    await interaction.showModal(modal);
  }

  async showEmojiModal(interaction: ButtonInteraction, client: BotClient, userId: string): Promise<void> {
    // Instead of modal, send an embed asking for emoji
    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:cancel-emoji:setup')
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    );

    const replyMessage = await interaction.editReply({
      content: '🎨 **Set Button Emoji**\nPlease send the emoji you want to use for the ticket button in this channel.\n\nExample: `<:module:1437997093753983038>` or `📩`\n\nThe bot will automatically detect your message.\nYou have 60 seconds to respond.',
      embeds: [],
      components: [backButton]
    });

    // Check if channel is a TextChannel
    if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> This command can only be used in a text channel.',
        embeds: [],
        components: [],
      });
      return;
    }

    // Create message collector
    const filter = (m: Message) => m.author.id === userId;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 60000,
      max: 1
    });

    const componentCollector = replyMessage.createMessageComponentCollector({
      filter: (i: any) => i.user.id === userId && i.customId === 'wizard:cancel-emoji:setup',
      time: 60000,
      max: 1
    });

    componentCollector.on('collect', async (i: any) => {
      collector.stop('cancelled');
      await i.deferUpdate();
      await this.showButtonMenu(interaction, client, userId);
    });

    collector.on('collect', async (msg: Message) => {
      const emoji = msg.content.trim();

      // Delete user's message
      await msg.delete().catch(() => { });

      // Check if it's a custom emoji
      const customEmojiMatch = emoji.match(/^<a?:(\w+):(\d+)>$/);

      if (customEmojiMatch) {
        const emojiId = customEmojiMatch[2];
        const emojiName = customEmojiMatch[1];
        const isAnimated = emoji.startsWith('<a:');

        // Check if emoji is from this server
        const guild = msg.guild;
        const emojiExists = guild?.emojis.cache.has(emojiId);

        if (!emojiExists) {
          // Emoji is from another server - ask to steal it
          const stealEmbed = new EmbedBuilder()
            .setTitle('⚠️ External Emoji Detected')
            .setDescription(`The emoji ${emoji} is not from this server.\n\nI need to upload it to this server to use it. Would you like me to continue?`)
            .setColor(0xFFA500)
            .setFooter({ text: 'This will add the emoji to your server' })
            .setTimestamp();

          const stealRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`wizard:steal-emoji:${emojiId}:${emojiName}:${isAnimated}`)
              .setLabel('Continue & Upload')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('wizard:cancel-emoji:setup')
              .setLabel('Cancel')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.editReply({ embeds: [stealEmbed], components: [stealRow] });
          return;
        }
      }

      // Emoji is valid (unicode or from this server)
      const data = await this.getOrCreateAutosave(client, userId);
      data.emoji = emoji;
      this.saveAutosave(client, userId, data);

      // Show button menu again
      await this.showButtonMenu({ editReply: interaction.editReply.bind(interaction) }, client, userId);
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({
          content: '<:tcet_cross:1437995480754946178> Emoji selection timed out. Please try again.',
          embeds: [],
          components: [],
        }).catch(() => { });
      }
    });
  }

  async handleStealEmoji(interaction: any, client: BotClient, userId: string, parts: string[]): Promise<void> {
    const emojiId = parts[2];
    const emojiName = parts[3];
    const isAnimated = parts[4] === 'true';

    try {
      // Fetch the emoji URL
      const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;

      // Upload emoji to server
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({
          content: '<:tcet_cross:1437995480754946178> Could not access server information.',
          embeds: [],
          components: [],
        });
        return;
      }

      const createdEmoji = await guild.emojis.create({
        attachment: emojiUrl,
        name: emojiName,
      });

      // Save emoji to autosave
      const data = await this.getOrCreateAutosave(client, userId);
      data.emoji = `<${isAnimated ? 'a' : ''}:${createdEmoji.name}:${createdEmoji.id}>`;
      this.saveAutosave(client, userId, data);

      // Show success message and go back to button menu
      await interaction.editReply({
        content: `<:tcet_tick:1437995479567962184> Emoji **:${emojiName}:** uploaded successfully!`,
        embeds: [],
        components: [],
      });

      // Wait a moment then show button menu
      setTimeout(async () => {
        await this.showButtonMenu(interaction, client, userId);
      }, 1500);

    } catch (error) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Failed to upload emoji. Make sure I have permission to manage emojis.',
        embeds: [],
        components: [],
      });
    }
  }

  async handleCancelEmoji(interaction: any, client: BotClient, userId: string): Promise<void> {
    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Emoji selection cancelled.',
      embeds: [],
      components: [],
    });

    // Wait a moment then show button menu
    setTimeout(async () => {
      await this.showButtonMenu(interaction, client, userId);
    }, 1000);
  }

  async askToSendNewMessage(interaction: any, client: BotClient, userId: string, panel: PanelData): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('<:caution:1437997212008185866> Original Message Not Found')
      .setDescription('I could not find the original panel message. It may have been deleted.\n\nWould you like me to send a new message?')
      .setColor(null)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:send-new-message:confirm')
        .setLabel('Continue')
        .setEmoji('<:tcet_tick:1437995479567962184>')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wizard:cancel-new-message:confirm')
        .setLabel('Cancel')
        .setEmoji('<:tcet_cross:1437995480754946178>')
        .setStyle(ButtonStyle.Danger)
    );

    // Save panel temporarily in autosave for later use
    const autosave = await client.db.getAutosave(userId);
    if (autosave) {
      autosave.tempPanel = panel;
      await client.db.save(autosave);
    } else {
      const newAutosave: AutosaveData = {
        id: `autosave:${userId}`,
        type: 'autosave',
        userId,
        data: {},
        tempPanel: panel,
        startedAt: new Date().toISOString(),
      };
      await client.db.save(newAutosave);
    }

    await interaction.editReply({ embeds: [embed], components: [row] });
  }

  async handleSendNewMessage(interaction: any, client: BotClient, userId: string): Promise<void> {
    const autosave = await client.db.getAutosave(userId);
    const panel = autosave?.tempPanel;

    if (!panel) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Panel data not found. Please try again.',
        embeds: [],
        components: [],
      });
      return;
    }

    try {
      const channel = await client.channels.fetch(panel.channel!);
      if (channel?.isTextBased() && 'send' in channel) {
        const embed = new EmbedBuilder()
          .setTitle(`${panel.emoji} ${panel.name}`)
          .setDescription(panel.description)
          .setColor(null)
          .setFooter({ text: 'Click the button below to open a ticket' })
          .setTimestamp();

        // Map color string to ButtonStyle
        const colorMap = {
          'Primary': ButtonStyle.Primary,
          'Secondary': ButtonStyle.Secondary,
          'Success': ButtonStyle.Success,
          'Danger': ButtonStyle.Danger,
        };
        const buttonStyle = colorMap[panel.color as keyof typeof colorMap] || ButtonStyle.Primary;

        const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket:open:${panel.id}`)
            .setLabel(panel.label)
            .setEmoji(panel.emoji!)
            .setStyle(buttonStyle)
        );

        const message = await channel.send({ embeds: [embed], components: [button] });
        panel.messageId = message.id;
        await client.db.save(panel);

        // Clean up autosave
        await client.db.deleteAutosave(userId);

        await interaction.editReply({
          content: `<:tcet_tick:1437995479567962184> **Panel "${panel.name}" updated successfully!**\n\nA new message has been sent in <#${panel.channel}>`,
          embeds: [],
          components: [],
        });
      }
    } catch (error) {
      ErrorHandler.handle(error as Error, 'Send new panel message');
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Failed to send new panel message. Please try again.',
        embeds: [],
        components: [],
      });
    }
  }

  async handleCancelNewMessage(interaction: any, client: BotClient, userId: string): Promise<void> {
    await client.db.deleteAutosave(userId);

    await interaction.editReply({
      content: '<:tcet_cross:1437995480754946178> Panel update cancelled. The original message could not be found and no new message was sent.',
      embeds: [],
      components: [],
    });
  }

  // ============================================
  // PERMISSIONS MODULE
  // ============================================

  private getAllChannelPermissions(): { label: string; value: string; description: string }[] {
    return [
      { label: 'View Channel', value: 'ViewChannel', description: 'Can see the ticket channel' },
      { label: 'Send Messages', value: 'SendMessages', description: 'Can send messages in the ticket' },
      { label: 'Read Message History', value: 'ReadMessageHistory', description: 'Can read past messages' },
      { label: 'Attach Files', value: 'AttachFiles', description: 'Can attach files and images' },
      { label: 'Embed Links', value: 'EmbedLinks', description: 'Can embed links' },
      { label: 'Add Reactions', value: 'AddReactions', description: 'Can react to messages' },
      { label: 'Use External Emojis', value: 'UseExternalEmojis', description: 'Can use external emojis' },
      { label: 'Mention Everyone', value: 'MentionEveryone', description: 'Can mention @everyone and @here' },
      { label: 'Manage Messages', value: 'ManageMessages', description: 'Can delete and pin messages' },
      { label: 'Manage Channels', value: 'ManageChannels', description: 'Can edit channel settings' },
      { label: 'Create Public Threads', value: 'CreatePublicThreads', description: 'Can create public threads' },
      { label: 'Create Private Threads', value: 'CreatePrivateThreads', description: 'Can create private threads' },
      { label: 'Send Messages in Threads', value: 'SendMessagesInThreads', description: 'Can send messages in threads' },
      { label: 'Use Application Commands', value: 'UseApplicationCommands', description: 'Can use slash commands' },
    ];
  }

  private getUserSuggestedPermissions(): string[] {
    return [
      'ViewChannel',
      'SendMessages',
      'ReadMessageHistory',
      'AttachFiles',
      'EmbedLinks',
      'AddReactions',
    ];
  }

  private getStaffSuggestedPermissions(): string[] {
    return [
      'ViewChannel',
      'SendMessages',
      'ReadMessageHistory',
      'AttachFiles',
      'EmbedLinks',
      'AddReactions',
      'UseExternalEmojis',
      'ManageMessages',
      'CreatePublicThreads',
      'CreatePrivateThreads',
      'SendMessagesInThreads',
      'UseApplicationCommands',
    ];
  }

  async showPermissionsMenu(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);

    const userPerms = data.userPermissions || [];
    const staffPerms = data.staffPermissions || [];

    const embed = new EmbedBuilder()
      .setTitle('<:settings:1437996913180934144> Permissions Setup')
      .setDescription('Configure ticket channel permissions for users and staff members.\n\n**User Permissions** apply to the ticket creator.\n**Staff Permissions** apply to staff members.')
      .setColor(null)
      .addFields(
        {
          name: '<:user_icon:1437995661378191493> :  User Permissions',
          value: userPerms.length > 0
            ? userPerms.map(p => `\`${p}\``).join(', ')
            : '`None set`',
          inline: false
        },
        {
          name: '<:xieron_staffs:1437995300164730931> Staff Permissions',
          value: staffPerms.length > 0
            ? staffPerms.map(p => `\`${p}\``).join(', ')
            : '`None set`',
          inline: false
        }
      )
      .setFooter({ text: `Powered by ${client.user?.username || 'Ticket Bot'}` })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:permissions-user:setup')
        .setLabel('User Permissions')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard:permissions-staff:setup')
        .setLabel('Staff Permissions')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:permissions-suggestions:setup')
        .setLabel('Show Suggestions')
        .setStyle(ButtonStyle.Success)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:main:back')
        .setLabel('Back to Main')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
  }

  async showUserPermissions(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const allPermissions = this.getAllChannelPermissions();
    const currentPermissions = data.userPermissions || [];

    const embed = new EmbedBuilder()
      .setTitle('<:user_icon:1437995661378191493>  User Permissions')
      .setDescription('Select permissions that ticket creators will have in their tickets.\n\nYou can select multiple permissions. Selected permissions are marked with ✅')
      .setColor(null)
      .addFields(
        {
          name: 'Currently Selected',
          value: currentPermissions.length > 0
            ? currentPermissions.map(p => `✅ \`${p}\``).join('\n')
            : '`None`',
          inline: false
        }
      )
      .setFooter({ text: 'Select from the dropdown below' })
      .setTimestamp();

    // Create options with checkmarks for selected permissions
    const options = allPermissions.map(perm => ({
      label: (currentPermissions.includes(perm.value) ? '✅ ' : '') + perm.label,
      value: perm.value,
      description: perm.description,
      default: currentPermissions.includes(perm.value)
    }));

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-user-permissions:setup')
        .setPlaceholder('Select or deselect permissions')
        .setMinValues(0)
        .setMaxValues(allPermissions.length)
        .addOptions(options)
    );

    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:permissions:setup')
        .setLabel('Back to Permissions')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [selectMenu, backButton] });
  }

  async showStaffPermissions(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const allPermissions = this.getAllChannelPermissions();
    const currentPermissions = data.staffPermissions || [];

    const embed = new EmbedBuilder()
      .setTitle('<:xieron_staffs:1437995300164730931> Staff Permissions')
      .setDescription('Select permissions that staff members will have in tickets.\n\nYou can select multiple permissions. Selected permissions are marked with ✅')
      .setColor(null)
      .addFields(
        {
          name: 'Currently Selected',
          value: currentPermissions.length > 0
            ? currentPermissions.map(p => `✅ \`${p}\``).join('\n')
            : '`None`',
          inline: false
        }
      )
      .setFooter({ text: 'Select from the dropdown below' })
      .setTimestamp();

    // Create options with checkmarks for selected permissions
    const options = allPermissions.map(perm => ({
      label: (currentPermissions.includes(perm.value) ? '✅ ' : '') + perm.label,
      value: perm.value,
      description: perm.description,
      default: currentPermissions.includes(perm.value)
    }));

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard:select-staff-permissions:setup')
        .setPlaceholder('Select or deselect permissions')
        .setMinValues(0)
        .setMaxValues(allPermissions.length)
        .addOptions(options)
    );

    const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:permissions:setup')
        .setLabel('Back to Permissions')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [selectMenu, backButton] });
  }

  async showPermissionSuggestions(interaction: any, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    const userSuggestions = this.getUserSuggestedPermissions();
    const staffSuggestions = this.getStaffSuggestedPermissions();
    const allPermissions = this.getAllChannelPermissions();

    const getUserPermLabel = (value: string) => {
      const perm = allPermissions.find(p => p.value === value);
      return perm ? `\`${perm.label}\`` : `\`${value}\``;
    };

    const embed = new EmbedBuilder()
      .setTitle('💡 Permission Suggestions')
      .setDescription('Here are recommended permission sets for users and staff.\n\n**These are just suggestions** - you can customize them however you like!')
      .setColor(null)
      .addFields(
        {
          name: '<:user_icon:1437995661378191493> Recommended User Permissions',
          value: userSuggestions.map(p => getUserPermLabel(p)).join('\n'),
          inline: false
        },
        {
          name: '<:xieron_staffs:1437995300164730931> Recommended Staff Permissions',
          value: staffSuggestions.map(p => getUserPermLabel(p)).join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Click the buttons below to apply these suggestions' })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:apply-user-suggestions:setup')
        .setLabel('Apply User Suggestions')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wizard:apply-staff-suggestions:setup')
        .setLabel('Apply Staff Suggestions')
        .setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:apply-all-suggestions:setup')
        .setLabel('Apply All Suggestions')
        .setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard:permissions:setup')
        .setLabel('Back to Permissions')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
  }

  async handleUserPermissionsSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.userPermissions = interaction.values;
    this.saveAutosave(client, userId, data);
    await this.showUserPermissions(interaction, client, userId);
  }

  async handleStaffPermissionsSelect(interaction: StringSelectMenuInteraction, client: BotClient, userId: string): Promise<void> {
    const data = await this.getOrCreateAutosave(client, userId);
    data.staffPermissions = interaction.values;
    this.saveAutosave(client, userId, data);
    await this.showStaffPermissions(interaction, client, userId);
  }

  async applyUserSuggestions(interaction: any, client: BotClient, userId: string): Promise<void> {
    // Ensure interaction is deferred
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => { });
    }

    const data = await this.getOrCreateAutosave(client, userId);
    data.userPermissions = this.getUserSuggestedPermissions();
    this.saveAutosave(client, userId, data);

    await this.showPermissionsMenu(interaction, client, userId);
  }

  async applyStaffSuggestions(interaction: any, client: BotClient, userId: string): Promise<void> {
    // Ensure interaction is deferred
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => { });
    }

    const data = await this.getOrCreateAutosave(client, userId);
    data.staffPermissions = this.getStaffSuggestedPermissions();
    this.saveAutosave(client, userId, data);

    await this.showPermissionsMenu(interaction, client, userId);
  }

  async applyAllSuggestions(interaction: any, client: BotClient, userId: string): Promise<void> {
    // Ensure interaction is deferred
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => { });
    }

    const data = await this.getOrCreateAutosave(client, userId);
    data.userPermissions = this.getUserSuggestedPermissions();
    data.staffPermissions = this.getStaffSuggestedPermissions();
    this.saveAutosave(client, userId, data);

    await this.showPermissionsMenu(interaction, client, userId);
  }
}
