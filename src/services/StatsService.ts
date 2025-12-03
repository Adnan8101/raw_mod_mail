import { Client, Message, VoiceState, Events } from 'discord.js';
import { DatabaseManager } from '../utils/DatabaseManager';

export class StatsService {
    private static instance: StatsService;
    private client: Client;
    private db: DatabaseManager;
    private voiceJoinTimes: Map<string, number> = new Map(); // key: "guildId-userId", value: timestamp

    private constructor(client: Client) {
        this.client = client;
        this.db = DatabaseManager.getInstance();
        this.initialize();
    }

    public static getInstance(client: Client): StatsService {
        if (!StatsService.instance) {
            StatsService.instance = new StatsService(client);
        }
        return StatsService.instance;
    }

    private initialize() {
        this.client.on(Events.MessageCreate, this.handleMessage.bind(this));
        this.client.on(Events.VoiceStateUpdate, this.handleVoiceStateUpdate.bind(this));

        // Periodic save for voice stats (every 5 minutes)
        setInterval(this.saveVoiceStats.bind(this), 5 * 60 * 1000);
    }

    private async handleMessage(message: Message) {
        if (message.author.bot || !message.guild) return;

        await this.db.incrementMessageCount(message.guild.id, message.author.id);
    }

    private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const key = `${member.guild.id}-${member.id}`;
        const now = Date.now();

        // User joined a voice channel (and wasn't in one before)
        if (!oldState.channelId && newState.channelId) {
            this.voiceJoinTimes.set(key, now);
        }
        // User left a voice channel (and isn't in one anymore)
        else if (oldState.channelId && !newState.channelId) {
            await this.processVoiceLeave(key, now, member.guild.id, member.id);
        }
        // User switched channels (effectively leave + join, but we can just keep the timer running or restart it)
        // For simplicity and accuracy, we treat it as continuous if they stay in voice.
        // However, if we want to track per-channel, we'd restart. Here we track total voice time.
        // If we want to be safe against "ghost" sessions, we can restart the timer.
        // Let's restart the timer to be safe and save the chunk.
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await this.processVoiceLeave(key, now, member.guild.id, member.id);
            this.voiceJoinTimes.set(key, now);
        }
    }

    private async processVoiceLeave(key: string, leaveTime: number, guildId: string, userId: string) {
        const joinTime = this.voiceJoinTimes.get(key);
        if (joinTime) {
            const durationMs = leaveTime - joinTime;
            const minutes = Math.floor(durationMs / 1000 / 60);

            if (minutes > 0) {
                await this.db.addVoiceMinutes(guildId, userId, minutes);
            }

            this.voiceJoinTimes.delete(key);
        }
    }

    private async saveVoiceStats() {
        const now = Date.now();
        for (const [key, joinTime] of this.voiceJoinTimes.entries()) {
            const [guildId, userId] = key.split('-');
            const durationMs = now - joinTime;
            const minutes = Math.floor(durationMs / 1000 / 60);

            if (minutes > 0) {
                await this.db.addVoiceMinutes(guildId, userId, minutes);
                // Update join time to now so we don't double count
                this.voiceJoinTimes.set(key, now);
            }
        }
    }
}
