import { Client, Events, GuildChannel, PermissionFlagsBits, ChannelType } from 'discord.js';
import { ModerationService } from '../services/ModerationService';

export class QuarantineMonitor {
    constructor(
        private client: Client,
        private moderationService: ModerationService
    ) {
        this.setupListeners();
    }

    private setupListeners() {
        this.client.on(Events.ChannelCreate, async (channel) => {
            if (channel.isDMBased()) return;
            await this.handleChannelCreate(channel as GuildChannel);
        });
    }

    private async handleChannelCreate(channel: GuildChannel) {
        try {
            const guildId = channel.guild.id;
            const config = await this.moderationService.getQuarantineConfig(guildId);

            if (!config || !config.roleId) return;

            // Check if role exists
            const role = await channel.guild.roles.fetch(config.roleId).catch(() => null);
            if (!role) return;

            // Deny ViewChannel for the quarantine role
            await channel.permissionOverwrites.create(role, {
                ViewChannel: false,
                SendMessages: false,
                Connect: false,
                Speak: false,
                AddReactions: false,
            }, { reason: 'Quarantine: Automatically hiding new channel' });

            console.log(`✔ Secured new channel ${channel.name} from quarantine role.`);
        } catch (error) {
            console.error(`✖ Failed to secure channel ${channel.name} from quarantine role:`, error);
        }
    }
}
