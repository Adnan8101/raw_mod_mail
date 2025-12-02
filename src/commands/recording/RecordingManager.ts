
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
                } catch (error) {
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

            const session: RecordingSession & { monitorInterval?: NodeJS.Timeout } = {
                guildId,
                channelId: channel.id,
                textChannelId,
                startTime: Date.now(),
                mode,
                connection,
                pipeline,
                formats: { wav: true, mp3: false, opus: false, flac: false }
            };

            // Start monitoring loop (every 5 seconds)
            session.monitorInterval = setInterval(() => this.checkSizeAndRotate(guildId), 5000);

            this.sessions.set(guildId, session);
            return true;

        } catch (error) {
            console.error('Failed to start recording:', error);
            return false;
        }
    }

    private async checkSizeAndRotate(guildId: string) {
        const session = this.sessions.get(guildId) as RecordingSession & { monitorInterval?: NodeJS.Timeout };
        if (!session) return;

        try {
            const files = fs.readdirSync(session.pipeline.getSessionDir());
            let totalSize = 0;
            for (const file of files) {
                if (file.endsWith('.pcm')) {
                    const stats = fs.statSync(path.join(session.pipeline.getSessionDir(), file));
                    totalSize += stats.size;
                }
            }

            // Threshold: 50MB PCM (approx 5MB MP3)
            // 50MB = 50 * 1024 * 1024 = 52428800 bytes
            if (totalSize > 52428800) {
                console.log(`Session ${guildId} exceeded size limit (${totalSize} bytes). Rotating...`);
                await this.rotateSession(guildId);
            }
        } catch (error) {
            console.error('Error checking size:', error);
        }
    }

    private async rotateSession(guildId: string) {
        const session = this.sessions.get(guildId);
        if (!session) return;

        // 1. Rotate pipeline to get closed files
        const closedFiles = session.pipeline.rotate();
        if (closedFiles.length === 0) return;

        // 2. Create a temporary chunk directory
        const chunkDir = path.join(session.pipeline.getSessionDir(), `chunk_${Date.now()}`);
        if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir);

        // 3. Move closed files to chunk directory
        for (const file of closedFiles) {
            if (fs.existsSync(file)) {
                const basename = path.basename(file);
                fs.renameSync(file, path.join(chunkDir, basename));
            }
        }

        // 4. Process the chunk
        try {
            const textChannel = await this.client.channels.fetch(session.textChannelId) as TextChannel;
            if (textChannel) {
                await textChannel.send('🔄 **Auto-saving recording chunk...**');
            }

            const outputFiles = await import('./PostProcessor').then(async (mod) => {
                return await mod.PostProcessor.processSession(chunkDir, session.formats);
            });

            if (textChannel && outputFiles && outputFiles.length > 0) {
                const attachments = outputFiles.map(file => new AttachmentBuilder(file));
                await textChannel.send({
                    content: `📁 **Recording Chunk**\nHere is a part of the recording (auto-split due to size).`,
                    files: attachments
                });

                // Cleanup processed files
                outputFiles.forEach(f => fs.unlinkSync(f));
            }

            // Cleanup chunk dir
            fs.rmSync(chunkDir, { recursive: true, force: true });

        } catch (error) {
            console.error('Error processing chunk:', error);
        }
    }

    public async stopRecording(guildId: string): Promise<boolean> {
        const session = this.sessions.get(guildId) as RecordingSession & { monitorInterval?: NodeJS.Timeout };
        if (!session) return false;

        if (session.monitorInterval) clearInterval(session.monitorInterval);

        session.pipeline.stop();

        if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            session.connection.destroy();
        }

        this.sessions.delete(guildId);

        // Process remaining files
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

            const textChannel = await this.client.channels.fetch(session.textChannelId) as TextChannel;
            if (!textChannel) return false;

            if (outputFiles && outputFiles.length > 0) {
                try {
                    const attachments = outputFiles.map(file => new AttachmentBuilder(file));
                    await textChannel.send({
                        content: `🎙️ **Recording Session Ended**\nHere is the final audio file for <#${session.channelId}>.`,
                        files: attachments
                    });

                    // Cleanup
                    // fs.rmSync(session.pipeline.getSessionDir(), { recursive: true, force: true }); 
                    // Keep session dir for debugging or manual recovery if needed, or delete it.
                    // User didn't specify, but usually good to keep for a bit or delete.
                    // I'll leave it as is for now.

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

        // Calculate current size
        let currentSize = 0;
        try {
            const files = fs.readdirSync(session.pipeline.getSessionDir());
            for (const file of files) {
                if (file.endsWith('.pcm')) {
                    const stats = fs.statSync(path.join(session.pipeline.getSessionDir(), file));
                    currentSize += stats.size;
                }
            }
        } catch (e) { }
        const sizeMB = (currentSize / (1024 * 1024)).toFixed(2);

        return {
            duration: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
            userCount: session.pipeline.getActiveUserCount(),
            mode: session.mode,
            size: `${sizeMB} MB`
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
