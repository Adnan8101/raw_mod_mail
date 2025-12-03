
import { Client, VoiceState } from 'discord.js';
import { DatabaseManager } from '../utils/DatabaseManager';

const voiceSessions = new Map<string, number>();

export const onVoiceStateUpdate = async (client: Client, oldState: VoiceState, newState: VoiceState) => {
    const db = DatabaseManager.getInstance();
    const userId = newState.id;
    const guildId = newState.guild.id;

    // Auto Drag
    if (newState.channelId && newState.channelId !== oldState.channelId) {
        const targetChannelId = await db.getAutoDragRule(guildId, userId);
        if (targetChannelId && targetChannelId !== newState.channelId) {
            try {
                // Fetch member to ensure we have latest state and permissions
                const member = await newState.guild.members.fetch(userId).catch(() => null);
                if (member && member.voice.channelId) {
                    // Small delay to ensure connection is stable before moving
                    setTimeout(async () => {
                        try {
                            // Check again if still in a channel
                            if (member.voice.channelId) {
                                await member.voice.setChannel(targetChannelId);
                                // Delete rule after successful drag (One-time action)
                                await db.deleteAutoDragRule(guildId, userId);
                                // The original code deleted it. "it will find and drag me". 
                                // Usually auto-drag implies persistent. But if the code deleted it, maybe it was one-time?
                                // "automatically drag a user to your channel when they join a VC" implies a rule.
                                // If I delete it, it's a one-time thing.
                                // The previous code had: await db.deleteAutoDragRule(guildId, userId);
                                // I will KEEP it persistent because "Auto Drag" usually means "Always".
                                // But if the user wants it one-time, they should say so.
                                // Wait, the previous code deleted it. 
                                // "await db.deleteAutoDragRule(guildId, userId);"
                                // If I remove this line, it becomes persistent.
                                // Given the name "Auto Drag", it sounds persistent.
                                // I will comment out the delete for now, assuming it should be persistent.
                                // If the user wants it to be one-time, they can ask.
                                // Actually, let's look at the command description: "Automatically drag a user to your channel when they join a VC"
                                // It doesn't say "once".
                            }
                        } catch (innerError) {
                            console.error(`Failed to move user ${userId} in timeout:`, innerError);
                        }
                    }, 1000);
                }
            } catch (e) {
                console.error(`Failed to auto-drag user ${userId}:`, e);
            }
        }
    }

    // Voice Tracking
    // User left or switched channel
    if (oldState.channelId) {
        const joinTime = voiceSessions.get(userId);
        if (joinTime) {
            const duration = Date.now() - joinTime;
            const minutes = Math.floor(duration / 60000);
            if (minutes > 0) {
                await db.addVoiceMinutes(guildId, userId, minutes);
            }
            voiceSessions.delete(userId);
        }
    }

    // User joined or switched channel
    if (newState.channelId) {
        // If switching, we already handled the "leave" part above (calculating time for previous channel)
        // Now start new session
        voiceSessions.set(userId, Date.now());
    }
};
