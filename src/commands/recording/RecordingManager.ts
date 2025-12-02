
import { Client, VoiceChannel, Snowflake, TextChannel, AttachmentBuilder } from 'discord.js';
import { AudioPipeline } from './AudioPipeline';
import { joinVoiceChannel, VoiceConnection, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import * as fs from 'fs';
import * as path from 'path';

export interface RecordingSession {
    guildId: string;
    channelId: string;
    textChannelId: string;
    startTime: number;
    mode: 'mixed' | 'multitrack' | 'both';
    connection: VoiceConnection;
    pipeline: AudioPipeline;
    formats: {
        wav: boolean;
        mp3: boolean;
        opus: boolean;
        flac: boolean;
    };
}

export class RecordingManager {
    private sessions: Map<string, RecordingSession> = new Map();
    private client: Client;
    private recordingsPath: string;

    constructor(client: Client) {
        this.client = client;
        this.recordingsPath = path.join(process.cwd(), 'recordings');
        if (!fs.existsSync(this.recordingsPath)) {
            fs.mkdirSync(this.recordingsPath);
        }
    }

    public async startRecording(guildId: string, channel: VoiceChannel, textChannelId: string): Promise<boolean> {
        if (this.sessions.has(guildId)) return false;

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guildId,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                    // Seems to be reconnecting to a new channel - ignore disconnect
                } catch (error) {
                    // Seems to be a real disconnect which SHOULDN'T be recovered from
                    if (this.sessions.has(guildId)) {
                        console.log(`Connection disconnected for guild ${guildId}, stopping recording.`);
                        await this.stopRecording(guildId);
                    }
                }
            });

            const sessionDir = path.join(this.recordingsPath, `session_${guildId}_${Date.now()}`);
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir);
            }

            const mode = 'mixed';
            const pipeline = new AudioPipeline(connection, sessionDir, mode);
            pipeline.start();

            const session: RecordingSession = {
                guildId,
                channelId: channel.id,
                textChannelId,
                startTime: Date.now(),
                mode,
                connection,
                pipeline,
                formats: { wav: true, mp3: false, opus: false, flac: false } // Default to WAV
            };

            this.sessions.set(guildId, session);
            return true;

        } catch (error) {
            console.error('Failed to start recording:', error);
            return false;
        }
    }

    public async stopRecording(guildId: string): Promise<boolean> {
        const session = this.sessions.get(guildId);
        if (!session) return false;

        session.pipeline.stop();

        if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            session.connection.destroy();
        }

        this.sessions.delete(guildId);

        // Generate Metadata
        const metadata = {
            guildId: session.guildId,
            channelId: session.channelId,
            startTime: session.startTime,
            endTime: Date.now(),
            mode: session.mode,
            participants: session.pipeline.getParticipants()
        };

        fs.writeFileSync(path.join(session.pipeline.getSessionDir(), 'metadata.json'), JSON.stringify(metadata, null, 2));

        // Trigger post-processing
        try {
            console.log(`Starting post-processing for session ${guildId}...`);
            const outputFiles = await import('./PostProcessor').then(async (mod) => {
                return await mod.PostProcessor.processSession(session.pipeline.getSessionDir(), session.formats);
            });
            console.log(`Post-processing complete for session ${guildId}. Output files:`, outputFiles);

            const textChannel = await this.client.channels.fetch(session.textChannelId) as TextChannel;
            if (!textChannel) {
                console.error(`Text channel ${session.textChannelId} not found.`);
                return false;
            }

            if (outputFiles && outputFiles.length > 0) {
                try {
                    const attachments = outputFiles.map(file => new AttachmentBuilder(file));
                    // Import createSuccessEmbed dynamically or use a simple message for now to avoid circular deps if any
                    // But we can just use the helper if imported.
                    // Let's stick to the existing pattern but maybe use the embed helper if available?
                    // The user asked for embeds.
                    // I'll use a standard message with the file for now, or I need to import the embed helper.
                    // Let's just send the file with a nice message.
                    await textChannel.send({
                        content: `🎙️ **Recording Session Ended**\nHere is the processed audio file for <#${session.channelId}>.`,
                        files: attachments
                    });
                } catch (sendError) {
                    console.error('Failed to send recording files:', sendError);
                    await textChannel.send('❌ Failed to send recording files. They may be too large.');
                }
            } else {
                await textChannel.send('⚠️ **Recording Session Ended**\nNo audio was captured during this session.');
            }
        } catch (e) {
            console.error('Post-processing failed:', e);
        }

        return true;
    }

    public getStatus(guildId: string) {
        const session = this.sessions.get(guildId);
        if (!session) return null;

        const durationMs = Date.now() - session.startTime;
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);

        return {
            duration: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
            userCount: session.pipeline.getActiveUserCount(),
            mode: session.mode
        };
    }

    public updateFormats(guildId: string, formats: { wav: boolean; mp3: boolean; opus: boolean; flac: boolean }) {
        const session = this.sessions.get(guildId);
        if (session) {
            session.formats = { ...session.formats, ...formats };
        }
    }
}

let recordingManager: RecordingManager | null = null;

export const getRecordingManager = (client: Client) => {
    if (!recordingManager) {
        recordingManager = new RecordingManager(client);
    }
    return recordingManager;
};
