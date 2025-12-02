
import { VoiceConnection, EndBehaviorType, AudioReceiveStream } from '@discordjs/voice';
import { User } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as prism from 'prism-media';
import { pipeline } from 'stream';

export class AudioPipeline {
    private connection: VoiceConnection;
    private sessionDir: string;
    private mode: 'mixed' | 'multitrack' | 'both';
    private activeStreams: Map<string, { stream: fs.WriteStream, opusStream?: AudioReceiveStream, startTime: number, filename: string }> = new Map();
    private isRecording: boolean = false;
    private participants: Set<string> = new Set();
    private splitInterval: NodeJS.Timeout | null = null;

    constructor(connection: VoiceConnection, sessionDir: string, mode: 'mixed' | 'multitrack' | 'both') {
        this.connection = connection;
        this.sessionDir = sessionDir;
        this.mode = mode;
    }

    public start() {
        this.isRecording = true;
        this.connection.receiver.speaking.on('start', (userId) => {
            if (!this.isRecording) return;
            this.participants.add(userId);
            this.handleUserSpeaking(userId);
        });

        // Auto-split every 1 hour (3600000 ms)
        this.splitInterval = setInterval(() => this.splitRecordings(), 3600000);
    }

    public stop() {
        this.isRecording = false;
        if (this.splitInterval) clearInterval(this.splitInterval);

        this.activeStreams.forEach(data => {
            if (data.opusStream) data.opusStream.destroy();
            data.stream.end();
        });
        this.activeStreams.clear();
    }

    public getActiveUserCount(): number {
        return this.activeStreams.size;
    }

    public getSessionDir(): string {
        return this.sessionDir;
    }

    public getParticipants(): string[] {
        return Array.from(this.participants);
    }

    public rotate(): string[] {
        console.log('Rotating recordings...');
        const closedFiles: string[] = [];

        // Split individual user streams
        const currentUsers = Array.from(this.activeStreams.keys());
        currentUsers.forEach(userId => {
            const data = this.activeStreams.get(userId);
            if (data) {
                closedFiles.push(data.filename);
                data.stream.end();
                this.activeStreams.delete(userId);
                // Re-trigger handling to create new file
                this.handleUserSpeaking(userId);
            }
        });
        return closedFiles;
    }

    private splitRecordings() {
        this.rotate();
    }

    private handleUserSpeaking(userId: string) {
        if (this.activeStreams.has(userId)) return;

        const opusStream = this.connection.receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 1000,
            },
        });

        const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });

        const filename = path.join(this.sessionDir, `user_${userId}_${Date.now()}.pcm`);
        const out = fs.createWriteStream(filename);

        // Pipeline: Opus Packet -> Decoder -> PCM File
        pipeline(opusStream, decoder, out, (err: any) => {
            if (err) {
                if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                    // Ignore premature close during shutdown
                    return;
                }
                console.error(`Pipeline error for user ${userId}:`, err);
            }
            this.activeStreams.delete(userId);
        });

        this.activeStreams.set(userId, { stream: out, opusStream, startTime: Date.now(), filename });
    }
}
