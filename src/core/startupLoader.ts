import { BotClient } from './client';

export class StartupLoader {
  /**
   * Load and restore all panels and tickets on bot startup
   * Pre-warm caches for faster first access
   */
  static async load(client: BotClient): Promise<void> {

    try {
      // Run migration to add guildId to existing panels
      console.log('🔄 Running panel migration...');
      await client.db.migratePanelsWithGuildId(client);
      
      // Pre-warm the database caches by loading all panels
      const panels = await client.db.getAllPanels();
      console.log(`📂 Loaded ${panels.length} panel(s)`);

      // Pre-warm ticket cache by loading all tickets
      const tickets = await client.db.getAllTickets();
      console.log(`🎫 Loaded ${tickets.length} ticket(s)`);

      // Verify panel messages still exist and cache the results
      let restored = 0;
      let missing = 0;

      for (const panel of panels) {
        if (!panel.enabled) continue;
        if (!panel.channel || !panel.messageId) continue;

        try {
          const channel = await client.channels.fetch(panel.channel);
          if (!channel || !channel.isTextBased()) {
            missing++;
            continue;
          }

          // Try to fetch and cache the message
          const message = await channel.messages.fetch(panel.messageId);
          if (message) {
            restored++;
          }
        } catch (error) {
          missing++;
        }
      }
      
      console.log(`✅ Verified ${restored} active panel message(s), ${missing} missing`);
      console.log(`👍 Startup cache warm-up complete`);

    } catch (error) {
      console.error('❌ Startup loader error:', error);
    }
  }

  /**
   * Verify ticket channels still exist
   */
  static async verifyTickets(client: BotClient): Promise<void> {
    const tickets = await client.db.getAllTickets();
    
    for (const ticket of tickets) {
      try {
        const channel = await client.channels.fetch(ticket.channelId);
        if (!channel) {
          // Could add orphaned flag or auto-cleanup here
        }
      } catch (error) {
      }
    }
  }
}
