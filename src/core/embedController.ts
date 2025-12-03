import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { PanelData, AutosaveData } from './db/postgresDB';

export class EmbedController {
  private static debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private static botName: string = 'Beru Tickets';

  static setBotName(name: string) {
    this.botName = name;
  }

  static getBotName(): string {
    return this.botName;
  }

  /**
   * Create the main setup wizard embed.
   */
  static createSetupWizardEmbed(data: Partial<PanelData>, isEdit: boolean = false): EmbedBuilder {
    const title = isEdit
      ? '<:module:1437997093753983038> Ticket Panel Editor'
      : '<:module:1437997093753983038> Ticket Panel Setup Wizard';

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription('Welcome to the Ticket Panel Setup! Use the buttons below to configure your panel step by step.')
      .setColor(null)
      .addFields(
        {
          name: 'Panel Name',
          value: data.name || '`Not set`',
          inline: true
        },
        {
          name: 'Channel',
          value: data.channel ? `<#${data.channel}>` : '`Not set`',
          inline: true
        },
        {
          name: 'Open Category',
          value: data.openCategory ? `<#${data.openCategory}>` : '`Not set`',
          inline: true
        },


        {
          name: 'Description',
          value: data.description || 'Click below to open a ticket.',
          inline: false
        },
        {
          name: 'Open Message',
          value: data.openMessage || 'Thank you for contacting support. Please describe your issue in detail.',
          inline: false
        },
        {
          name: 'Custom Questions',
          value: data.customQuestions && data.customQuestions.length > 0
            ? data.customQuestions.map((q, i) => {
              const typeEmoji = q.type === 'primary' ? '🔵' : '⚪';
              const typeLabel = q.type === 'primary' ? 'Primary' : 'Optional';
              return `${i + 1}. ${typeEmoji} **[${typeLabel}]** ${q.text}`;
            }).join('\n')
            : '`None`',
          inline: false
        },
        {
          name: 'User Permissions',
          value: data.userPermissions && data.userPermissions.length > 0
            ? data.userPermissions.map(p => `\`${p}\``).join(', ')
            : '`Not set`',
          inline: true
        },
        {
          name: 'Staff Permissions',
          value: data.staffPermissions && data.staffPermissions.length > 0
            ? data.staffPermissions.map(p => `\`${p}\``).join(', ')
            : '`Not set`',
          inline: true
        },
        {
          name: 'Claimable',
          value: data.claimable ? '<:tcet_tick:1437995479567962184> Yes' : '<:tcet_cross:1437995480754946178> No',
          inline: true
        },
        {
          name: 'Enabled',
          value: data.enabled !== false ? '<:tcet_tick:1437995479567962184> Yes' : '<:tcet_cross:1437995480754946178> No',
          inline: true
        }
      )
      .setFooter({ text: `Powered by ${EmbedController.botName} • ${new Date().toLocaleString()}` })
      .setTimestamp();

    // Add edit summary if there are changes
    if (data.editChanges && data.editChanges.length > 0) {
      const changesPreview = data.editChanges.slice(-5).join('\n'); // Show last 5 changes
      embed.addFields({
        name: `📝 Recent Changes (${data.editChanges.length} total)`,
        value: `\`\`\`\n${changesPreview}\n\`\`\``,
        inline: false
      });
    }

    return embed;
  }

  /**
   * Create channel setup embed
   */
  static createChannelSetupEmbed(data: Partial<PanelData>): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('<:zicons_newschannel:1437846918318526536> Channel Setup')
      .setDescription('Configure the channels and roles for your ticket panel.')
      .setColor(null)
      .addFields(
        {
          name: 'Panel Name',
          value: data.name || '`Not set`',
          inline: false
        },
        {
          name: 'Channel',
          value: data.channel ? `<#${data.channel}>` : '`Not set`',
          inline: true
        },
        {
          name: 'Open Category',
          value: data.openCategory ? `<#${data.openCategory}>` : '`Not set`',
          inline: true
        },

        {
          name: 'Staff Role',
          value: data.staffRole ? `<@&${data.staffRole}>` : '`Not set`',
          inline: true
        },
        {
          name: 'Logs Channel',
          value: data.logsChannel ? `<#${data.logsChannel}>` : '`Not set`',
          inline: true
        },
        {
          name: 'Transcript Channel',
          value: data.transcriptChannel ? `<#${data.transcriptChannel}>` : '`Not set`',
          inline: true
        }
      )
      .setFooter({ text: `Powered by ${EmbedController.botName}` })
      .setTimestamp();

    return embed;
  }

  /**
   * Create permissions configuration embed
   */
  static createExtraConfigEmbed(data: Partial<PanelData>): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('<:pb_utils:1437999137919340546> Extra Configuration')
      .setDescription('Configure additional settings for your ticket panel.')
      .setColor(null)
      .addFields(
        {
          name: 'Description',
          value: data.description || 'Click below to open a ticket.',
          inline: false
        },
        {
          name: 'Open Message',
          value: data.openMessage || 'Thank you for contacting support. Please describe your issue.',
          inline: false
        },
        {
          name: 'Custom Questions',
          value: data.customQuestions && data.customQuestions.length > 0
            ? data.customQuestions.map((q, i) => {
              const typeEmoji = q.type === 'primary' ? '🔵' : '⚪';
              const typeLabel = q.type === 'primary' ? 'Primary' : 'Optional';
              return `${i + 1}. ${typeEmoji} **[${typeLabel}]** ${q.text}`;
            }).join('\n')
            : '`None`',
          inline: false
        },
        {
          name: 'Claimable',
          value: data.claimable ? '<:tcet_tick:1437995479567962184> Yes' : '<:tcet_cross:1437995480754946178> No',
          inline: true
        },
        {
          name: 'Allow Owner Close',
          value: data.allowOwnerClose !== false ? '<:tcet_tick:1437995479567962184> Yes' : '<:tcet_cross:1437995480754946178> No (Staff only)',
          inline: true
        }
      )
      .setFooter({ text: `Powered by ${EmbedController.botName}` })
      .setTimestamp();

    return embed;
  }

  /**
   * Create panel list embed with stats
   */
  static createPanelListEmbed(panels: PanelData[]): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(' Configured Ticket Panels')
      .setColor(null)
      .setTimestamp();

    if (panels.length === 0) {
      embed.setDescription('No panels configured yet. Use `/ticket panel setup` to create one!');
      return embed;
    }

    const description = panels.map(panel => {
      return `${panel.emoji || '<:module:1437997093753983038>'} **${panel.name || 'Unnamed Panel'}**\n` +
        `→ Channel: ${panel.channel ? `<#${panel.channel}>` : 'Not set'}\n` +
        `→ Staff Role: ${panel.staffRole ? `<@&${panel.staffRole}>` : 'Not set'}\n` +
        `→ Status: ${panel.enabled ? '<:tcet_tick:1437995479567962184> Enabled' : '<:tcet_cross:1437995480754946178> Disabled'}\n` +
        `→ Tickets Created: ${panel.ticketsCreated || 0}\n`;
    }).join('\n');

    embed.setDescription(description);
    return embed;
  }

  /**
   * Create ticket welcome embed
   */
  static createTicketWelcomeEmbed(
    owner: string,
    staffRole: string,
    panel: PanelData,
    ticketId: string
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('New Ticket Created')
      .setDescription(`Hello <@${owner}>!\n\n${panel.openMessage}`)
      .setColor(panel.embedColor as ColorResolvable || 0x5865F2)
      .addFields(
        {
          name: 'Ticket Owner',
          value: `<@${owner}>`,
          inline: true
        },
        {
          name: 'Ticket ID',
          value: ticketId.split(':')[1],
          inline: true
        },
        {
          name: 'Staff Role',
          value: `<@&${staffRole}>`,
          inline: true
        }
      )
      .setTimestamp();

    // Add custom questions if any
    if (panel.customQuestions && panel.customQuestions.length > 0) {
      embed.addFields({
        name: 'Questions',
        value: panel.customQuestions.map((q, i) => `${i + 1}. ${q.text}`).join('\n'),
        inline: false
      });
    }

    return embed;
  }

  /**
   * Create ticket closed embed
   */
  static createTicketClosedEmbed(closedBy: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('<:tcet_cross:1437995480754946178> Ticket Closed')
      .setDescription(`This ticket has been closed by <@${closedBy}>.`)
      .setColor(null)
      .addFields(
        {
          name: 'Options',
          value: '• Click **Reopen** to reopen this ticket\n• Click **Transcript** to generate and save the conversation',
          inline: false
        }
      )
      .setTimestamp();
  }

  /**
   * Debounced embed update
   */
  static debouncedUpdate(key: string, callback: () => void, delay: number = 500): void {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        console.error('[EmbedController] Debounced callback error:', error);
      } finally {
        // Always clean up timer, even if callback throws
        this.debounceTimers.delete(key);
      }
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Clear all debounce timers (cleanup)
   */
  static clearAllTimers(): void {
    for (const [key, timer] of this.debounceTimers.entries()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
